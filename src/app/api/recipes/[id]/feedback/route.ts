import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { isFeedback } from '@/lib/scoring'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { feedback } = await request.json()
    // `null` clears the feedback; otherwise it must be a valid category.
    if (feedback !== null && !isFeedback(feedback)) {
      return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 })
    }

    const { error } = await supabase
      .from('recipes')
      .update({ feedback })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true, feedback })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
