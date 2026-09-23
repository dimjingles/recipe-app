import RecipeDetailClient from './recipe-detail-client'

// A thin shell: the recipe renders from the client query cache (see
// RecipeDetailClient), so navigating here does no server-side data fetching.
export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RecipeDetailClient id={id} />
}
