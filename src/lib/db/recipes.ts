import { createClient, getUser } from '@/lib/supabase/server'
import type { RecipeListItem, RecipeWithDetails, RecipeWithIngredients } from '@/types/database'
import { RECIPE_SUMMARY_COLUMNS } from '@/lib/recipe-columns'
import { emitActivity } from '@/lib/db/activity'
import { computeScores, type RankedInput } from '@/lib/scoring'

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

/** Map of recipe id → 0.0–10.0 score for the current user's ranked recipes,
 *  grouped and spread within each (recipe type, feedback tier) pool. Rank is
 *  per-user (recipe_rankings); the tier and type are properties of the recipe. */
export async function getRankedScores(): Promise<Record<string, number>> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return {}

  const { data, error } = await supabase
    .from('recipe_rankings')
    .select('recipe_id, rank, recipe:recipes(feedback, recipe_type)')
    .eq('user_id', user.id)

  if (error) { console.error(error); return {} }
  const input: RankedInput[] = (data ?? []).map((r: any) => ({
    id: r.recipe_id,
    rank: r.rank,
    feedback: r.recipe?.feedback ?? null,
    recipeType: r.recipe?.recipe_type ?? null,
  }))
  return computeScores(input)
}

export async function getRecipe(id: string) {
  const supabase = await createClient()
  const user = await getUser()

  // rank shown on the detail page is the current user's personal rank.
  const [{ data, error }, ranking] = await Promise.all([
    supabase
      .from('recipes')
      .select('*, ingredients(*), cooking_log(*)')
      .eq('id', id)
      .single(),
    user
      ? supabase
          .from('recipe_rankings')
          .select('rank')
          .eq('user_id', user.id)
          .eq('recipe_id', id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (error) { console.error(error); return null }

  const recipe = data as RecipeWithDetails
  recipe.rank = ranking.data?.rank ?? null
  return recipe
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

export async function createRecipe(recipe: {
  name: string
  description?: string
  cuisine?: string
  cook_time_minutes?: number
  servings?: number
  instructions?: string
  difficulty?: number
  image_url?: string
  tags?: string[]
  ingredients: Array<{ name: string; quantity?: string; unit?: string; category?: string }>
}) {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) throw new Error('Not authenticated')

  const { ingredients, ...recipeData } = recipe

  const { data: newRecipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      user_id: user.id,
      name: recipeData.name,
      description: recipeData.description ?? null,
      cuisine: recipeData.cuisine ?? null,
      cook_time_minutes: recipeData.cook_time_minutes ?? null,
      servings: recipeData.servings ?? 4,
      instructions: recipeData.instructions ?? null,
      difficulty: recipeData.difficulty ?? null,
      image_url: recipeData.image_url ?? null,
      tags: recipeData.tags ?? [],
    })
    .select()
    .single()

  if (recipeError) throw recipeError

  if (ingredients.length > 0) {
    const { error: ingError } = await supabase
      .from('ingredients')
      .insert(ingredients.map(i => ({
        recipe_id: newRecipe.id,
        name: i.name,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
        category: i.category ?? null,
      })))
    if (ingError) throw ingError
  }

  await emitActivity('recipe_created', { recipe_id: newRecipe.id })
  return newRecipe
}

export async function updateRecipe(id: string, recipe: {
  name?: string
  description?: string
  cuisine?: string
  cook_time_minutes?: number
  servings?: number
  instructions?: string
  image_url?: string
  tags?: string[]
  ingredients?: Array<{ name: string; quantity?: string; unit?: string; category?: string }>
}) {
  const supabase = await createClient()

  const { ingredients, ...recipeData } = recipe

  const { data, error } = await supabase
    .from('recipes')
    .update(recipeData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  if (ingredients !== undefined) {
    await supabase.from('ingredients').delete().eq('recipe_id', id)
    if (ingredients.length > 0) {
      await supabase.from('ingredients').insert(
        ingredients.map(i => ({
          recipe_id: id,
          name: i.name,
          quantity: i.quantity ?? null,
          unit: i.unit ?? null,
          category: i.category ?? null,
        }))
      )
    }
  }

  return data
}

export async function deleteRecipe(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('recipes').delete().eq('id', id)
  if (error) throw error
}

export async function logCooking(recipeId: string, data: {
  notes?: string
  cooked_at?: string
}) {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) throw new Error('Not authenticated')

  // Insert log entry
  const { error: logError } = await supabase.from('cooking_log').insert({
    recipe_id: recipeId,
    user_id: user.id,
    notes: data.notes ?? null,
    cooked_at: data.cooked_at,
  })
  if (logError) throw logError

  // Update recipe cooked_count and last_cooked_at
  const { data: recipe } = await supabase
    .from('recipes')
    .select('cooked_count')
    .eq('id', recipeId)
    .single()

  await supabase.from('recipes').update({
    cooked_count: (recipe?.cooked_count ?? 0) + 1,
    last_cooked_at: data.cooked_at ?? new Date().toISOString(),
  }).eq('id', recipeId)

  await emitActivity('recipe_cooked', { recipe_id: recipeId })
}
