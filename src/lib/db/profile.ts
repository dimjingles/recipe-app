import { createClient } from '@/lib/supabase/server'
import { Database, Profile, RecipeSortPreference, RecipeSortDirection, SkillProfile } from '@/types/database'
import { normalizeSkillProfile } from '@/lib/skills'
import { normalizeUsername, validateUsername } from '@/lib/username'

function profileGoals(profile: Profile | null): string[] {
  if (!profile) return []
  return profile.primary_goals?.length ? profile.primary_goals : profile.primary_goal ? [profile.primary_goal] : []
}

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

/**
 * Build human-readable preference lines from a profile for LLM prompts.
 * Shared by /api/recipes/recommend and /api/planner/auto-fill so both routes
 * describe the user identically.
 */
export function buildPrefLines(profile: Profile | null): string[] {
  const lines: string[] = []
  if (!profile) return lines
  if (profile.diet && profile.diet !== 'balanced') {
    lines.push(`Diet: ${profile.diet.replace('_', '-')}`)
  }
  if (profile.favorite_cuisines?.length) {
    lines.push(`Favourite cuisines: ${profile.favorite_cuisines.join(', ')}`)
  }
  if (profile.allergies?.length && !profile.allergies.includes('none')) {
    lines.push(`Allergies / avoid: ${profile.allergies.join(', ')}`)
  }
  const goals = profileGoals(profile)
  if (goals.length) {
    lines.push(`Cooking goals: ${goals.map(goal => goal.replace('_', ' ')).join(', ')}`)
  }
  if (profile.skill_level) {
    lines.push(`Skill level: ${profile.skill_level.replace('_', ' ')}`)
  }
  if (profile.household_size) {
    lines.push(`Cooking for: ${profile.household_size.replace('_', ' ')}`)
  }
  if (profile.cook_frequency) {
    lines.push(`Cooks per week: ${profile.cook_frequency}`)
  }
  return lines
}

export async function completeOnboarding(answers: {
  household_size?: string
  cook_frequency?: string
  referral_source?: string
  primary_goals?: string[]
  primary_goal?: string
  diet?: string
  allergies?: string[]
  favorite_cuisines?: string[]
  skill_level?: string
  meal_reminders?: boolean
  username?: string
}): Promise<{ username_taken: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const base: Database['public']['Tables']['profiles']['Insert'] = {
    id: user.id,
    household_size: answers.household_size ?? null,
    cook_frequency: answers.cook_frequency ?? null,
    referral_source: answers.referral_source ?? null,
    primary_goal: answers.primary_goals?.[0] ?? answers.primary_goal ?? null,
    primary_goals: answers.primary_goals ?? (answers.primary_goal ? [answers.primary_goal] : []),
    diet: answers.diet ?? null,
    allergies: answers.allergies ?? [],
    favorite_cuisines: answers.favorite_cuisines ?? [],
    skill_level: answers.skill_level ?? null,
    meal_reminders: answers.meal_reminders ?? false,
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  }

  // Only attach a username if it passes format validation.
  const username =
    answers.username && !validateUsername(answers.username)
      ? normalizeUsername(answers.username)
      : undefined

  const { error } = await supabase
    .from('profiles')
    .upsert({ ...base, ...(username ? { username } : {}) }, { onConflict: 'id' })

  // Handle raced away between selection and save — finish onboarding without it
  // so the user isn't blocked; they can claim a handle from /profile.
  if (error?.code === '23505' && username) {
    const { error: retryError } = await supabase
      .from('profiles')
      .upsert(base, { onConflict: 'id' })
    if (retryError) throw retryError
    return { username_taken: true }
  }

  if (error) throw error
  return { username_taken: false }
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

export async function updateRecipeSortPreference(
  userId: string,
  preference: RecipeSortPreference,
  direction: RecipeSortDirection
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        recipe_sort_preference: preference,
        recipe_sort_direction: direction,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

  if (error) throw error
}
