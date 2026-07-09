import { createClient } from '@/lib/supabase/server'
import { PublicProfile } from '@/types/database'

export interface MyHousehold {
  id: string
  name: string
  role: string
  members: PublicProfile[]
}

/** The current user's household (partners share one), or null. */
export async function getMyHousehold(): Promise<MyHousehold | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) return null

  const [{ data: household }, { data: memberRows }] = await Promise.all([
    supabase.from('households').select('id, name').eq('id', membership.household_id).single(),
    supabase.from('household_members').select('user_id').eq('household_id', membership.household_id),
  ])
  if (!household) return null

  const ids = (memberRows ?? []).map(r => r.user_id)
  const { data: profiles } = await supabase.from('public_profiles').select('*').in('id', ids)
  return { id: household.id, name: household.name, role: membership.role, members: profiles ?? [] }
}

/** Just the current user's household id (cheap; used to scope the library). */
export async function getMyHouseholdId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()
  return data?.household_id ?? null
}

export async function createHousehold(name: string): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_household', { p_name: name })
  if (error) throw error
  return data as string
}

export async function createHouseholdInvite(householdId: string): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_household_invite', { p_household: householdId })
  if (error) throw error
  return data as string
}

export async function getHouseholdInviteInfo(token: string): Promise<{ household_id: string; name: string } | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('household_invite_info', { p_token: token })
  if (error) { console.error('household_invite_info error:', error); return null }
  const row = Array.isArray(data) ? data[0] : data
  return row ?? null
}

export async function acceptHouseholdInvite(token: string): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('accept_household_invite', { p_token: token })
  if (error) throw error
  return data as string
}

export async function leaveHousehold(householdId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('leave_household', { p_household: householdId })
  if (error) throw error
}

// ── Share personal recipes / cookbooks into the household ─────────────────────

export async function setRecipeHouseholdShared(recipeId: string, shared: boolean): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let householdId: string | null = null
  if (shared) {
    householdId = await getMyHouseholdId()
    if (!householdId) throw new Error('You are not in a household')
  }

  // Owner-only: user_id = me guards who can flip the scope.
  const { error } = await supabase
    .from('recipes')
    .update(
      shared
        ? { owner_scope: 'household', household_id: householdId }
        : { owner_scope: 'user', household_id: null }
    )
    .eq('id', recipeId)
    .eq('user_id', user.id)
  if (error) throw error
}

export async function setCookbookHouseholdShared(cookbookId: string, shared: boolean): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  let householdId: string | null = null
  if (shared) {
    householdId = await getMyHouseholdId()
    if (!householdId) throw new Error('You are not in a household')
  }

  const { error } = await supabase
    .from('cookbooks')
    .update(
      shared
        ? { owner_scope: 'household', household_id: householdId }
        : { owner_scope: 'user', household_id: null }
    )
    .eq('id', cookbookId)
    .eq('user_id', user.id)
  if (error) throw error
}

// ── Per-user rankings ─────────────────────────────────────────────────────────

/** Map of recipe_id → the current user's personal rank. */
export async function getMyRankingsMap(): Promise<Map<string, number>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Map()
  const { data } = await supabase
    .from('recipe_rankings')
    .select('recipe_id, rank')
    .eq('user_id', user.id)
  return new Map((data ?? []).map(r => [r.recipe_id, r.rank]))
}

export async function getRecipeRanking(recipeId: string): Promise<number | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('recipe_rankings')
    .select('rank')
    .eq('user_id', user.id)
    .eq('recipe_id', recipeId)
    .maybeSingle()
  return data?.rank ?? null
}
