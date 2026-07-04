import { createClient } from '@/lib/supabase/server'
import { RecipeWithIngredients, RecipeWithDetails } from '@/types/database'

export async function getRecipes() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('recipes')
    .select('*, ingredients(*)')
    .eq('user_id', user.id)
    .order('rank', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) { console.error(error); return [] }
  return data as RecipeWithIngredients[]
}

export async function getRecipe(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('recipes')
    .select('*, ingredients(*), cooking_log(*)')
    .eq('id', id)
    .single()

  if (error) { console.error(error); return null }
  return data as RecipeWithDetails
}

export async function createRecipe(recipe: {
  name: string
  description?: string
  cuisine?: string
  cook_time_minutes?: number
  servings?: number
  instructions?: string
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
}
