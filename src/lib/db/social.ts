import { createClient } from '@/lib/supabase/server'
import { Database, PublicProfile } from '@/types/database'
import { normalizeUsername, sanitizeUsernameQuery, validateUsername } from '@/lib/username'

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
  const { data: { user } } = await supabase.auth.getUser()
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
  const { data: { user } } = await supabase.auth.getUser()
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
