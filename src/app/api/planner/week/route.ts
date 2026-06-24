import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const weekStart = request.nextUrl.searchParams.get('week_start')
    if (!weekStart) return NextResponse.json({ error: 'week_start required' }, { status: 400 })

    const { data: plan } = await supabase
      .from('weekly_plans')
      .select('*, weekly_plan_slots(*, recipe:recipes(*))')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle()

    return NextResponse.json({ plan })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
