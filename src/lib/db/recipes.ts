import { createClient } from '@/lib/supabase/server'
import { RecipeWithIngredients, RecipeWithDetails } from '@/types/database'
import { emitActivity } from '@/lib/db/activity'
import { computeScores, type RankedInput } from '@/lib/scoring'

export async function getRecipes() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Library = the user's own recipes + any household-shared recipes. We filter
  // explicitly (not just via RLS) so friend-visible recipes never leak in here.
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .maybeSingle()
  const householdId = membership?.household_id ?? null

  let query = supabase.from('recipes').select('*, ingredients(*), cookbook_recipes(cookbook_id)')
  query = householdId
    ? query.or(`user_id.eq.${user.id},and(owner_scope.eq.household,household_id.eq.${householdId})`)
    : query.eq('user_id', user.id)

  const [{ data, error }, { data: rankRows }] = await Promise.all([
    query,
    supabase.from('recipe_rankings').select('recipe_id, rank').eq('user_id', user.id),
  ])
  if (error) { console.error(error); return [] }

  // Order by the CURRENT user's personal ranking, then newest-first.
  const ranks = new Map((rankRows ?? []).map(r => [r.recipe_id, r.rank]))
  const recipes = (data ?? []).map(r => ({ ...r, rank: ranks.get(r.id) ?? null }))
  recipes.sort((a, b) => {
    if (a.rank != null && b.rank != null) return a.rank - b.rank
    if (a.rank != null) return -1
    if (b.rank != null) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  return recipes as unknown as RecipeWithIngredients[]
}

/** Map of recipe id → 0.0–10.0 score for the current user's ranked recipes,
 *  grouped and spread within each feedback tier. Rank is per-user (recipe_rankings)
 *  so household members score the same shared recipe independently; the tier
 *  (feedback) is a property of the recipe. */
export async function getRankedScores(): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data, error } = await supabase
    .from('recipe_rankings')
    .select('recipe_id, rank, recipe:recipes(feedback)')
    .eq('user_id', user.id)

  if (error) { console.error(error); return {} }
  const input: RankedInput[] = (data ?? []).map((r: any) => ({
    id: r.recipe_id,
    rank: r.rank,
    feedback: r.recipe?.feedback ?? null,
  }))
  return computeScores(input)
}

export async function getRecipe(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('recipes')
    .select('*, ingredients(*), cooking_log(*)')
    .eq('id', id)
    .single()

  if (error) { console.error(error); return null }

  const recipe = data as RecipeWithDetails
  // rank shown on the detail page is the current user's personal rank.
  if (user) {
    const { data: ranking } = await supabase
      .from('recipe_rankings')
      .select('rank')
      .eq('user_id', user.id)
      .eq('recipe_id', id)
      .maybeSingle()
    recipe.rank = ranking?.rank ?? null
  } else {
    recipe.rank = null
  }
  return recipe
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
  const { data: { user } } = await supabase.auth.getUser()
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
  const { data: { user } } = await supabase.auth.getUser()
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
