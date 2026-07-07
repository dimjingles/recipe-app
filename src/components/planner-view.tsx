'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, X, Search, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { format, addDays, addWeeks, subWeeks, startOfWeek } from 'date-fns'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Recipe, SlotWithRecipe, PlanWithSlots } from '@/types/database'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Shimmer } from '@/components/ui/shimmer'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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
    if (!res.ok) toast.error('Could not save - tap to retry')
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
    <div className="mx-auto max-w-5xl px-5 pt-8 pb-4 md:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">Planner</h1>
        <Link
          href={`/planner/grocery?week_start=${weekStart}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-sage-subtle px-4 py-2 text-sm font-bold text-sage shadow-sm ring-1 ring-sage/15 transition-all hover:bg-sage-subtle/80 active:scale-[0.97]"
        >
          <ShoppingCart className="w-4 h-4" />
          Grocery
        </Link>
      </div>

      {/* Week navigation */}
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
        <button
          onClick={() => navigateWeek('prev')}
          className="text-muted-foreground hover:text-foreground p-1 active:scale-[0.90] transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">
            {format(currentWeekDate, 'MMM d')} - {format(addDays(currentWeekDate, 6), 'MMM d, yyyy')}
          </p>
          {isCurrentWeek && <p className="text-xs text-brand font-medium">This week</p>}
        </div>
        <button
          onClick={() => navigateWeek('next')}
          className="text-muted-foreground hover:text-foreground p-1 active:scale-[0.90] transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day grid */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4, 5, 6, 7].map(i => (
            <Shimmer key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {DAYS.map((day, i) => {
            const date = addDays(currentWeekDate, i)
            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            const slot = slots.find(s => s.day_of_week === i)

            return (
              <div
                key={day}
                className={`overflow-hidden rounded-2xl border bg-card shadow-card transition-all active:scale-[0.99] ${
                  isToday ? 'border-brand/40' : 'border-border'
                }`}
              >
                <div className={`flex items-center ${slot ? 'justify-between' : ''}`}>
                  <div className={`min-w-[78px] px-4 py-4 ${isToday ? 'text-brand' : 'text-muted-foreground'}`}>
                    <p className="text-xs font-bold uppercase tracking-wide">{day}</p>
                    <p className={`text-sm font-bold ${isToday ? 'text-brand' : 'text-foreground'}`}>
                      {format(date, 'd')}
                    </p>
                  </div>

                  {slot ? (
                    <>
                      <Link
                        href={`/recipes/${slot.recipe_id}`}
                        className="flex-1 px-2 py-4"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getCuisineEmoji((slot.recipe as any)?.cuisine)}</span>
                          <div>
                            <p className="line-clamp-1 text-sm font-bold text-foreground">{(slot.recipe as any)?.name}</p>
                            {(slot.recipe as any)?.cuisine && (
                              <p className="text-xs text-muted-foreground capitalize">{(slot.recipe as any).cuisine}</p>
                            )}
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-1 pr-3">
                        <button
                          onClick={() => setPickingDay(i)}
                          className="text-xs text-muted-foreground hover:text-brand px-2 py-1 active:scale-[0.95] transition-all"
                        >
                          Change
                        </button>
                        <button
                          onClick={() => removeSlot(slot)}
                          className="text-muted-foreground/40 hover:text-destructive p-1 active:scale-[0.95] transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => setPickingDay(i)}
                      className="flex-1 px-4 py-5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-brand-subtle/50 hover:text-brand"
                    >
                      Add a meal
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recipe picker bottom sheet */}
      <BottomSheet
        open={pickingDay !== null}
        onClose={() => { setPickingDay(null); setSearch('') }}
        maxHeight="70vh"
      >
        <div className="px-5 pt-3 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-bold text-foreground">
              Pick a recipe - {pickingDay !== null ? FULL_DAYS[pickingDay] : ''}
            </h3>
            <button
              onClick={() => { setPickingDay(null); setSearch('') }}
              className="text-muted-foreground hover:text-foreground active:scale-[0.95] transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search recipes..."
              className="pl-9"
              autoFocus
            />
          </div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 130px)' }}>
          {filteredRecipes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No recipes found</p>
              <Link href="/recipes/new" className="text-brand text-sm font-medium mt-1 block">
                + Add a new recipe
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {filteredRecipes.map(recipe => (
                <li key={recipe.id}>
                  <button
                    onClick={() => assignRecipe(recipe)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-brand-subtle/50 active:bg-brand-subtle active:scale-[0.99] transition-all text-left"
                  >
                    <span className="text-2xl">{getCuisineEmoji(recipe.cuisine)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{recipe.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {recipe.cuisine || 'Various'} {recipe.cook_time_minutes ? `· ${recipe.cook_time_minutes}min` : ''}
                      </p>
                    </div>
                    {recipe.cooked_count > 0 && (
                      <span className="text-xs text-muted-foreground">🍳×{recipe.cooked_count}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </BottomSheet>
    </div>
  )
}
