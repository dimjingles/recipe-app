'use client'

import { useCookbooks, useMe, useRecipes } from '@/lib/queries/hooks'
import { PageSkeleton, useAuthRedirect } from '@/components/cached-page'
import RecipeLibrary from '@/components/recipe-library'

export default function RecipesClient() {
  const recipes = useRecipes()
  const cookbooks = useCookbooks()
  const me = useMe()
  useAuthRedirect(recipes.error, cookbooks.error, me.error)

  if (!recipes.data || !cookbooks.data || !me.data) return <PageSkeleton />
  return (
    <RecipeLibrary
      initialRecipes={recipes.data}
      initialCookbooks={cookbooks.data}
      hasHousehold={!!me.data.household_id}
      initialSortPreference={me.data.profile?.recipe_sort_preference ?? 'ranking'}
      initialSortDirection={me.data.profile?.recipe_sort_direction ?? 'default'}
    />
  )
}
