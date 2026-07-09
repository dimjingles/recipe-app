import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFeed } from '@/lib/db/activity'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const cursor = request.nextUrl.searchParams.get('cursor') ?? undefined
    return NextResponse.json(await getFeed(cursor))
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
