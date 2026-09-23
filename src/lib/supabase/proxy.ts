import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Start from the incoming headers but strip any client-supplied identity
  // headers — we set these ourselves below so they can't be spoofed.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-user-id')
  requestHeaders.delete('x-user-email')

  // Public share links never need the viewer's identity — skip the session work.
  if (request.nextUrl.pathname.startsWith('/share/')) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Collect refreshed auth cookies and apply them to the single response we
  // build at the end (so the forwarded request also carries our headers).
  const pendingCookies: { name: string; value: string; options: any }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          pendingCookies.push(...cookiesToSet)
        },
      },
    }
  )

  // Refresh the session if its access token has expired (prevents stale-token
  // 401s), then verify the JWT. The project signs with an asymmetric (ES256)
  // key, so getClaims() checks the signature locally against the cached JWKS —
  // no round-trip to Supabase Auth on every request, unlike getUser(). The
  // tradeoff: a revoked session stays valid until its JWT expires (≤1h).
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const user = claims?.sub
    ? { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined }
    : null

  // Forward the validated identity so Server Components / route handlers don't
  // each re-validate over the network. Data access is still guarded by RLS.
  if (user) {
    requestHeaders.set('x-user-id', user.id)
    if (user.email) requestHeaders.set('x-user-email', user.email)
  }

  const pathname = request.nextUrl.pathname
  const isLoginPage     = pathname.startsWith('/login')
  const isOnboarding    = pathname.startsWith('/onboarding')
  const isAuthCallback  = pathname.startsWith('/auth/callback')
  const isApiRoute      = pathname.startsWith('/api/')
  const isPublicRoute   = isLoginPage || isOnboarding || isAuthCallback || isApiRoute

  // Authenticated users have no business on /login → send to app root
  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Unauthenticated users hitting protected routes → send to onboarding
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/onboarding'
    return NextResponse.redirect(url)
  }

  const supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
  pendingCookies.forEach(({ name, value, options }) =>
    supabaseResponse.cookies.set(name, value, options)
  )
  return supabaseResponse
}
