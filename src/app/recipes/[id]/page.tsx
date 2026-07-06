import { createClient } from '@/lib/supabase/server'
import { getCookbooks } from '@/lib/db/cookbooks'
import { getProfile } from '@/lib/db/profile'
import { notFound } from 'next/navigation'
import RecipeDetail from '@/components/recipe-detail'
import { classifyTechniques, getTechniqueKeys } from '@/lib/ai/classify-techniques'

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

  // Cast once — Supabase join types collapse to never without this
  const r = recipe as any

  // Backfill techniques for recipes that predate classification
  if (!r.techniques?.length && r.instructions) {
    const keys = await getTechniqueKeys(supabase)
    const classified = await classifyTechniques(r.name, r.instructions, keys)
    if (classified.length) {
      const { error } = await supabase.from('recipes').update({ techniques: classified }).eq('id', id)
      if (!error) r.techniques = classified
    }
  }

  return (
    <RecipeDetail
      recipe={r}
      initialCookbooks={cookbooks}
      skillProfile={profile?.skill_profile ?? null}
      techniques={(techniques || []) as any}
    />
  )
}
