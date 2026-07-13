import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { setRecipeHouseholdShared } from '@/lib/db/households'

// Owner-only: shares (or un-shares) a recipe into the current user's household.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
  const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { shared } = await request.json()
    await setRecipeHouseholdShared(id, shared === true)
    return NextResponse.json({ ok: true, shared: shared === true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
