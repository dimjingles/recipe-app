'use client'

import { useCookbooks, useMe, usePlan, usePlannerPatterns, useRecipes } from '@/lib/queries/hooks'
import { PageSkeleton, useAuthRedirect } from '@/components/cached-page'
import { normalizeSkillProfile } from '@/lib/skills'
import { getWeekStart } from '@/lib/week'
import PlannerView from '@/components/planner-view'

export default function PlannerClient() {
  const weekStart = getWeekStart()
  const plan = usePlan(weekStart)
  const recipes = useRecipes()
  const me = useMe()
  const patterns = usePlannerPatterns()
  const cookbooks = useCookbooks()
  useAuthRedirect(plan.error, recipes.error, me.error, patterns.error, cookbooks.error)

  // plan.data is legitimately null for an unplanned week — gate on the query
  // being settled (isPending), not on the value.
  if (plan.isPending || !recipes.data || !me.data || !patterns.data || !cookbooks.data) {
    return <PageSkeleton />
  }

  const profile = me.data.profile
  return (
    <PlannerView
      initialPlan={plan.data ?? null}
      recipes={recipes.data}
      weekStart={weekStart}
      profile={profile}
      skill={normalizeSkillProfile(profile?.skill_profile ?? null, profile?.skill_level)}
      patterns={patterns.data}
      cookbooks={cookbooks.data}
    />
  )
}
