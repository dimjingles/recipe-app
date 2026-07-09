import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateProfile, ProfileValidationError, UsernameTakenError } from '@/lib/db/social'

// Own identity fields only — never exposes diet / allergies / goals.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', user.id)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const fields: { username?: string; display_name?: string | null; avatar_url?: string | null } = {}
    if (typeof body.username === 'string') fields.username = body.username
    if ('display_name' in body) fields.display_name = body.display_name
    if ('avatar_url' in body) fields.avatar_url = body.avatar_url

    const profile = await updateProfile(fields)
    return NextResponse.json(profile)
  } catch (error: any) {
    if (error instanceof UsernameTakenError) {
      return NextResponse.json({ error: error.message, code: 'username_taken' }, { status: 409 })
    }
    if (error instanceof ProfileValidationError) {
      return NextResponse.json({ error: error.message, code: 'invalid' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Failed to update profile' }, { status: 500 })
  }
}
