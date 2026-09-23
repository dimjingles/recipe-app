import { createClient, getUser } from '@/lib/supabase/server'
import { CookbookWithCount } from '@/types/database'

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

