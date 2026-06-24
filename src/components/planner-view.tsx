'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, Search, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { format, addDays, addWeeks, subWeeks, startOfWeek } from 'date-fns'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Recipe, SlotWithRecipe, PlanWithSlots } from '@/types/database'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const CUISINE_EMOJI: Record<string, string> = {
  italian: '🍝', japanese: '🍜', chinese: '🥢', mexican: '🌮', indian: '🍛',
  thai: '🌶️', french: '🥐', american: '🍔', mediterranean: '🫒', korean: '🍱',
  vietnamese: '🍲', greek: '🥗', spanish: '🥘',
}

function getEmoji(cuisine: string | null) {
  return CUISINE_EMOJI[(cuisine || '').toLowerCase()] ?? '🍽️'
}

function getWeekStartFromDate(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

interface Props {
  initialPlan: PlanWithSlots | null
  recipes: Recipe[]
  weekStart: string
}

export default function PlannerView({ initialPlan, recipes, weekStart: initialWeekStart }: Props) {
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [plan, setPlan] = useState<PlanWithSlots | null>(initialPlan)
  const [slots, setSlots] = useState<SlotWithRecipe[]>((initialPlan?.weekly_plan_slots as SlotWithRecipe[]) || [])
  const [pickingDay, setPickingDay] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const currentWeekDate = new Date(weekStart + 'T00:00:00')
  const isCurrentWeek = weekStart === initialWeekStart

  const navigateWeek = async (direction: 'prev' | 'next') => {
    const newDate = direction === 'next' ? addWeeks(currentWeekDate, 1) : subWeeks(currentWeekDate, 1)
    const newWeekStart = getWeekStartFromDate(newDate)
    setWeekStart(newWeekStart)
    setLoading(true)
    try {
      const res = await fetch(`/api/planner/week?week_start=${newWeekStart}`)
      const data = await res.json()
      setPlan(data.plan)
      setSlots(data.plan?.weekly_plan_slots || [])
    } catch {
      setSlots([])
    } finally {
      setLoading(false)
    }
  }

  const assignRecipe = async (recipe: Recipe) => {
    if (pickingDay === null) return
    const optimisticSlot: SlotWithRecipe = {
      id: 'temp-' + Date.now(),
      plan_id: plan?.id || '',
      recipe_id: recipe.id,
      day_of_week: pickingDay,
      meal_type: 'dinner',
      recipe,
    }
    setSlots(prev => [...prev.filter(s => s.day_of_week !== pickingDay), optimisticSlot])
    setPickingDay(null)
    setSearch('')

    const res = await fetch('/api/planner/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart, dayOfWeek: pickingDay, recipeId: recipe.id }),
    })
    if (!res.ok) toast.error('Could not save — tap to retry')
    else toast.success(`${recipe.name} added to ${FULL_DAYS[pickingDay]}`)
  }

  const removeSlot = async (slot: SlotWithRecipe) => {
    setSlots(prev => prev.filter(s => s.id !== slot.id))
    await fetch('/api/planner/slots', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: slot.id }),
    })
  }

  const filteredRecipes = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.cuisine?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Meal Planner</h1>
        <Link
          href={`/planner/grocery?week_start=${weekStart}`}
          className="flex items-center gap-1.5 bg-orange-50 text-orange-600 rounded-full px-3 py-1.5 text-sm font-medium hover:bg-orange-100"
        >
          <ShoppingCart className="w-4 h-4" />
          Grocery
        </Link>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 mb-5">
        <button onClick={() => navigateWeek('prev')} className="text-gray-400 hover:text-gray-600 p-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="font-semibold text-gray-900 text-sm">
            {format(currentWeekDate, 'MMM d')} – {format(addDays(currentWeekDate, 6), 'MMM d, yyyy')}
          </p>
          {isCurrentWeek && <p className="text-xs text-orange-500 font-medium">This week</p>}
        </div>
        <button onClick={() => navigateWeek('next')} className="text-gray-400 hover:text-gray-600 p-1">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day grid */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5,6,7].map(i => (
            <div key={i} className="bg-white rounded-2xl h-16 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {DAYS.map((day, i) => {
            const date = addDays(currentWeekDate, i)
            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            const slot = slots.find(s => s.day_of_week === i)

            return (
              <div
                key={day}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                  isToday ? 'border-orange-200' : 'border-gray-100'
                }`}
              >
                <div className={`flex items-center ${slot ? 'justify-between' : ''}`}>
                  <div className={`px-4 py-3 min-w-[72px] ${isToday ? 'text-orange-500' : 'text-gray-400'}`}>
                    <p className={`text-xs font-semibold uppercase`}>{day}</p>
                    <p className={`text-sm font-bold ${isToday ? 'text-orange-600' : 'text-gray-700'}`}>
                      {format(date, 'd')}
                    </p>
                  </div>

                  {slot ? (
                    <>
                      <Link
                        href={`/recipes/${slot.recipe_id}`}
                        className="flex-1 px-2 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getEmoji((slot.recipe as any)?.cuisine)}</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 line-clamp-1">{(slot.recipe as any)?.name}</p>
                            {(slot.recipe as any)?.cuisine && (
                              <p className="text-xs text-gray-400 capitalize">{(slot.recipe as any).cuisine}</p>
                            )}
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1 pr-3">
                        <button
                          onClick={() => setPickingDay(i)}
                          className="text-xs text-gray-400 hover:text-orange-500 px-2 py-1"
                        >
                          Change
                        </button>
                        <button
                          onClick={() => removeSlot(slot)}
                          className="text-gray-300 hover:text-red-400 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => setPickingDay(i)}
                      className="flex-1 px-4 py-3 text-left text-sm text-gray-300 hover:text-orange-400 hover:bg-orange-50 transition-colors"
                    >
                      + Add a meal
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recipe picker bottom sheet */}
      {pickingDay !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => { setPickingDay(null); setSearch('') }}>
          <div
            className="bg-white w-full max-w-lg rounded-t-3xl overflow-hidden shadow-xl"
            style={{ maxHeight: '70vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">
                  Pick a recipe — {FULL_DAYS[pickingDay]}
                </h3>
                <button onClick={() => { setPickingDay(null); setSearch('') }} className="text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search recipes..."
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 110px)' }}>
              {filteredRecipes.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No recipes found</p>
                  <Link href="/recipes/new" className="text-orange-500 text-sm font-medium mt-1 block">
                    + Add a new recipe
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {filteredRecipes.map(recipe => (
                    <li key={recipe.id}>
                      <button
                        onClick={() => assignRecipe(recipe)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-orange-50 active:bg-orange-100 transition-colors text-left"
                      >
                        <span className="text-2xl">{getEmoji(recipe.cuisine)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{recipe.name}</p>
                          <p className="text-xs text-gray-400 capitalize">{recipe.cuisine || 'Various'} {recipe.cook_time_minutes ? `· ${recipe.cook_time_minutes}min` : ''}</p>
                        </div>
                        {recipe.cooked_count > 0 && (
                          <span className="text-xs text-gray-300">🍳×{recipe.cooked_count}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
