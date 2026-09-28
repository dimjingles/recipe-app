import { createClient, getUser } from '@/lib/supabase/server'
import { PublicProfile } from '@/types/database'

/**
 * The owner of an invite token, or null if it's unknown (reset) or the owner
 * has no handle yet. Works signed out: the RPC returns only the public profile
 * columns, and only for the exact token.
 */
export async function getInviterByToken(token: string): Promise<PublicProfile | null> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('invite_inviter', { p_token: token }).maybeSingle()
  return data ?? null
}

/**
 * Make the current (still-onboarding) user an accepted friend of the token's
 * owner. Returns the inviter's id, or null if the invite didn't apply. Must run
 * before completeOnboarding() — the RPC ignores already-onboarded accounts.
 */
export async function acceptFriendInvite(token: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('accept_friend_invite', { p_token: token })
  if (error) throw error
  return data ?? null
}

/** Give the current user a fresh invite link; the old one stops working. */
export async function resetInviteToken(): Promise<string> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .update({ invite_token: crypto.randomUUID(), updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('invite_token')
    .single()
  if (error) throw error
  return data.invite_token
}
