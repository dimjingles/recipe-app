import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/db/profile'
import { computeSkillBadges, normalizeSkillProfile } from '@/lib/skills'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: techniques, error }, profile] = await Promise.all([
    supabase.from('techniques').select('*').order('category').order('label'),
    getProfile(),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const skillProfile = normalizeSkillProfile(profile?.skill_profile, profile?.skill_level)
  const badges = computeSkillBadges(techniques || [], skillProfile.techniques_mastered)
  return NextResponse.json({ techniques: techniques || [], skillProfile, badges })
}
