import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { getProfile } from '@/lib/db/profile'
import { getMyHouseholdId } from '@/lib/db/households'

// The signed-in user's own full profile + household membership. This powers
// the client-side cache; it only ever returns the caller's own row.
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [profile, household_id] = await Promise.all([getProfile(), getMyHouseholdId()])
    return NextResponse.json({ profile, household_id, email: user.email ?? null })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch profile' }, { status: 500 })
  }
}
