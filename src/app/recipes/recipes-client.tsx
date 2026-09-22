'use client'

import { useSearchParams } from 'next/navigation'
import { useCookbooks, useMe, useRecipes } from '@/lib/queries/hooks'
import { PageSkeleton, useAuthRedirect } from '@/components/cached-page'
import RecipeLibrary from '@/components/recipe-library'

export default function RecipesClient() {
  const recipes = useRecipes()
  const cookbooks = useCookbooks()
  const me = useMe()
  // The profile page links straight into a tab via ?tab=cooked / ?tab=want-to-try.
  const tab = useSearchParams().get('tab')
  useAuthRedirect(recipes.error, cookbooks.error, me.error)

  if (!recipes.data || !cookbooks.data || !me.data) return <PageSkeleton />
  return (
    <RecipeLibrary
      initialRecipes={recipes.data}
      initialCookbooks={cookbooks.data}
      initialCategory={tab === 'want-to-try' ? 'bookmarked' : 'cooked'}
      initialSortPreference={me.data.profile?.recipe_sort_preference ?? 'ranking'}
      initialSortDirection={me.data.profile?.recipe_sort_direction ?? 'default'}
      initialTypeFilter={me.data.profile?.recipe_type_filter ?? 'main'}
    />
  )
}
