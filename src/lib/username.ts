// Shared username rules — used by onboarding, the profile editor, and the API.

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

const USERNAME_RE = /^[a-z0-9_]+$/

/** Lowercase + trim. Handles are case-insensitive (citext) in the DB. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Returns an error message if invalid, or null if the handle is valid. */
export function validateUsername(raw: string): string | null {
  const u = normalizeUsername(raw)
  if (u.length < USERNAME_MIN) return `Username must be at least ${USERNAME_MIN} characters`
  if (u.length > USERNAME_MAX) return `Username must be ${USERNAME_MAX} characters or fewer`
  if (!USERNAME_RE.test(u)) return 'Only lowercase letters, numbers, and underscores'
  return null
}

/** Strip a search term down to characters a handle can contain. */
export function sanitizeUsernameQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
}
