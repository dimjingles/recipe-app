import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { findUserByEmail } from '@/lib/db/social'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { email } = await request.json()
    if (typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    const found = await findUserByEmail(email)
    // Never reveal own account as a "found" result.
    return NextResponse.json({ user: found && found.id !== user.id ? found : null })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
