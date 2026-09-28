import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getUser } from '@/lib/supabase/server'
import { getProfile } from '@/lib/db/profile'
import { getInviterByToken } from '@/lib/db/invites'
import { INVITE_COOKIE, isInviteToken } from '@/lib/invite'
import OnboardingWizard from './onboarding-wizard'

export default async function OnboardingPage() {
  const user = await getUser()
  const invite = (await cookies()).get(INVITE_COOKIE)?.value

  const [profile, inviter] = await Promise.all([
    user ? getProfile() : null,
    // Set by /invite/<token> — shows who they'll be friends with.
    isInviteToken(invite) ? getInviterByToken(invite) : null,
  ])

  if (profile?.onboarding_completed) {
    redirect('/')
  }

  return (
    <OnboardingWizard
      isAuthenticated={!!user}
      inviter={inviter && inviter.id !== user?.id
        ? { username: inviter.username, display_name: inviter.display_name, avatar_url: inviter.avatar_url }
        : null}
    />
  )
}
