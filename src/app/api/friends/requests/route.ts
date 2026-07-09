import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPendingRequests, getSentRequests } from '@/lib/db/social'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [incoming, sent] = await Promise.all([getPendingRequests(), getSentRequests()])
    return NextResponse.json({ incoming, sent })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
