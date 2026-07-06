import type { SkillProfile, Technique } from '@/types/database'

export type TechniqueState = 'mastered' | 'unlocked' | 'locked'

export const DEFAULT_SKILL_PROFILE: SkillProfile = {
  techniques_mastered: [],
  techniques_seen: [],
  difficulty_ceiling: 1,
  last_stretch_technique: null,
}

export function normalizeSkillProfile(profile: SkillProfile | null | undefined, skillLevel?: string | null): SkillProfile {
  const ceiling = skillLevel === 'pro' ? 3 : skillLevel === 'confident' ? 2 : 1
  return {
    ...DEFAULT_SKILL_PROFILE,
    difficulty_ceiling: ceiling,
    ...(profile || {}),
    techniques_mastered: profile?.techniques_mastered || [],
    techniques_seen: profile?.techniques_seen || [],
    last_stretch_technique: profile?.last_stretch_technique ?? null,
  }
}

export function resolveTechniqueState(
  key: string,
  prerequisites: string[],
  mastered: string[]
): TechniqueState {
  if (mastered.includes(key)) return 'mastered'
  if (prerequisites.every(p => mastered.includes(p))) return 'unlocked'
  return 'locked'
}

export function findReadyTechnique(techniques: Technique[], profile: SkillProfile): Technique | null {
  const skip = new Set([
    ...profile.techniques_mastered,
    ...profile.techniques_seen,
    profile.last_stretch_technique || '',
  ].filter(Boolean))
  return techniques.find(t => !skip.has(t.key) && t.prerequisites.every(p => profile.techniques_mastered.includes(p))) || null
}

export function computeSkillBadges(techniques: Technique[], mastered: string[]) {
  const masteredSet = new Set(mastered)
  const heatRoots = techniques.filter(t =>
    ['Heat & Cooking Methods', 'Dry-Heat Cooking Methods', 'Moist-Heat Cooking Methods'].includes(t.category)
    && t.prerequisites.length === 0
  )
  const knife = techniques.filter(t => t.category === 'Knife Skills')
  const badges: string[] = []
  if (mastered.length >= 1) badges.push('first_cook')
  if (heatRoots.length > 0 && heatRoots.every(t => masteredSet.has(t.key))) badges.push('getting_saucy')
  if (knife.length > 0 && knife.every(t => masteredSet.has(t.key))) badges.push('knife_confident')
  if (mastered.length >= 10) badges.push('ten_mastered')
  if (techniques.length > 0 && techniques.every(t => masteredSet.has(t.key))) badges.push('pro_kitchen')
  return badges
}
