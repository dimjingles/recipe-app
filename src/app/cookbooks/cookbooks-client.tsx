'use client'

import { useCookbooks, useRecipes } from '@/lib/queries/hooks'
import { PageSkeleton, useAuthRedirect } from '@/components/cached-page'
import CookbooksView from '@/components/cookbooks-view'

export default function CookbooksClient() {
  const cookbooks = useCookbooks()
  const recipes = useRecipes()
  useAuthRedirect(cookbooks.error, recipes.error)

  if (!cookbooks.data || !recipes.data) return <PageSkeleton />
  return <CookbooksView initialCookbooks={cookbooks.data} initialRecipes={recipes.data} />
}
