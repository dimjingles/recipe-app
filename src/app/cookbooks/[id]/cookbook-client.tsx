'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useCookbooks, useRecipes } from '@/lib/queries/hooks'
import { DetailSkeleton, useAuthRedirect } from '@/components/cached-page'
import CookbookDetailView from '@/components/cookbook-detail-view'
import { computeScores } from '@/lib/scoring'
import type { CookbookWithRecipes, RecipeSummary } from '@/types/database'

// One of the user's own cookbooks, assembled from the cached cookbook list and
// recipe library — no server round-trip. (Friends' cookbooks live under
// /u/[username]/cookbooks/[id].)
export default function CookbookClient({ id }: { id: string }) {
  const cookbooks = useCookbooks()
  const recipes = useRecipes()
  useAuthRedirect(cookbooks.error, recipes.error)

  const cookbook = useMemo((): CookbookWithRecipes | null => {
    const cb = cookbooks.data?.find(c => c.id === id)
    if (!cb || !recipes.data) return null
    const byId = new Map(recipes.data.map(r => [r.id, r]))
    return {
      ...cb,
      cookbook_recipes: cb.cookbook_recipes
        .map(cr => byId.get(cr.recipe_id))
        .filter((r): r is NonNullable<typeof r> => !!r)
        .map(recipe => ({ recipe: recipe as RecipeSummary })),
    }
  }, [cookbooks.data, recipes.data, id])

  const scores = useMemo(
    () => computeScores((recipes.data ?? []).map(r => ({
      id: r.id,
      rank: r.rank,
      feedback: r.feedback,
      recipeType: r.recipe_type,
    }))),
    [recipes.data],
  )

  if (!cookbooks.data || !recipes.data) return <DetailSkeleton />
  if (!cookbook) {
    return (
      <div className="mx-auto max-w-lg px-5 pt-24 text-center">
        <p className="font-heading text-2xl font-bold text-foreground">Cookbook not found</p>
        <Link href="/cookbooks" className="mt-6 inline-block text-sm font-bold text-brand">Back to cookbooks</Link>
      </div>
    )
  }
  // Remount when switching cookbooks: the view seeds local state from props.
  return <CookbookDetailView key={cookbook.id} cookbook={cookbook} canManage scores={scores} />
}
