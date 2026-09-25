import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { getRecommendedFriendRecipes } from '@/lib/db/search'

// "Recipes we think you'll like" on the search page.
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    return NextResponse.json(
      { results: await getRecommendedFriendRecipes() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
