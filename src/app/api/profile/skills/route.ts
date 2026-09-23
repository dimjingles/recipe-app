import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { getProfile } from '@/lib/db/profile'
import { getTechniques } from '@/lib/db/techniques'
import { computeSkillBadges, normalizeSkillProfile } from '@/lib/skills'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [techniques, profile] = await Promise.all([getTechniques(), getProfile()])

  const skillProfile = normalizeSkillProfile(profile?.skill_profile, profile?.skill_level)
  const badges = computeSkillBadges(techniques || [], skillProfile.techniques_mastered)
  return NextResponse.json({ techniques: techniques || [], skillProfile, badges })
}
