import { createClient, getUser } from '@/lib/supabase/server'
import { getCookbooks } from '@/lib/db/cookbooks'
import { getRankedScores } from '@/lib/db/recipes'
import { getProfile } from '@/lib/db/profile'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import RecipeDetail from '@/components/recipe-detail'
import { classifyTechniques, getTechniqueKeys } from '@/lib/ai/classify-techniques'

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getUser()

  const [{ data: recipe }, cookbooks, profile, { data: techniques }, { data: ranking }, { data: variantRows }, scores] = await Promise.all([
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
  const isOwner = !!user && r.user_id === user.id
  // Only the owner can edit; anyone else (a friend browsing) is read-only.
  const readOnly = !isOwner

  // Backfill techniques for recipes that predate classification (owner only).
  // This calls the Anthropic API (~1-2s), so it runs via after() once the
  // response has streamed — the first open renders without techniques and they
  // appear on the next visit, instead of blocking navigation on an LLM call.
  if (!readOnly && !r.techniques?.length && r.instructions) {
    const name = r.name as string
    const instructions = r.instructions as string
    after(async () => {
      try {
        const keys = await getTechniqueKeys(supabase)
        const classified = await classifyTechniques(name, instructions, keys)
        if (classified.length) {
          await supabase.from('recipes').update({ techniques: classified }).eq('id', id)
        }
      } catch (e) {
        console.error('technique backfill failed:', e)
      }
    })
  }

  return (
    <RecipeDetail
      recipe={r}
      initialCookbooks={cookbooks}
      skillProfile={profile?.skill_profile ?? null}
      techniques={(techniques || []) as any}
      readOnly={readOnly}
      variants={variants}
      score={scores[id] ?? null}
    />
  )
}
