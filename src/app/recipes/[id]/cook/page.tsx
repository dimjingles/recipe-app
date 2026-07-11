import { notFound } from 'next/navigation'
import { getRecipe } from '@/lib/db/recipes'
import { getProfile } from '@/lib/db/profile'
import { chefPreferencesFromProfile } from '@/lib/cook/chef-preferences'
import CookMode from '@/components/cook/cook-mode'

export default async function CookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [recipe, profile] = await Promise.all([getRecipe(id), getProfile()])
  if (!recipe) notFound()

  const chef = chefPreferencesFromProfile(profile)

  return <CookMode recipe={recipe} voiceURI={chef.voiceURI} pacing={chef.pacing} />
}
