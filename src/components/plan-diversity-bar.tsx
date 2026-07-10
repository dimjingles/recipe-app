'use client'

import { useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { SlotWithRecipe, Profile, SkillProfile } from '@/types/database'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import { normCuisine } from '@/lib/planner-scoring'

interface Props {
  slots: SlotWithRecipe[]
  profile: Profile | null
  skill: SkillProfile
}

export default function PlanDiversityBar({ slots, skill }: Props) {
  const [expanded, setExpanded] = useState(false)

  const planned = slots.filter(s => s.recipe)
  if (planned.length === 0) return null

  // Cuisine mix
  const cuisineCounts: Record<string, { label: string; count: number }> = {}
  for (const s of planned) {
    const label = s.recipe?.cuisine || 'Other'
    const key = normCuisine(label) || 'other'
    cuisineCounts[key] ??= { label, count: 0 }
    cuisineCounts[key].count += 1
  }
  const cuisines = Object.values(cuisineCounts).sort((a, b) => b.count - a.count)
  const overusedCuisine = cuisines.find(c => c.count >= 3)

  // Difficulty mix
  const difficulties = planned.map(s => s.recipe?.difficulty).filter((d): d is number => d != null)
  const allEasy = difficulties.length > 0 && difficulties.every(d => d <= 1)
  const readyForHarder = allEasy && skill.difficulty_ceiling >= 2

  // Cook-time spread
  const times = planned.map(s => s.recipe?.cook_time_minutes).filter((t): t is number => t != null)
  const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null

  return (
    <div className="mb-4 rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left active:scale-[0.99] transition-all"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-brand shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground shrink-0">Your week</span>
          <div className="flex items-center gap-1 overflow-hidden">
            {cuisines.slice(0, 5).map(c => (
              <span key={c.label} className="text-base leading-none" title={`${c.label} ×${c.count}`}>
                {getCuisineEmoji(c.label)}
              </span>
            ))}
          </div>
          {avgTime != null && (
            <span className="text-xs text-muted-foreground shrink-0">· ~{avgTime}min</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/50">
          {/* Cuisine mix */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-1.5">Cuisine mix</p>
            <div className="flex flex-wrap gap-1.5">
              {cuisines.map(c => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground capitalize"
                >
                  {getCuisineEmoji(c.label)} {c.label} {c.count > 1 && `×${c.count}`}
                </span>
              ))}
            </div>
            {overusedCuisine && (
              <p className="mt-1.5 text-xs text-brand font-medium">
                {overusedCuisine.label} {overusedCuisine.count}× this week — mix it up?
              </p>
            )}
          </div>

          {/* Difficulty + time */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <span className="text-muted-foreground">
              Difficulty:{' '}
              <span className="font-medium text-foreground">
                {difficulties.length
                  ? difficulties.map(d => '🔪'.repeat(d)).join(' ')
                  : '—'}
              </span>
            </span>
            {avgTime != null && (
              <span className="text-muted-foreground">
                Avg cook time: <span className="font-medium text-foreground">{avgTime} min</span>
              </span>
            )}
          </div>
          {readyForHarder && (
            <p className="text-xs text-brand font-medium">Ready for something harder this week?</p>
          )}
        </div>
      )}
    </div>
  )
}
