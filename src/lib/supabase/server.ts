import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { Database } from '@/types/database'

// Memoized with React.cache so a single request reuses one client (and one
// cookie read) across every Server Component and db helper, instead of
// reconstructing it on each call. cache() is scoped to the current request.
export const createClient = cache(async () => {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component — cookie setting will be handled by middleware
          }
        },
      },
    }
  )
})

export type SessionUser = { id: string; email: string | null }

/**
 * The authenticated user for the current request, or null.
 *
 * `supabase.auth.getUser()` makes a ~90ms network round-trip to the Supabase
 * Auth server to validate the JWT. The proxy (middleware) already does exactly
 * that on every request and forwards the validated id/email as request headers,
 * so on the fast path we read those instead of re-validating — saving a
 * full round-trip on every page render and API route. Data access stays safe:
 * Postgres RLS validates the JWT cookie on every query, and the proxy strips
 * any client-supplied x-user-* header before setting its own.
 *
 * The fallback (network getUser) covers requests the proxy didn't process.
 * Wrapped in React.cache so it runs at most once per request.
 */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const h = await headers()
  const id = h.get('x-user-id')
  if (id) return { id, email: h.get('x-user-email') }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? { id: user.id, email: user.email ?? null } : null
})
