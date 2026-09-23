'use client'

import { useMemo } from 'react'
import { useCookbooks, useMe, usePlannerPatterns, useRecipes } from '@/lib/queries/hooks'
import { PageSkeleton, useAuthRedirect } from '@/components/cached-page'
import { normalizeSkillProfile } from '@/lib/skills'
import { getWeekStart } from '@/lib/week'
import PlannerView from '@/components/planner-view'

export default function PlannerClient() {
  const weekStart = getWeekStart()
  const recipes = useRecipes()
  const me = useMe()
  const patterns = usePlannerPatterns()
  const cookbooks = useCookbooks()
  useAuthRedirect(recipes.error, me.error, patterns.error, cookbooks.error)

  // Stable across background refetches that don't change the profile, so the
  // planner's scoring memos don't recompute on every render.
  const profile = me.data?.profile ?? null
  const skill = useMemo(
    () => normalizeSkillProfile(profile?.skill_profile ?? null, profile?.skill_level),
    [profile],
  )

  // The week's plan is loaded inside PlannerView (it changes with week
  // navigation) and shows its own shimmer while pending.
  if (!recipes.data || !me.data || !patterns.data || !cookbooks.data) {
    return <PageSkeleton />
  }

  return (
    <PlannerView
      recipes={recipes.data}
      weekStart={weekStart}
      profile={profile}
      skill={skill}
      patterns={patterns.data}
      cookbooks={cookbooks.data}
    />
  )
}
