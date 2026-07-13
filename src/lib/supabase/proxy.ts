import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Start from the incoming headers but strip any client-supplied identity
  // headers — we set these ourselves below so they can't be spoofed.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-user-id')
  requestHeaders.delete('x-user-email')

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

  // Refresh session on every request (prevents stale-token 401s)
  const { data: { user } } = await supabase.auth.getUser()

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
