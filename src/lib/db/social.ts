import { createClient, getUser } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database, PublicProfile, Recipe, CookbookWithCount } from '@/types/database'
import { normalizeUsername, sanitizeUsernameQuery, validateUsername } from '@/lib/username'

type Client = SupabaseClient<Database>

/** From the current user's perspective toward another user. */
export type FriendshipStatus = 'none' | 'friends' | 'incoming' | 'outgoing' | 'blocked'

/** Thrown when a handle fails format validation. Maps to HTTP 400. */
export class ProfileValidationError extends Error {}
/** Thrown on a unique-violation for `username`. Maps to HTTP 409. */
export class UsernameTakenError extends Error {
  constructor() { super('That username is already taken') }
}

// ── Identity reads ────────────────────────────────────────────────────────────

/** Look up one public profile by exact handle. Returns null if not found. */
export async function getPublicProfile(username: string): Promise<PublicProfile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('public_profiles')
    .select('*')
    .eq('username', normalizeUsername(username))
    .maybeSingle()
  return data ?? null
}

/** Prefix search over handles, excluding the current user. */
export async function searchUsers(query: string): Promise<PublicProfile[]> {
  const q = sanitizeUsernameQuery(query)
  if (q.length < 2) return []
  const supabase = await createClient()
  const user = await getUser()
  const { data, error } = await supabase
    .from('public_profiles')
    .select('*')
    .ilike('username', `${q}%`)
    .order('username', { ascending: true })
    .limit(10)
  if (error) { console.error('searchUsers error:', error); return [] }
  return (data ?? []).filter(p => p.id !== user?.id)
}

/** Exact email lookup via SECURITY DEFINER RPC (never enumerates). */
export async function findUserByEmail(email: string): Promise<PublicProfile | null> {
  const clean = email.trim()
  if (!clean) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('find_user_by_email', { lookup_email: clean })
  if (error) { console.error('findUserByEmail error:', error); return null }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
  }
}

// ── Identity writes ───────────────────────────────────────────────────────────

/** Update the current user's own identity fields. Owner-only via RLS. */
export async function updateProfile(fields: {
  username?: string
  display_name?: string | null
  avatar_url?: string | null
}): Promise<PublicProfile> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) throw new Error('Not authenticated')

  const patch: Database['public']['Tables']['profiles']['Update'] = {
    updated_at: new Date().toISOString(),
  }

  if (fields.username !== undefined) {
    const err = validateUsername(fields.username)
    if (err) throw new ProfileValidationError(err)
    patch.username = normalizeUsername(fields.username)
  }
  if (fields.display_name !== undefined) {
    patch.display_name = fields.display_name?.trim() || null
  }
  if (fields.avatar_url !== undefined) {
    patch.avatar_url = fields.avatar_url || null
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('id, username, display_name, avatar_url')
    .single()

  if (error) {
    if (error.code === '23505') throw new UsernameTakenError()
    throw error
  }
  return data as PublicProfile
}

// ── Friend graph ──────────────────────────────────────────────────────────────

/** Fetch public profiles for a set of ids (skips any without a handle). */
async function profilesByIds(supabase: Client, ids: string[]): Promise<PublicProfile[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('public_profiles').select('*').in('id', ids)
  if (error) { console.error('profilesByIds error:', error); return [] }
  return data ?? []
}

/** Accepted friends of the current user. */
export async function getFriends(): Promise<PublicProfile[]> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return []
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('user_id_a, user_id_b')
    .eq('status', 'accepted')
  if (error) { console.error('getFriends error:', error); return [] }
  const ids = (rows ?? []).map(r => (r.user_id_a === user.id ? r.user_id_b : r.user_id_a))
  return profilesByIds(supabase, ids)
}

/** Incoming pending requests (someone else asked to be my friend). */
export async function getPendingRequests(): Promise<PublicProfile[]> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return []
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('requested_by')
    .eq('status', 'pending')
    .neq('requested_by', user.id)
  if (error) { console.error('getPendingRequests error:', error); return [] }
  return profilesByIds(supabase, (rows ?? []).map(r => r.requested_by))
}

/** Outgoing pending requests I've sent that haven't been answered. */
export async function getSentRequests(): Promise<PublicProfile[]> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return []
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('user_id_a, user_id_b')
    .eq('status', 'pending')
    .eq('requested_by', user.id)
  if (error) { console.error('getSentRequests error:', error); return [] }
  const ids = (rows ?? []).map(r => (r.user_id_a === user.id ? r.user_id_b : r.user_id_a))
  return profilesByIds(supabase, ids)
}

/** The current user's relationship toward `otherId`. */
export async function getFriendshipStatus(otherId: string): Promise<FriendshipStatus> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user || user.id === otherId) return 'none'
  // Canonical uuid string ordering matches Postgres least/greatest.
  const [a, b] = [user.id, otherId].sort()
  const { data } = await supabase
    .from('friendships')
    .select('status, requested_by')
    .eq('user_id_a', a)
    .eq('user_id_b', b)
    .maybeSingle()
  if (!data) return 'none'
  if (data.status === 'accepted') return 'friends'
  if (data.status === 'blocked') return 'blocked'
  return data.requested_by === user.id ? 'outgoing' : 'incoming'
}

export async function sendFriendRequest(targetId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('send_friend_request', { target_id: targetId })
  if (error) throw error
}

export async function respondToRequest(otherId: string, accept: boolean): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('respond_to_request', { other_id: otherId, do_accept: accept })
  if (error) throw error
}

export async function unfriend(otherId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('unfriend', { other_id: otherId })
  if (error) throw error
}

// ── Friend browse (visibility enforced by RLS, not app filtering) ─────────────

/**
 * Recipes OWNED by `userId` that the current user is allowed to see. We filter
 * by user_id (whose profile we're viewing) and let RLS drop anything private —
 * we never bypass RLS or assume visibility in app code.
 */
export async function getFriendRecipes(userId: string): Promise<Recipe[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) { console.error('getFriendRecipes error:', error); return [] }
  return (data ?? []) as Recipe[]
}

/** Cookbooks owned by `userId` the current user can see (RLS-filtered). */
export async function getFriendCookbooks(userId: string): Promise<CookbookWithCount[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cookbooks')
    .select('*, cookbook_recipes(recipe_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) { console.error('getFriendCookbooks error:', error); return [] }
  return (data ?? []) as CookbookWithCount[]
}

/** Public profile + counts of what the current user can see. */
export async function getFriendProfile(username: string): Promise<
  { profile: PublicProfile; recipeCount: number; cookbookCount: number } | null
> {
  const profile = await getPublicProfile(username)
  if (!profile) return null
  const supabase = await createClient()
  const [{ count: rc }, { count: cc }] = await Promise.all([
    supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
    supabase.from('cookbooks').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
  ])
  return { profile, recipeCount: rc ?? 0, cookbookCount: cc ?? 0 }
}
