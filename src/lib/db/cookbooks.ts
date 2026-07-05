import { createClient } from '@/lib/supabase/server'
import { Cookbook, CookbookWithCount, CookbookWithRecipes } from '@/types/database'

export async function getCookbooks(): Promise<CookbookWithCount[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('cookbooks')
    .select('*, cookbook_recipes(recipe_id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) { console.error(error); return [] }
  return data as CookbookWithCount[]
}

export async function getCookbook(id: string): Promise<CookbookWithRecipes | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('cookbooks')
    .select('*, cookbook_recipes(recipe:recipes(*))')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) { console.error(error); return null }
  return data as CookbookWithRecipes
}

export async function createCookbook(name: string, recipeIds: string[] = []): Promise<Cookbook> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: cookbook, error: cbError } = await supabase
    .from('cookbooks')
    .insert({ user_id: user.id, name })
    .select()
    .single()

  if (cbError) throw cbError

  if (recipeIds.length > 0) {
    const { error: joinError } = await supabase
      .from('cookbook_recipes')
      .insert(recipeIds.map(recipe_id => ({ cookbook_id: cookbook.id, recipe_id })))
    if (joinError) throw joinError
  }

  return cookbook as Cookbook
}

export async function renameCookbook(id: string, name: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('cookbooks')
    .update({ name })
    .eq('id', id)
  if (error) throw error
}

export async function deleteCookbook(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('cookbooks').delete().eq('id', id)
  if (error) throw error
}

export async function addRecipeToCookbook(cookbookId: string, recipeId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('cookbook_recipes')
    .insert({ cookbook_id: cookbookId, recipe_id: recipeId })
  if (error) throw error
}

export async function removeRecipeFromCookbook(cookbookId: string, recipeId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('cookbook_recipes')
    .delete()
    .eq('cookbook_id', cookbookId)
    .eq('recipe_id', recipeId)
  if (error) throw error
}

/**
 * Replace all cookbook memberships for a recipe: delete the recipe from all of the
 * user's cookbooks, then re-insert only the provided cookbook IDs.
 */
export async function setRecipeCookbooks(recipeId: string, cookbookIds: string[]): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get all cookbook IDs owned by this user
  const { data: userCookbooks } = await supabase
    .from('cookbooks')
    .select('id')
    .eq('user_id', user.id)

  const userCookbookIds = (userCookbooks || []).map((c: { id: string }) => c.id)

  if (userCookbookIds.length > 0) {
    await supabase
      .from('cookbook_recipes')
      .delete()
      .eq('recipe_id', recipeId)
      .in('cookbook_id', userCookbookIds)
  }

  if (cookbookIds.length > 0) {
    const { error } = await supabase
      .from('cookbook_recipes')
      .insert(cookbookIds.map(cookbook_id => ({ cookbook_id, recipe_id: recipeId })))
    if (error) throw error
  }
}
