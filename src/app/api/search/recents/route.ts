import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { getSearchRecents, recordSearchRecent, removeSearchRecent } from '@/lib/db/search'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The search page's Recents: recipes the user opened or created from search.
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    return NextResponse.json(
      { results: await getSearchRecents() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** Body `{ recipe_id }` — add it to recents, or bump it to the top. */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { recipe_id } = await request.json()
    if (typeof recipe_id !== 'string' || !UUID.test(recipe_id)) {
      return NextResponse.json({ error: 'recipe_id is required' }, { status: 400 })
    }
    await recordSearchRecent(recipe_id)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/** `?recipe_id=` — remove one recent. */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const recipeId = request.nextUrl.searchParams.get('recipe_id') ?? ''
    if (!UUID.test(recipeId)) return NextResponse.json({ error: 'recipe_id is required' }, { status: 400 })
    await removeSearchRecent(recipeId)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
