import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { weekStart, dayOfWeek, recipeId, mealType = 'dinner' } = await request.json()

    // Get or create plan
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

    // Remove existing slot for this day+meal
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

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { slotId } = await request.json()
    await supabase.from('weekly_plan_slots').delete().eq('id', slotId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
