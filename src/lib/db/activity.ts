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
 * Fan-out-on-read feed of friends' activity. RLS on `activity` limits rows to
 * self + friends; RLS on the embedded recipe/cookbook drops private subjects,
 * so we filter those out here — a friend cooking a private recipe never surfaces.
 */
export async function getFeed(cursor?: string, limit = 20): Promise<Feed> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return { items: [], nextCursor: null }

  let query = supabase
    .from('activity')
    .select('id, type, created_at, actor_id, recipe:recipes(id, name, image_url, cuisine), cookbook:cookbooks(id, name)')
    .neq('actor_id', user.id) // the feed shows friends, not yourself
    .order('created_at', { ascending: false })
    .limit(limit)
  if (cursor) query = query.lt('created_at', cursor)

  const { data, error } = await query
  if (error) { console.error('getFeed error:', error); return { items: [], nextCursor: null } }

  const rows = (data ?? []) as any[]
  // Cursor advances on raw row count so pagination survives filtered-out items.
  const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at : null

  // Drop events whose subject didn't resolve (private / deleted).
  const visible = rows.filter(r => (r.type === 'cookbook_created' ? !!r.cookbook : !!r.recipe))

  const actorIds = Array.from(new Set(visible.map(r => r.actor_id)))
  const { data: profiles } = await supabase.from('public_profiles').select('*').in('id', actorIds)
  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const items = visible
    .map((r): FeedItem | null => {
      const actor = profileMap.get(r.actor_id)
      if (!actor) return null
      return {
        id: r.id,
        type: r.type,
        created_at: r.created_at,
        actor,
        recipe: r.recipe
          ? { id: r.recipe.id, name: r.recipe.name, image_url: r.recipe.image_url, cuisine: r.recipe.cuisine }
          : null,
        cookbook: r.cookbook ? { id: r.cookbook.id, name: r.cookbook.name } : null,
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
