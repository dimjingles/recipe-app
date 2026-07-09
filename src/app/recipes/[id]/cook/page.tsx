import { notFound } from 'next/navigation'
import { getRecipe } from '@/lib/db/recipes'
import CookMode from '@/components/cook/cook-mode'

export default async function CookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const recipe = await getRecipe(id)
  if (!recipe) notFound()

  return <CookMode recipe={recipe} />
}
