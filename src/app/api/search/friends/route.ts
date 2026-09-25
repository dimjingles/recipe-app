import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { searchFriendRecipes } from '@/lib/db/search'

// Friends' shared recipes matching ?q= (name, cuisine or an ingredient).
export async function GET(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = request.nextUrl.searchParams.get('q') ?? ''
    return NextResponse.json(
      { results: await searchFriendRecipes(q) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
