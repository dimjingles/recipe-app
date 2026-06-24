import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditRecipeForm from '@/components/edit-recipe-form'

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: recipe } = await supabase
    .from('recipes')
    .select('*, ingredients(*)')
    .eq('id', id)
    .single()

  if (!recipe) notFound()
  return <EditRecipeForm recipe={recipe as any} />
}
