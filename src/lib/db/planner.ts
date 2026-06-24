import { createClient } from '@/lib/supabase/server'
import { PlanWithSlots } from '@/types/database'
import { startOfWeek, format } from 'date-fns'

export function getWeekStart(date: Date = new Date()): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

export async function getWeekPlan(weekStart: string): Promise<PlanWithSlots | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('weekly_plans')
    .select('*, weekly_plan_slots(*, recipe:recipes(*))')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .single()

  if (error) return null
  return data as PlanWithSlots
}

export async function upsertSlot(weekStart: string, dayOfWeek: number, recipeId: string, mealType = 'dinner') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get or create plan for this week
  let { data: plan } = await supabase
    .from('weekly_plans')
    .select('id')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .single()

  if (!plan) {
    const { data: newPlan, error } = await supabase
      .from('weekly_plans')
      .insert({ user_id: user.id, week_start: weekStart })
      .select('id')
      .single()
    if (error) throw error
    plan = newPlan
  }

  // Remove existing slot for this day+meal (replace mode)
  await supabase
    .from('weekly_plan_slots')
    .delete()
    .eq('plan_id', plan.id)
    .eq('day_of_week', dayOfWeek)
    .eq('meal_type', mealType)

  // Insert new slot
  const { error } = await supabase.from('weekly_plan_slots').insert({
    plan_id: plan.id,
    recipe_id: recipeId,
    day_of_week: dayOfWeek,
    meal_type: mealType,
  })
  if (error) throw error
}

export async function removeSlot(slotId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('weekly_plan_slots').delete().eq('id', slotId)
  if (error) throw error
}
