'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, RotateCcw } from 'lucide-react'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import { ScorableRecipe } from '@/lib/planner-scoring'

interface Props {
  recipes: ScorableRecipe[]
  plannedRecipeIds: Set<string>
  weekStart: string
  onAdd: (recipe: ScorableRecipe) => void
}

export default function TopCookedCard({ recipes, plannedRecipeIds, weekStart, onAdd }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const dismissKey = `preptable:topcooked:dismissed:${weekStart}`

  // A well-loved recipe that hasn't been cooked in ~2 weeks and isn't planned.
  const recipe = useMemo(() => {
    const totalCooks = recipes.reduce((sum, r) => sum + (r.cooked_count || 0), 0)
    if (totalCooks < 3) return null
    const neglected = recipes
      .filter(r => r.cooked_count > 0 && !plannedRecipeIds.has(r.id))
      .filter(r => {
        if (!r.last_cooked_at) return true
        return (Date.now() - new Date(r.last_cooked_at).getTime()) / 86_400_000 > 14
      })
      .sort((a, b) => b.cooked_count - a.cooked_count)
    return neglected[0] || null
  }, [recipes, plannedRecipeIds])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(dismissKey)) setDismissed(true)
  }, [dismissKey])

  if (dismissed || !recipe) return null

  const handleDismiss = () => {
    setDismissed(true)
    if (typeof window !== 'undefined') window.localStorage.setItem(dismissKey, '1')
  }

  return (
    <div className="mb-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-sage">
          <RotateCcw className="w-3.5 h-3.5" />
          You cook this a lot
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
            Cooked {recipe.cooked_count}× — but not lately. Bring it back?
          </p>
        </div>
        <button
          onClick={() => onAdd(recipe)}
          className="shrink-0 rounded-xl bg-sage-subtle px-3 py-2 text-xs font-bold text-sage ring-1 ring-sage/15 shadow-sm active:scale-[0.97] transition-all"
        >
          Add back
        </button>
      </div>
    </div>
  )
}
