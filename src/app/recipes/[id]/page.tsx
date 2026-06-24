import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import RecipeDetail from '@/components/recipe-detail'

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: recipe } = await supabase
    .from('recipes')
    .select('*, ingredients(*), cooking_log(*)')
    .eq('id', id)
    .single()

  if (!recipe) notFound()

  return <RecipeDetail recipe={recipe as any} />
}
