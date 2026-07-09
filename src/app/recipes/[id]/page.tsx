import { createClient } from '@/lib/supabase/server'
import { getCookbooks } from '@/lib/db/cookbooks'
import { getProfile } from '@/lib/db/profile'
import { notFound } from 'next/navigation'
import RecipeDetail from '@/components/recipe-detail'
import { classifyTechniques, getTechniqueKeys } from '@/lib/ai/classify-techniques'

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: recipe }, cookbooks, profile, { data: techniques }, { data: variantRows }] = await Promise.all([
    supabase
      .from('recipes')
      .select('*, ingredients(*), cooking_log(*), cookbook_recipes(cookbook_id)')
      .eq('id', id)
      .single(),
    getCookbooks(),
    getProfile(),
    supabase.from('techniques').select('*').order('category').order('label'),
    supabase
      .from('recipes')
      .select('id, name, cuisine, adaptation_metadata')
      .eq('original_recipe_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!recipe) notFound()

  const variants = ((variantRows || []) as { id: string; name: string; cuisine: string | null; adaptation_metadata: { adaptation_type?: string } | null }[])
    .map(v => ({
      id: v.id,
      name: v.name,
      cuisine: v.cuisine,
      adaptation_type: v.adaptation_metadata?.adaptation_type ?? null,
    }))

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
      variants={variants}
    />
  )
}
