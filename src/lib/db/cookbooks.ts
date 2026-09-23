import { createClient, getUser } from '@/lib/supabase/server'
import { Cookbook, CookbookWithCount, CookbookWithRecipes } from '@/types/database'
import { emitActivity } from '@/lib/db/activity'
import { RECIPE_SUMMARY_COLUMNS } from '@/lib/recipe-columns'

export async function getCookbooks(): Promise<CookbookWithCount[]> {
  const supabase = await createClient()
  const user = await getUser()
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
  const user = await getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('cookbooks')
    .select(`*, cookbook_recipes(recipe:recipes(${RECIPE_SUMMARY_COLUMNS}))`)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (error) { console.error(error); return null }
  return data as unknown as CookbookWithRecipes
}

export async function createCookbook(name: string, recipeIds: string[] = []): Promise<Cookbook> {
  const supabase = await createClient()
  const user = await getUser()
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

  await emitActivity('cookbook_created', { cookbook_id: cookbook.id })
  return cookbook as Cookbook
}

export async function deleteCookbook(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('cookbooks').delete().eq('id', id)
  if (error) throw error
}

