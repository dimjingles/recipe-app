import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/db/profile'
import SkillMap from '@/components/skill-map'
import { computeSkillBadges, normalizeSkillProfile } from '@/lib/skills'

export default async function SkillsPage() {
  const supabase = await createClient()
  const [{ data: techniques }, profile] = await Promise.all([
    supabase.from('techniques').select('*').order('category').order('label'),
    getProfile(),
  ])
  const skillProfile = normalizeSkillProfile(profile?.skill_profile, profile?.skill_level)
  const badges = computeSkillBadges(techniques || [], skillProfile.techniques_mastered)
  return <SkillMap techniques={(techniques || []) as any} skillProfile={skillProfile} badges={badges} />
}
