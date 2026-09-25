import { createClient, getUser } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { getRecipes } from '@/lib/db/recipes'
import { getProfile } from '@/lib/db/profile'
import { profilesByIds } from '@/lib/db/social'
import { recommendFromFriends } from '@/lib/recommend'

/** Who made a friend's recipe. Null when the owner has no public handle. */
export interface RecipeOwner {
  username: string
  display_name: string | null
  avatar_url: string | null
}

/** A friend's recipe as the search page shows it. */
export interface FriendRecipe {
  id: string
  name: string
  cuisine: string | null
  image_url: string | null
  cook_time_minutes: number | null
  owner: RecipeOwner | null
}

/** A recipe the user opened or created from search, newest first. */
export interface RecentSearch {
  id: string
  name: string
  cuisine: string | null
  image_url: string | null
  searched_at: string
  /** True for the user's own recipe; otherwise `owner` says whose it is. */
  mine: boolean
  owner: RecipeOwner | null
}

type FriendRecipeRow = Database['public']['Functions']['friend_recipes']['Returns'][number]

/** Longest query we send to the database. */
const MAX_QUERY_LENGTH = 80
const RECENTS_LIMIT = 20
/** How many of friends' newest recipes the recommender scores. */
const CANDIDATE_POOL = 200

function toFriendRecipe(r: FriendRecipeRow): FriendRecipe {
  return {
    id: r.id,
    name: r.name,
    cuisine: r.cuisine,
    image_url: r.image_url,
    cook_time_minutes: r.cook_time_minutes,
    owner: r.username
      ? { username: r.username, display_name: r.display_name, avatar_url: r.avatar_url }
      : null,
  }
}

/** Friends' shared recipes whose name, cuisine or an ingredient matches `query`. */
export async function searchFriendRecipes(query: string): Promise<FriendRecipe[]> {
  const q = query.trim().slice(0, MAX_QUERY_LENGTH)
  if (q.length < 2) return []
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('friend_recipes', { p_query: q, p_limit: 20 })
  if (error) { console.error('searchFriendRecipes error:', error); return [] }
  return (data ?? []).map(toFriendRecipe)
}

/** "Recipes we think you'll like": friends' recipes resembling the user's favourites. */
export async function getRecommendedFriendRecipes(): Promise<FriendRecipe[]> {
  const supabase = await createClient()
  const [mine, candidates, profile] = await Promise.all([
    getRecipes(),
    supabase.rpc('friend_recipes', { p_query: null, p_limit: CANDIDATE_POOL }),
    getProfile(),
  ])
  if (candidates.error) { console.error('getRecommendedFriendRecipes error:', candidates.error); return [] }
  return recommendFromFriends(mine, candidates.data ?? [], profile).map(toFriendRecipe)
}

/** The user's recent search picks. Recipes they can no longer see drop out via RLS. */
export async function getSearchRecents(): Promise<RecentSearch[]> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('recipe_search_recents')
    .select('searched_at, recipe:recipes!inner(id, user_id, name, cuisine, image_url, gallery_images)')
    .eq('user_id', user.id)
    .order('searched_at', { ascending: false })
    .limit(RECENTS_LIMIT)
  if (error) { console.error('getSearchRecents error:', error); return [] }

  const rows = (data ?? []) as unknown as {
    searched_at: string
    recipe: { id: string; user_id: string; name: string; cuisine: string | null; image_url: string | null; gallery_images: string[] | null }
  }[]
  const ownerIds = [...new Set(rows.map(r => r.recipe.user_id).filter(id => id !== user.id))]
  const owners = new Map((await profilesByIds(supabase, ownerIds)).map(p => [p.id, p]))

  return rows.map(({ searched_at, recipe }) => {
    const owner = owners.get(recipe.user_id)
    return {
      id: recipe.id,
      name: recipe.name,
      cuisine: recipe.cuisine,
      image_url: recipe.image_url ?? recipe.gallery_images?.[0] ?? null,
      searched_at,
      mine: recipe.user_id === user.id,
      owner: owner?.username
        ? { username: owner.username, display_name: owner.display_name, avatar_url: owner.avatar_url }
        : null,
    }
  })
}

/** Add a recipe to the user's recents, or move it back to the top. */
export async function recordSearchRecent(recipeId: string): Promise<void> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return
  const { error } = await supabase
    .from('recipe_search_recents')
    .upsert(
      { user_id: user.id, recipe_id: recipeId, searched_at: new Date().toISOString() },
      { onConflict: 'user_id,recipe_id' },
    )
  if (error) throw new Error(error.message)
}

export async function removeSearchRecent(recipeId: string): Promise<void> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return
  const { error } = await supabase
    .from('recipe_search_recents')
    .delete()
    .eq('user_id', user.id)
    .eq('recipe_id', recipeId)
  if (error) throw new Error(error.message)
}
