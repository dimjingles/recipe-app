import { createClient } from '@/lib/supabase/server'
import { getRecipes } from '@/lib/db/recipes'
import { getWeekStart } from '@/lib/db/planner'
import PlannerView from '@/components/planner-view'

export default async function PlannerPage() {
  const supabase = await createClient()
  const weekStart = getWeekStart()

  const [{ data: plan }, recipes] = await Promise.all([
    supabase
      .from('weekly_plans')
      .select('*, weekly_plan_slots(*, recipe:recipes(*))')
      .eq('week_start', weekStart)
      .maybeSingle(),
    getRecipes(),
  ])

  return <PlannerView initialPlan={plan as any} recipes={recipes} weekStart={weekStart} />
}
