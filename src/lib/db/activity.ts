import { createClient, getUser } from '@/lib/supabase/server'
import { PublicProfile } from '@/types/database'

export type ActivityType = 'recipe_created' | 'recipe_cooked' | 'cookbook_created'

export interface FeedRecipe {
  id: string
  name: string
  image_url: string | null
  cuisine: string | null
}
export interface FeedCookbook {
  id: string
  name: string
}
export interface FeedItem {
  id: string
  type: ActivityType
  created_at: string
  actor: PublicProfile
  recipe: FeedRecipe | null
  cookbook: FeedCookbook | null
}
export interface Feed {
  items: FeedItem[]
  nextCursor: string | null
}

/**
 * Fan-out-on-read feed of friends' activity, via the get_feed() RPC: one query
 * that filters to the caller's friends, joins actor profiles, and joins the
 * recipe/cookbook under RLS — a private subject comes back null, so a friend
 * cooking a private recipe never surfaces.
 */
export async function getFeed(cursor?: string, limit = 20): Promise<Feed> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return { items: [], nextCursor: null }

  const { data, error } = await supabase.rpc('get_feed', { p_cursor: cursor ?? null, p_limit: limit })
  if (error) { console.error('getFeed error:', error); return { items: [], nextCursor: null } }

  const rows = data ?? []
  // Cursor advances on raw row count so pagination survives filtered-out items.
  const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at : null

  const items = rows
    .map((r): FeedItem | null => {
      // Drop events whose subject didn't resolve (private / deleted) and
      // actors without a public handle.
      const hasSubject = r.type === 'cookbook_created' ? !!r.cookbook_id : !!r.recipe_id
      if (!hasSubject || !r.username) return null
      return {
        id: r.id,
        type: r.type as ActivityType,
        created_at: r.created_at,
        actor: { id: r.actor_id, username: r.username, display_name: r.display_name, avatar_url: r.avatar_url },
        recipe: r.recipe_id
          ? { id: r.recipe_id, name: r.recipe_name!, image_url: r.recipe_image_url, cuisine: r.recipe_cuisine }
          : null,
        cookbook: r.cookbook_id ? { id: r.cookbook_id, name: r.cookbook_name! } : null,
      }
    })
    .filter((x): x is FeedItem => x !== null)

  return { items, nextCursor }
}

/** Best-effort activity emit — never throws, so it can't break the write it follows. */
export async function emitActivity(
  type: ActivityType,
  subject: { recipe_id?: string; cookbook_id?: string },
): Promise<void> {
  try {
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return
    await supabase.from('activity').insert({
      actor_id: user.id,
      type,
      recipe_id: subject.recipe_id ?? null,
      cookbook_id: subject.cookbook_id ?? null,
    })
  } catch (e) {
    console.error('emitActivity error:', e)
  }
}
