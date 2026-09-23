import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { isFeedback } from '@/lib/scoring'

// Log a cook. Optional `feedback` (like/okay/dislike, or null to clear) is saved
// in the same call. The log_cook() RPC does the whole write — log row, atomic
// cooked_count bump, mastered techniques, activity — in one round-trip.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const setFeedback = 'feedback' in body
    if (setFeedback && body.feedback !== null && !isFeedback(body.feedback)) {
      return NextResponse.json({ error: 'Invalid feedback' }, { status: 400 })
    }

    const { error } = await supabase.rpc('log_cook', {
      p_recipe_id: id,
      p_cooked_at: body.cooked_at || new Date().toISOString(),
      p_notes: body.notes ?? null,
      p_set_feedback: setFeedback,
      p_feedback: setFeedback ? body.feedback : null,
    })
    if (error) {
      if (error.code === 'P0002') return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
