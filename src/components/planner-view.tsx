'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X, Search, ShoppingCart, Sparkles, Loader2, Undo2, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { format, addDays, addWeeks, subWeeks, startOfWeek } from 'date-fns'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { SlotWithRecipe, PlanWithSlots, Profile, SkillProfile } from '@/types/database'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Shimmer } from '@/components/ui/shimmer'
import {
  ScorableRecipe,
  scoreRecipe,
  weekCuisineCounts,
  detectConflicts,
  isWeekend,
} from '@/lib/planner-scoring'
import { DayCuisinePattern } from '@/lib/db/planner'
import PlanDiversityBar from '@/components/plan-diversity-bar'
import RescueRecipeCard from '@/components/rescue-recipe-card'
import TopCookedCard from '@/components/top-cooked-card'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function getWeekStartFromDate(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

interface Props {
  initialPlan: PlanWithSlots | null
  recipes: ScorableRecipe[]
  weekStart: string
  profile: Profile | null
  skill: SkillProfile
  patterns: DayCuisinePattern[]
  cookbooks: { id: string; name: string }[]
}

export default function PlannerView({
  initialPlan,
  recipes,
  weekStart: initialWeekStart,
  profile,
  skill,
  patterns,
  cookbooks,
}: Props) {
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [plan, setPlan] = useState<PlanWithSlots | null>(initialPlan)
  const [slots, setSlots] = useState<SlotWithRecipe[]>((initialPlan?.weekly_plan_slots as SlotWithRecipe[]) || [])
  const [pickingDay, setPickingDay] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  // Slice 2 — auto-fill
  const [showAutoFillConfirm, setShowAutoFillConfirm] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [autoFillUndo, setAutoFillUndo] = useState<SlotWithRecipe[] | null>(null)

  // Slice 1 — allergy/diet confirmation
  const [pendingConflict, setPendingConflict] = useState<ScorableRecipe | null>(null)
  const [conflictConfirmed, setConflictConfirmed] = useState(false)

  const currentWeekDate = new Date(weekStart + 'T00:00:00')
  const isCurrentWeek = weekStart === initialWeekStart

  // Cookbooks whose name hints at a day type (for +5 relevance nudge)
  const cookbookDayTypes = useMemo(() => {
    const weekday = new Set<string>()
    const weekend = new Set<string>()
    for (const cb of cookbooks) {
      const n = cb.name.toLowerCase()
      if (/quick|weeknight|weekday|easy|fast|30/.test(n)) weekday.add(cb.id)
      if (/weekend|project|special|slow|sunday|saturday/.test(n)) weekend.add(cb.id)
    }
    return { weekday, weekend }
  }, [cookbooks])

  // Relevance-scored + searched recipes for the currently open day slot
  const scored = useMemo(() => {
    if (pickingDay === null) return []
    const ctx = {
      profile,
      skill,
      dayOfWeek: pickingDay,
      weekCuisineCounts: weekCuisineCounts(slots, pickingDay),
      weekdayCookbookIds: cookbookDayTypes.weekday,
      weekendCookbookIds: cookbookDayTypes.weekend,
    }
    const q = search.trim().toLowerCase()
    return recipes
      .filter(r => !q || r.name.toLowerCase().includes(q) || r.cuisine?.toLowerCase().includes(q))
      .map(r => ({ recipe: r, ...scoreRecipe(r, ctx) }))
      .sort((a, b) => b.score - a.score)
  }, [pickingDay, search, recipes, slots, profile, skill, cookbookDayTypes])

  const plannedRecipeIds = useMemo(() => new Set(slots.map(s => s.recipe_id)), [slots])
  const firstEmptyDay = (): number | null =>
    [0, 1, 2, 3, 4, 5, 6].find(d => !slots.some(s => s.day_of_week === d)) ?? null

  const navigateWeek = async (direction: 'prev' | 'next') => {
    const newDate = direction === 'next' ? addWeeks(currentWeekDate, 1) : subWeeks(currentWeekDate, 1)
    const newWeekStart = getWeekStartFromDate(newDate)
    setWeekStart(newWeekStart)
    setAutoFillUndo(null)
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

  const commitAssign = async (recipe: ScorableRecipe, day: number) => {
    const optimisticSlot: SlotWithRecipe = {
      id: 'temp-' + Date.now(),
      plan_id: plan?.id || '',
      recipe_id: recipe.id,
      day_of_week: day,
      meal_type: 'dinner',
      recipe,
    }
    setSlots(prev => [...prev.filter(s => s.day_of_week !== day), optimisticSlot])
    setAutoFillUndo(null) // manual change invalidates the auto-fill undo

    const res = await fetch('/api/planner/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStart, dayOfWeek: day, recipeId: recipe.id }),
    })
    if (!res.ok) toast.error('Could not save - tap to retry')
    else toast.success(`${recipe.name} added to ${FULL_DAYS[day]}`)
  }

  const handlePick = (recipe: ScorableRecipe, hasConflict: boolean) => {
    if (pickingDay === null) return
    if (hasConflict && !conflictConfirmed) {
      setPendingConflict(recipe)
      return
    }
    commitAssign(recipe, pickingDay)
    setPickingDay(null)
    setSearch('')
  }

  const confirmConflictedPick = () => {
    if (!pendingConflict || pickingDay === null) return
    setConflictConfirmed(true)
    commitAssign(pendingConflict, pickingDay)
    setPendingConflict(null)
    setPickingDay(null)
    setSearch('')
  }

  const addToFirstEmpty = (recipe: ScorableRecipe) => {
    const day = firstEmptyDay()
    if (day === null) {
      toast('Your week is full')
      return
    }
    commitAssign(recipe, day)
  }

  const removeSlot = async (slot: SlotWithRecipe) => {
    setSlots(prev => prev.filter(s => s.id !== slot.id))
    setAutoFillUndo(null)
    await fetch('/api/planner/slots', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: slot.id }),
    })
  }

  const runAutoFill = async () => {
    setShowAutoFillConfirm(false)
    setAutoFilling(true)
    try {
      const res = await fetch('/api/planner/auto-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStart }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Auto-fill failed')
        return
      }
      const added: SlotWithRecipe[] = data.slots || []
      if (added.length === 0) {
        toast('No empty days to fill')
        return
      }
      const addedDays = new Set(added.map(s => s.day_of_week))
      setSlots(prev => [...prev.filter(s => !addedDays.has(s.day_of_week)), ...added])
      setAutoFillUndo(added)
      toast.success(`Filled ${added.length} ${added.length === 1 ? 'day' : 'days'}`)
    } catch {
      toast.error('Auto-fill failed')
    } finally {
      setAutoFilling(false)
    }
  }

  const undoAutoFill = async () => {
    if (!autoFillUndo) return
    const ids = autoFillUndo.map(s => s.id)
    setSlots(prev => prev.filter(s => !ids.includes(s.id)))
    setAutoFillUndo(null)
    await Promise.all(
      ids.map(id =>
        fetch('/api/planner/slots', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slotId: id }),
        })
      )
    )
    toast.success('Auto-fill undone')
  }

  const closePicker = () => {
    setPickingDay(null)
    setSearch('')
  }

  const emptySlotHint = (day: number): string => {
    const pattern = patterns.find(p => p.dayOfWeek === day)
    if (pattern) return `You often cook ${pattern.cuisine} on ${FULL_DAYS[day]}s`
    return isWeekend(day) ? 'Something special?' : 'Quick meal?'
  }

  const pendingConflictLabels = pendingConflict ? detectConflicts(pendingConflict, profile) : []

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
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
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

      {/* Auto-fill week */}
      <div className="mb-5">
        {autoFillUndo ? (
          <button
            onClick={undoAutoFill}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold text-foreground shadow-sm active:scale-[0.98] transition-all"
          >
            <Undo2 className="w-4 h-4" />
            Undo auto-fill
          </button>
        ) : (
          <button
            onClick={() => setShowAutoFillConfirm(true)}
            disabled={autoFilling || recipes.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-brand-foreground shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {autoFilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {autoFilling ? 'Filling your week...' : 'Auto-fill week'}
          </button>
        )}
      </div>

      {/* Diversity bar */}
      {!loading && <PlanDiversityBar slots={slots} profile={profile} skill={skill} />}

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
                      <Link href={`/recipes/${slot.recipe_id}`} className="flex-1 px-2 py-4">
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
                      className="flex-1 px-4 py-4 text-left transition-colors hover:bg-brand-subtle/50 group"
                    >
                      <p className="text-sm font-semibold text-muted-foreground group-hover:text-brand">Add a meal</p>
                      <p className="text-xs text-muted-foreground/70">{emptySlotHint(i)}</p>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Nudge cards */}
      {!loading && (
        <>
          <RescueRecipeCard
            recipes={recipes}
            profile={profile}
            skill={skill}
            plannedRecipeIds={plannedRecipeIds}
            weekStart={weekStart}
            hasEmptyDay={firstEmptyDay() !== null}
            onAdd={() => {
              const day = firstEmptyDay()
              if (day !== null) setPickingDay(day)
            }}
          />
          <TopCookedCard
            recipes={recipes}
            plannedRecipeIds={plannedRecipeIds}
            weekStart={weekStart}
            onAdd={addToFirstEmpty}
          />
        </>
      )}

      {/* Recipe picker bottom sheet */}
      <BottomSheet open={pickingDay !== null} onClose={closePicker} maxHeight="70vh">
        <div className="px-5 pt-3 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading font-bold text-foreground">
              Pick a recipe - {pickingDay !== null ? FULL_DAYS[pickingDay] : ''}
            </h3>
            <button
              onClick={closePicker}
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
          {scored.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No recipes found</p>
              <Link href="/recipes/new" className="text-brand text-sm font-medium mt-1 block">
                + Add a new recipe
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {scored.map(({ recipe, conflicts, badges }) => {
                const conflicted = conflicts.length > 0
                return (
                  <li key={recipe.id}>
                    <button
                      onClick={() => handlePick(recipe, conflicted)}
                      className={`w-full flex items-center gap-3 px-5 py-3.5 hover:bg-brand-subtle/50 active:bg-brand-subtle active:scale-[0.99] transition-all text-left ${
                        conflicted ? 'opacity-55' : ''
                      }`}
                    >
                      <span className="text-2xl">{getCuisineEmoji(recipe.cuisine)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{recipe.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {recipe.cuisine || 'Various'} {recipe.cook_time_minutes ? `· ${recipe.cook_time_minutes}min` : ''}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {conflicted ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive capitalize">
                              <AlertTriangle className="w-3 h-3" />
                              {conflicts[0]}
                            </span>
                          ) : (
                            badges.slice(0, 2).map(b => (
                              <span
                                key={b}
                                className="rounded-full bg-brand-subtle px-2 py-0.5 text-[10px] font-bold text-brand"
                              >
                                {b}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                      {recipe.cooked_count > 0 && (
                        <span className="text-xs text-muted-foreground shrink-0">🍳×{recipe.cooked_count}</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </BottomSheet>

      {/* Auto-fill confirmation */}
      <BottomSheet open={showAutoFillConfirm} onClose={() => setShowAutoFillConfirm(false)} zIndex="elevated">
        <div className="px-5 pt-2 pb-6">
          <div className="mb-3 inline-flex items-center gap-2 text-brand">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-heading font-bold text-foreground">Auto-fill this week?</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            We'll fill your empty days with a balanced plan based on your preferences, skill, and cooking history.
            Days you've already planned won't change.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAutoFillConfirm(false)}
              className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-bold text-foreground active:scale-[0.98] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={runAutoFill}
              className="flex-1 rounded-xl bg-brand py-3 text-sm font-bold text-brand-foreground active:scale-[0.98] transition-all"
            >
              Fill my week
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Diet / allergy confirmation */}
      <BottomSheet open={pendingConflict !== null} onClose={() => setPendingConflict(null)} zIndex="top">
        <div className="px-5 pt-2 pb-6">
          <div className="mb-3 inline-flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-heading font-bold text-foreground">Heads up</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            <span className="font-semibold text-foreground">{pendingConflict?.name}</span>{' '}
            may not match your preferences
            {pendingConflictLabels.length ? ` (${pendingConflictLabels.join(', ').toLowerCase()})` : ''}. Add it anyway?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setPendingConflict(null)}
              className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-bold text-foreground active:scale-[0.98] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={confirmConflictedPick}
              className="flex-1 rounded-xl bg-destructive/10 py-3 text-sm font-bold text-destructive active:scale-[0.98] transition-all"
            >
              Add anyway
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
