import { createClient } from '@/lib/supabase/server'
import { getRecipes } from '@/lib/db/recipes'
import { getWeekStart, getCookingPatterns } from '@/lib/db/planner'
import { getProfile } from '@/lib/db/profile'
import { normalizeSkillProfile } from '@/lib/skills'
import PlannerView from '@/components/planner-view'

export default async function PlannerPage() {
  const supabase = await createClient()
  const weekStart = getWeekStart()

  const [{ data: plan }, recipes, profile, patterns, { data: cookbooks }] = await Promise.all([
    supabase
      .from('weekly_plans')
      .select('*, weekly_plan_slots(*, recipe:recipes(*))')
      .eq('week_start', weekStart)
      .maybeSingle(),
    getRecipes(),
    getProfile(),
    getCookingPatterns(),
    supabase.from('cookbooks').select('id, name'),
  ])

  const skill = normalizeSkillProfile(profile?.skill_profile, profile?.skill_level)

  return (
    <PlannerView
      initialPlan={plan as any}
      recipes={recipes}
      weekStart={weekStart}
      profile={profile}
      skill={skill}
      patterns={patterns}
      cookbooks={cookbooks || []}
    />
  )
}
