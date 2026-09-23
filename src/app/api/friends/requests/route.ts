import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { getFriendGraph } from '@/lib/db/social'

export async function GET() {
  try {
  const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { incoming, sent } = await getFriendGraph()
    return NextResponse.json({ incoming, sent })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
