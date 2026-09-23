import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { getProfile } from '@/lib/db/profile'

// The signed-in user's own full profile. This powers the client-side cache;
// it only ever returns the caller's own row.
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const profile = await getProfile()
    // Per-user data: never let a browser or CDN cache serve it to anyone else.
    return NextResponse.json(
      { profile, email: user.email ?? null },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch profile' }, { status: 500 })
  }
}
