'use client'

import { useEffect } from 'react'
import { Shimmer } from '@/components/ui/shimmer'
import { UnauthorizedError } from '@/lib/queries/hooks'

/**
 * Skeleton shown only on a true cold start (nothing in the persisted cache
 * yet). Once the cache is warm, cached-page views render real data instantly
 * and this never appears.
 */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-8 pb-4 md:px-8">
      <Shimmer className="mb-3 h-9 w-48" />
      <Shimmer className="mb-8 h-4 w-32" />
      <Shimmer className="mb-6 h-40 w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Shimmer key={i} className="aspect-[4/3] w-full" />
        ))}
      </div>
    </div>
  )
}

/** Skeleton for detail-style pages (hero image + title + content rows). */
export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-5 pt-8 pb-4 md:px-8">
      <Shimmer className="mb-6 aspect-[16/9] w-full" />
      <Shimmer className="mb-3 h-9 w-2/3" />
      <Shimmer className="mb-8 h-4 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Shimmer key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}

/**
 * If any cached query failed with a 401 (session expired mid-visit), send the
 * user through the auth flow instead of leaving them on a skeleton. Document
 * loads are already gated by the proxy; this covers client-side navigations.
 */
export function useAuthRedirect(...errors: (Error | null)[]) {
  const unauthorized = errors.some(e => e instanceof UnauthorizedError)
  useEffect(() => {
    if (unauthorized) window.location.assign('/onboarding')
  }, [unauthorized])
}
