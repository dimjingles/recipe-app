import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { getCookingPatterns } from '@/lib/db/planner'

// Day-of-week cuisine habits mined from the cooking log (planner suggestions).
export async function GET() {
  try {
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ patterns: await getCookingPatterns() })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch patterns' }, { status: 500 })
  }
}
