'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useCookbooks, useMe, useRecipe, useRecipes, useTechniques } from '@/lib/queries/hooks'
import { DetailSkeleton, useAuthRedirect } from '@/components/cached-page'
import RecipeDetail from '@/components/recipe-detail'
import { computeScores } from '@/lib/scoring'

/**
 * The recipe page, rendered from the client query cache: a recipe opened before
 * shows instantly (and revalidates in the background), and the cookbooks,
 * skill profile, scores and technique catalogue come from queries the app
 * already holds instead of being re-queried on the server for every visit.
 */
export default function RecipeDetailClient({ id }: { id: string }) {
  const detail = useRecipe(id)
  const cookbooks = useCookbooks()
  const me = useMe()
  const recipes = useRecipes()
  const techniques = useTechniques()
  useAuthRedirect(detail.error, cookbooks.error, me.error, recipes.error)

  // Same 0–10 scores as the library: the user's own ranked recipes, grouped by
  // (type, tier). A friend's recipe has no score.
  const scores = useMemo(
    () => computeScores((recipes.data ?? []).map(r => ({
      id: r.id,
      rank: r.rank,
      feedback: r.feedback,
      recipeType: r.recipe_type,
    }))),
    [recipes.data],
  )

  if (detail.isError && !detail.data) {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-24 text-center">
        <p className="font-heading text-2xl font-bold text-foreground">Recipe not found</p>
        <p className="mt-2 text-sm text-muted-foreground">It may have been deleted or made private.</p>
        <Link href="/recipes" className="mt-6 inline-block text-sm font-bold text-brand">Back to recipes</Link>
      </div>
    )
  }
  if (!detail.data || !cookbooks.data || !me.data) return <DetailSkeleton />

  const { recipe, variants, isOwner } = detail.data
  return (
    <RecipeDetail
      // Remount per recipe: the view seeds local state (gallery, logs, …) from props.
      key={recipe.id}
      recipe={recipe}
      initialCookbooks={cookbooks.data}
      skillProfile={me.data.profile?.skill_profile ?? null}
      techniques={techniques.data ?? []}
      // Only the owner can edit; anyone else (a friend browsing) is read-only.
      readOnly={!isOwner}
      variants={variants}
      score={scores[recipe.id] ?? null}
    />
  )
}
