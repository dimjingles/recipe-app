import { createClient, getUser } from '@/lib/supabase/server'
import type { RecipeListItem, RecipeWithIngredients } from '@/types/database'
import { RECIPE_SUMMARY_COLUMNS } from '@/lib/recipe-columns'

export async function getRecipes(): Promise<RecipeListItem[]> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return []

  // Library = the user's own recipes. We filter explicitly (not just via RLS)
  // so friend-visible recipes never leak in here. One round-trip: the caller's
  // ranking row (RLS limits recipe_rankings to their own) and ingredient names
  // (for planner allergy matching) ride along as embeds. List views never
  // render instructions/steps, so RECIPE_SUMMARY_COLUMNS leaves them out.
  const { data, error } = await supabase
    .from('recipes')
    .select(`${RECIPE_SUMMARY_COLUMNS}, ingredients(name), cookbook_recipes(cookbook_id), recipe_rankings(rank, user_id)`)
    .eq('user_id', user.id)
  if (error) { console.error(error); return [] }

  // Order by the CURRENT user's personal ranking, then newest-first.
  const recipes = ((data ?? []) as any[]).map(({ recipe_rankings, ...r }) => ({
    ...r,
    rank: (recipe_rankings as { rank: number; user_id: string }[] | null)
      ?.find(x => x.user_id === user.id)?.rank ?? null,
  })) as RecipeListItem[]
  recipes.sort((a, b) => {
    if (a.rank != null && b.rank != null) return a.rank - b.rank
    if (a.rank != null) return -1
    if (b.rank != null) return 1
    return b.created_at.localeCompare(a.created_at)
  })
  return recipes
}

/**
 * A recipe with its ingredients, for the AI routes (chat, adapt, instructions,
 * cook mode) — skips the cooking log and the personal-rank lookup they never use.
 */
export async function getRecipeForAI(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recipes')
    .select('*, ingredients(*)')
    .eq('id', id)
    .single()
  if (error) { console.error(error); return null }
  return data as RecipeWithIngredients
}

