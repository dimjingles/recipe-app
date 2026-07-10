import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isFeedback } from '@/lib/scoring'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Optional tier filter — recipes are ranked only within their own tier.
    const feedback = request.nextUrl.searchParams.get('feedback')

    let query = supabase
      .from('recipes')
      .select('id, name, cuisine, rank, feedback')
      .eq('user_id', user.id)
      .not('rank', 'is', null)

    if (isFeedback(feedback)) query = query.eq('feedback', feedback)
    else if (feedback === 'none') query = query.is('feedback', null)

    const { data, error } = await query.order('rank', { ascending: true })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
