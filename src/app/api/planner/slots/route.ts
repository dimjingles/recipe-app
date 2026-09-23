import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { weekStart, dayOfWeek, recipeId, mealType = 'dinner' } = await request.json()

    // Get or create the week's plan in one statement.
    const { data: plan, error: planError } = await supabase
      .from('weekly_plans')
      .upsert({ user_id: user.id, week_start: weekStart }, { onConflict: 'user_id,week_start' })
      .select('id')
      .single()
    if (planError) throw planError

    // One recipe per day + meal: replace whatever was there.
    const { error } = await supabase
      .from('weekly_plan_slots')
      .upsert(
        { plan_id: plan.id, recipe_id: recipeId, day_of_week: dayOfWeek, meal_type: mealType },
        { onConflict: 'plan_id,day_of_week,meal_type' },
      )
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Body: { slotId } or { slotIds: [...] } (e.g. undoing an auto-fill in one call).
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { slotId, slotIds } = await request.json()
    const ids: string[] = Array.isArray(slotIds) ? slotIds : slotId ? [slotId] : []
    if (!ids.length) return NextResponse.json({ error: 'slotId required' }, { status: 400 })

    const { error } = await supabase.from('weekly_plan_slots').delete().in('id', ids)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
