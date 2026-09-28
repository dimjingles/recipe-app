import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { getProfile } from '@/lib/db/profile'
import { getInviterByToken } from '@/lib/db/invites'
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE, isInviteToken, resolveInviteRedirect } from '@/lib/invite'

// Entry point for a friend invite link. Public (allowlisted in
// src/lib/supabase/proxy.ts). A GET only ever remembers the token in a cookie —
// the friendship is made when the visitor finishes onboarding, so opening the
// link (or a link preview fetching it) can never friend anyone.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params
  const token = raw.toLowerCase()
  const user = await getUser()

  const [inviter, profile] = await Promise.all([
    isInviteToken(token) ? getInviterByToken(token) : null,
    user ? getProfile() : null,
  ])

  const { path, setCookie } = resolveInviteRedirect({
    inviter,
    userId: user?.id ?? null,
    onboarded: !!profile?.onboarding_completed,
  })

  const res = NextResponse.redirect(new URL(path, request.url))
  res.headers.set('Cache-Control', 'no-store')
  if (setCookie) {
    res.cookies.set(INVITE_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: INVITE_COOKIE_MAX_AGE,
    })
  }
  return res
}
