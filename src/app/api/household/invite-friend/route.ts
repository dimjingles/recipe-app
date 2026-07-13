import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMyHouseholdId, inviteHouseholdFriend } from '@/lib/db/households'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { friend_id } = await request.json()
    if (!friend_id || typeof friend_id !== 'string') {
      return NextResponse.json({ error: 'friend_id is required' }, { status: 400 })
    }

    const householdId = await getMyHouseholdId()
    if (!householdId) return NextResponse.json({ error: 'You are not in a household' }, { status: 400 })

    const member = await inviteHouseholdFriend(householdId, friend_id)
    return NextResponse.json({ member })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
