import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { resetInviteToken } from '@/lib/db/invites'

// Replace the caller's invite link. The old /invite/<token> stops working;
// anyone who already joined through it stays a friend.
export async function POST() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = await resetInviteToken()
    return NextResponse.json({ token }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
