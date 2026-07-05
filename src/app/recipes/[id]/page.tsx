import { createClient } from '@/lib/supabase/server'
import { getCookbooks } from '@/lib/db/cookbooks'
import { getProfile } from '@/lib/db/profile'
import { notFound } from 'next/navigation'
import RecipeDetail from '@/components/recipe-detail'

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: recipe }, cookbooks, profile, { data: techniques }] = await Promise.all([
    supabase
      .from('recipes')
      .select('*, ingredients(*), cooking_log(*), cookbook_recipes(cookbook_id)')
      .eq('id', id)
      .single(),
    getCookbooks(),
    getProfile(),
    supabase.from('techniques').select('*').order('category').order('label'),
  ])

  if (!recipe) notFound()

  return (
    <RecipeDetail
      recipe={recipe as any}
      initialCookbooks={cookbooks}
      skillProfile={profile?.skill_profile ?? null}
      techniques={(techniques || []) as any}
    />
  )
}
