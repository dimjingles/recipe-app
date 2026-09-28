// Friend invite links — shared by the /invite route, onboarding, and tests.
//
// /invite/<token> never friends anyone by itself: it only drops the token in a
// cookie. The friendship is made when that visitor finishes onboarding
// (POST /api/onboarding → accept_friend_invite), so it only ever applies to a
// brand-new account.

export const INVITE_COOKIE = 'preptable-invite'

/** Sign-up happens in one sitting; a week covers "open link, sign up later". */
export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

const INVITE_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Invite tokens are uuids; anything else would fail the Postgres uuid cast. */
export function isInviteToken(value: unknown): value is string {
  return typeof value === 'string' && INVITE_TOKEN_RE.test(value)
}

/** Where /invite/<token> sends the visitor, and whether to remember the token. */
export function resolveInviteRedirect({ inviter, userId, onboarded }: {
  /** Owner of the token, or null if it's unknown (reset, or no handle yet). */
  inviter: { id: string; username: string | null } | null
  /** The signed-in visitor, if any. */
  userId: string | null
  /** Whether the signed-in visitor has finished onboarding. */
  onboarded: boolean
}): { path: string; setCookie: boolean } {
  const existingUser = !!userId && onboarded

  if (!inviter?.username) return { path: existingUser ? '/' : '/onboarding', setCookie: false }

  // Existing accounts aren't auto-friended — show the inviter's profile so they
  // can send a normal request instead.
  if (existingUser) {
    return inviter.id === userId
      ? { path: '/friends', setCookie: false }
      : { path: `/u/${encodeURIComponent(inviter.username)}`, setCookie: false }
  }

  return { path: '/onboarding', setCookie: true }
}
