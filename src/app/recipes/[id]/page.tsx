import { createClient } from '@/lib/supabase/server'
import { getCookbooks } from '@/lib/db/cookbooks'
import { notFound } from 'next/navigation'
import RecipeDetail from '@/components/recipe-detail'

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: recipe }, cookbooks] = await Promise.all([
    supabase
      .from('recipes')
      .select('*, ingredients(*), cooking_log(*), cookbook_recipes(cookbook_id)')
      .eq('id', id)
      .single(),
    getCookbooks(),
  ])

  if (!recipe) notFound()

  return <RecipeDetail recipe={recipe as any} initialCookbooks={cookbooks} />
}
