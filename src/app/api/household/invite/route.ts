import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHouseholdInvite, getMyHouseholdId } from '@/lib/db/households'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const householdId = await getMyHouseholdId()
    if (!householdId) return NextResponse.json({ error: 'You are not in a household' }, { status: 400 })

    const token = await createHouseholdInvite(householdId)
    return NextResponse.json({ token })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
