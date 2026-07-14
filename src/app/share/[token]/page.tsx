import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import PublicRecipeView from '@/components/public-recipe-view'

// Public, unauthenticated read-only recipe page. Reached via a share link the
// owner generates (/api/recipes/[id]/share-link). Reads run through the
// service-role client scoped strictly to the unguessable share_token, so no
// account or RLS grant is required — and nothing but this one recipe leaks.
//
// This path is allowlisted as public in src/lib/supabase/proxy.ts.

async function fetchSharedRecipe(token: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('recipes')
    .select('*, ingredients(*)')
    .eq('share_token', token)
    .single()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const recipe = await fetchSharedRecipe(token)
  if (!recipe) return { title: 'Recipe not found' }
  const title = `${recipe.name} · Preptable`
  const description = recipe.description ?? `A recipe shared with Preptable`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: recipe.image_url ? [recipe.image_url] : undefined,
    },
  }
}

export default async function SharedRecipePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const recipe = await fetchSharedRecipe(token)
  if (!recipe) notFound()

  return <PublicRecipeView recipe={recipe as any} />
}
