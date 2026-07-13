import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { acceptHouseholdInvite } from '@/lib/db/households'

export async function POST(request: NextRequest) {
  try {
  const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })

    const household_id = await acceptHouseholdInvite(token)
    return NextResponse.json({ household_id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
