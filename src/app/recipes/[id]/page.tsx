import { createClient, getUser } from '@/lib/supabase/server'
import { getCookbooks } from '@/lib/db/cookbooks'
import { getRankedScores } from '@/lib/db/recipes'
import { getProfile } from '@/lib/db/profile'
import { notFound } from 'next/navigation'
import RecipeDetail from '@/components/recipe-detail'
import { classifyTechniques, getTechniqueKeys } from '@/lib/ai/classify-techniques'

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getUser()

  const [{ data: recipe }, cookbooks, profile, { data: techniques }, { data: ranking }, { data: membership }, { data: variantRows }, scores] = await Promise.all([
    supabase
      .from('recipes')
      .select('*, ingredients(*), cooking_log(*), cookbook_recipes(cookbook_id)')
      .eq('id', id)
      .single(),
    getCookbooks(),
    getProfile(),
    supabase.from('techniques').select('*').order('category').order('label'),
    user
      ? supabase.from('recipe_rankings').select('rank').eq('user_id', user.id).eq('recipe_id', id).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from('household_members').select('household_id').eq('user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('recipes')
      .select('id, name, cuisine, adaptation_metadata')
      .eq('original_recipe_id', id)
      .order('created_at', { ascending: false }),
    getRankedScores(),
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
  // rank shown on the detail page is the CURRENT user's personal rank.
  r.rank = (ranking as { rank: number } | null)?.rank ?? null
  const myHouseholdId = (membership as { household_id: string } | null)?.household_id ?? null
  const isOwner = !!user && r.user_id === user.id
  const hasHousehold = !!myHouseholdId
  // A household member can edit shared recipes; anyone else (a friend browsing) is read-only.
  const canEdit = isOwner || (r.owner_scope === 'household' && !!r.household_id && r.household_id === myHouseholdId)
  const readOnly = !canEdit

  // Backfill techniques for recipes that predate classification (owner/household only)
  if (!readOnly && !r.techniques?.length && r.instructions) {
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
      isOwner={isOwner}
      hasHousehold={hasHousehold}
      readOnly={readOnly}
      variants={variants}
      score={scores[id] ?? null}
    />
  )
}
