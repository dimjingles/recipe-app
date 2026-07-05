'use client'

import { useState } from 'react'
import type { SkillProfile, Technique } from '@/types/database'
import { resolveTechniqueState } from '@/lib/skills'
import { BottomSheet } from '@/components/ui/bottom-sheet'

const BADGE_META: Record<string, { label: string; icon: string }> = {
  first_cook: { label: 'First Cook', icon: '🌱' },
  getting_saucy: { label: 'Getting Saucy', icon: '🔥' },
  knife_confident: { label: 'Knife Confident', icon: '🥩' },
  ten_mastered: { label: '10 Mastered', icon: '🏆' },
  pro_kitchen: { label: 'Pro Kitchen', icon: '⭐' },
}

export default function SkillMap({ techniques, skillProfile, badges }: { techniques: Technique[]; skillProfile: SkillProfile; badges: string[] }) {
  const [selected, setSelected] = useState<Technique | null>(null)
  const mastered = skillProfile.techniques_mastered || []
  const grouped = techniques.reduce<Record<string, Technique[]>>((acc, tech) => {
    ;(acc[tech.category] ||= []).push(tech)
    return acc
  }, {})
  const progress = techniques.length ? Math.round((mastered.length / techniques.length) * 100) : 0

  const badgeKeys = Object.keys(BADGE_META)
  const stateClass = (state: string) => state === 'mastered'
    ? 'bg-sage-subtle text-sage border-sage/30'
    : state === 'unlocked'
      ? 'bg-cooking-subtle text-cooking border-cooking/30'
      : 'bg-muted text-muted-foreground border-border opacity-70'

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">My Skills</h1>
        <p className="text-sm text-muted-foreground mt-1">Track what you know, what is unlocked, and what comes next.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mb-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">{mastered.length} of {techniques.length} techniques mastered</span>
          <span className="text-sm text-muted-foreground">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-cooking transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mb-6">
        <p className="text-xs text-muted-foreground font-medium mb-2 uppercase tracking-wide">Milestones</p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {badgeKeys.map(key => {
            const earned = badges.includes(key)
            const meta = BADGE_META[key]
            return <span key={key} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${earned ? 'bg-cooking text-cooking-foreground border-cooking' : 'bg-card text-muted-foreground border-border'}`}>{meta.icon} {meta.label}</span>
          })}
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([category, items]) => (
          <section key={category}>
            <h2 className="font-heading font-bold text-lg mb-3 text-foreground">{category}</h2>
            <div className="space-y-2">
              {items.map(technique => {
                const state = resolveTechniqueState(technique.key, technique.prerequisites, mastered)
                return (
                  <button id={technique.key} key={technique.key} onClick={() => setSelected(technique)} className={`w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.99] ${stateClass(state)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-heading font-semibold">{technique.label}</span>
                      <span className="shrink-0 text-xs capitalize">{state}</span>
                    </div>
                    <p className="text-sm mt-1 opacity-80">{state === 'locked' ? `Learn first: ${technique.prerequisites.join(', ')}` : technique.description}</p>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <BottomSheet open={!!selected} onClose={() => setSelected(null)} zIndex="elevated">
        {selected && (
          <div className="px-6 pb-8">
            <h3 className="font-heading text-xl font-bold text-foreground mb-2">{selected.label}</h3>
            <p className="text-sm text-muted-foreground mb-4">{selected.description}</p>
            {selected.prerequisites.length > 0 && <p className="text-sm text-muted-foreground mb-4">Prerequisites: {selected.prerequisites.join(', ')}</p>}
            <a href={`/recipes?technique=${selected.key}`} className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90">
              Find recipes using this
            </a>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
