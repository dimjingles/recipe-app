import { createClient } from '@/lib/supabase/server'
import { Profile, SkillProfile } from '@/types/database'
import { normalizeSkillProfile } from '@/lib/skills'

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) {
    // PGRST116 = no rows — expected for new users
    if (error.code !== 'PGRST116') console.error('getProfile error:', error)
    return null
  }
  return data as Profile
}

export async function completeOnboarding(answers: {
  household_size?: string
  cook_frequency?: string
  referral_source?: string
  primary_goal?: string
  diet?: string
  allergies?: string[]
  favorite_cuisines?: string[]
  skill_level?: string
  meal_reminders?: boolean
}): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        household_size: answers.household_size ?? null,
        cook_frequency: answers.cook_frequency ?? null,
        referral_source: answers.referral_source ?? null,
        primary_goal: answers.primary_goal ?? null,
        diet: answers.diet ?? null,
        allergies: answers.allergies ?? [],
        favorite_cuisines: answers.favorite_cuisines ?? [],
        skill_level: answers.skill_level ?? null,
        meal_reminders: answers.meal_reminders ?? false,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

  if (error) throw error
}

export async function updateSkillProfile(userId: string, updates: {
  newMasteredKeys?: string[]
  newSeenKeys?: string[]
  lastStretchTechnique?: string | null
}): Promise<SkillProfile> {
  const supabase = await createClient()
  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('skill_profile, skill_level')
    .eq('id', userId)
    .single()

  if (readError) throw readError

  const current = normalizeSkillProfile(profile?.skill_profile as SkillProfile | null, profile?.skill_level)
  const next: SkillProfile = {
    ...current,
    techniques_mastered: Array.from(new Set([...current.techniques_mastered, ...(updates.newMasteredKeys || [])])),
    techniques_seen: Array.from(new Set([...current.techniques_seen, ...(updates.newSeenKeys || [])])),
    last_stretch_technique: updates.lastStretchTechnique !== undefined
      ? updates.lastStretchTechnique
      : current.last_stretch_technique,
  }

  const { error } = await supabase
    .from('profiles')
    .update({ skill_profile: next, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw error
  return next
}
