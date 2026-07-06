'use client'

import { useState } from 'react'
import type { SkillProfile, Technique } from '@/types/database'
import { isGlobalCulinaryLesson, resolveTechniqueState } from '@/lib/skills'
import { BottomSheet } from '@/components/ui/bottom-sheet'

const BADGE_META: Record<string, { label: string; icon: string }> = {
  first_cook: { label: 'First Cook', icon: '🌱' },
  getting_saucy: { label: 'Getting Saucy', icon: '🔥' },
  knife_confident: { label: 'Knife Confident', icon: '🥩' },
  ten_mastered: { label: '10 Mastered', icon: '🏆' },
  pro_kitchen: { label: 'Pro Kitchen', icon: '⭐' },
}

type SkillTab = 'recipe' | 'lessons'

export default function SkillMap({ techniques, skillProfile, badges }: { techniques: Technique[]; skillProfile: SkillProfile; badges: string[] }) {
  const [selected, setSelected] = useState<Technique | null>(null)
  const [selectedTab, setSelectedTab] = useState<SkillTab>('recipe')
  const mastered = skillProfile.techniques_mastered || []
  const techniqueByKey = new Map(techniques.map(technique => [technique.key, technique]))
  const recipeTechniques = techniques.filter(technique => !isGlobalCulinaryLesson(technique))
  const globalLessons = techniques.filter(isGlobalCulinaryLesson)
  const activeTechniques = selectedTab === 'recipe' ? recipeTechniques : globalLessons
  const activeMasteredCount = activeTechniques.filter(technique => mastered.includes(technique.key)).length
  const progress = activeTechniques.length ? Math.round((activeMasteredCount / activeTechniques.length) * 100) : 0
  const grouped = activeTechniques.reduce<Record<string, Technique[]>>((acc, tech) => {
    ;(acc[tech.category] ||= []).push(tech)
    return acc
  }, {})

  const tabs: { key: SkillTab; label: string; count: number }[] = [
    { key: 'recipe', label: 'Recipe techniques', count: recipeTechniques.length },
    { key: 'lessons', label: 'Culinary lessons', count: globalLessons.length },
  ]
  const badgeKeys = Object.keys(BADGE_META)
  const stateClass = (state: string) => state === 'mastered'
    ? 'bg-sage-subtle text-sage border-sage/30'
    : state === 'unlocked'
      ? 'bg-cooking-subtle text-cooking border-cooking/30'
      : 'bg-muted text-muted-foreground border-border opacity-70'
  const selectedIsGlobal = selected ? isGlobalCulinaryLesson(selected) : false
  const selectedPrerequisites = selected?.prerequisites.map(key => techniqueByKey.get(key)?.label || key) || []

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">My Skills</h1>
        <p className="text-sm text-muted-foreground mt-1">Track recipe-specific techniques separately from broader culinary lessons.</p>
      </div>

      <div className="mb-4 flex gap-8 border-b border-border">
        {tabs.map(tab => {
          const active = selectedTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={`relative -mb-px pb-3 text-lg font-bold transition-colors ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
              <span className="ml-1.5 text-sm font-semibold text-muted-foreground">{tab.count}</span>
              {active && <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-foreground" />}
            </button>
          )
        })}
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mb-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">{activeMasteredCount} of {activeTechniques.length} {selectedTab === 'recipe' ? 'techniques' : 'lessons'} mastered</span>
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
                const prerequisites = technique.prerequisites.map(key => techniqueByKey.get(key)?.label || key)
                return (
                  <button id={technique.key} key={technique.key} onClick={() => setSelected(technique)} className={`w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.99] ${stateClass(state)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-heading font-semibold">{technique.label}</span>
                      <span className="shrink-0 text-xs capitalize">{state}</span>
                    </div>
                    <p className="text-sm mt-1 opacity-80">{state === 'locked' ? `Learn first: ${prerequisites.join(', ')}` : technique.description}</p>
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
            {selectedPrerequisites.length > 0 && <p className="text-sm text-muted-foreground mb-4">Prerequisites: {selectedPrerequisites.join(', ')}</p>}
            {!selectedIsGlobal && (
              <a href={`/recipes?technique=${selected.key}`} className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90">
                Find recipes using this
              </a>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
