'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { Profile, SkillProfile } from '@/types/database'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import { ScorableRecipe, detectConflicts, normCuisine } from '@/lib/planner-scoring'

interface Props {
  recipes: ScorableRecipe[]
  profile: Profile | null
  skill: SkillProfile
  plannedRecipeIds: Set<string>
  weekStart: string
  hasEmptyDay: boolean
  onAdd: () => void
}

const LAST_SHOWN_KEY = 'preptable:rescue:lastShown'

export default function RescueRecipeCard({
  recipes,
  profile,
  skill,
  plannedRecipeIds,
  weekStart,
  hasEmptyDay,
  onAdd,
}: Props) {
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const dismissKey = `preptable:rescue:dismissed:${weekStart}`

  // Never-cooked recipes the user is likely to enjoy, ranked.
  const candidates = useMemo(() => {
    const favourites = new Set((profile?.favorite_cuisines || []).map(normCuisine))
    return recipes
      .filter(r => r.cooked_count === 0)
      .filter(r => !plannedRecipeIds.has(r.id))
      .filter(r => detectConflicts(r, profile).length === 0)
      .map(r => {
        let score = 0
        if (favourites.has(normCuisine(r.cuisine))) score += 50
        if (r.difficulty != null && r.difficulty <= skill.difficulty_ceiling) score += 30
        return { recipe: r, score }
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(c => c.recipe)
  }, [recipes, profile, skill, plannedRecipeIds])

  // Pick a rescue, avoiding last week's pick. localStorage read stays in effect.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(dismissKey)) {
      setDismissed(true)
      return
    }
    if (candidates.length === 0) {
      setChosenId(null)
      return
    }
    const lastShown = window.localStorage.getItem(LAST_SHOWN_KEY)
    const pick = candidates.length > 1
      ? candidates.find(r => r.id !== lastShown) ?? candidates[0]
      : candidates[0]
    setChosenId(pick.id)
    window.localStorage.setItem(LAST_SHOWN_KEY, pick.id)
  }, [candidates, dismissKey])

  const recipe = candidates.find(r => r.id === chosenId)
  if (dismissed || !recipe) return null

  const favourites = new Set((profile?.favorite_cuisines || []).map(normCuisine))
  const reason = favourites.has(normCuisine(recipe.cuisine))
    ? `Matches your love of ${recipe.cuisine} cooking`
    : 'Right at your skill level — worth a shot'

  const handleDismiss = () => {
    setDismissed(true)
    if (typeof window !== 'undefined') window.localStorage.setItem(dismissKey, '1')
  }

  return (
    <div className="mb-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand">
          <Sparkles className="w-3.5 h-3.5" />
          Rescue a recipe
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-muted-foreground/40 hover:text-foreground p-0.5 active:scale-[0.95] transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{getCuisineEmoji(recipe.cuisine)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground truncate">{recipe.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            You saved this but never cooked it. {reason}.
          </p>
        </div>
        {hasEmptyDay && (
          <button
            onClick={onAdd}
            className="shrink-0 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-brand-foreground shadow-sm active:scale-[0.97] transition-all"
          >
            Add to plan
          </button>
        )}
      </div>
    </div>
  )
}
