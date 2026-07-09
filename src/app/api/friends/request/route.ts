import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendFriendRequest } from '@/lib/db/social'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { target_id } = await request.json()
    if (!target_id) return NextResponse.json({ error: 'target_id is required' }, { status: 400 })
    if (target_id === user.id) return NextResponse.json({ error: 'Cannot friend yourself' }, { status: 400 })

    await sendFriendRequest(target_id)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
