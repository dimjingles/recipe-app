import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { completeOnboarding } from '@/lib/db/profile'
import { acceptFriendInvite } from '@/lib/db/invites'
import { INVITE_COOKIE, isInviteToken } from '@/lib/invite'

export async function POST(request: NextRequest) {
  try {
  const user = await getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Joined through a friend's /invite link → start out as friends. Runs
    // before completeOnboarding() (the RPC only applies to new accounts), and a
    // failure here never blocks finishing sign-up.
    const invite = request.cookies.get(INVITE_COOKIE)?.value
    let invitedBy: string | null = null
    if (isInviteToken(invite)) {
      try {
        invitedBy = await acceptFriendInvite(invite)
      } catch (error) {
        console.error('Accept friend invite error:', error)
      }
    }

    const { username_taken } = await completeOnboarding({
      household_size:    body.household_size    ?? null,
      cook_frequency:    body.cook_frequency    ?? null,
      // The questionnaire (off for now) sends '' when unanswered.
      referral_source:   body.referral_source   || (invitedBy ? 'invite' : null),
      primary_goal:      body.primary_goal      ?? null,
      diet:              body.diet              ?? null,
      allergies:         Array.isArray(body.allergies)         ? body.allergies         : [],
      favorite_cuisines: Array.isArray(body.favorite_cuisines) ? body.favorite_cuisines : [],
      skill_level:       body.skill_level       ?? null,
      meal_reminders:    body.meal_reminders    ?? false,
      username:          typeof body.username === 'string' ? body.username : undefined,
    })

    const res = NextResponse.json({ ok: true, username_taken })
    // Only cleared on success, so "Try again" after a failure still redeems it.
    if (invite) res.cookies.delete(INVITE_COOKIE)
    return res
  } catch (error) {
    console.error('Onboarding submit error:', error)
    return NextResponse.json({ error: 'Failed to save onboarding' }, { status: 500 })
  }
}
