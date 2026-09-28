import { NextResponse } from 'next/server'
import { INVITE_COOKIE } from '@/lib/invite'

// "Not now" on the onboarding invite banner: forget the pending invite so the
// new account isn't auto-friended. Works signed out (the cookie is httpOnly).
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(INVITE_COOKIE)
  return res
}
