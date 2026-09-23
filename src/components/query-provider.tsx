'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { QueryClient, defaultShouldDehydrateQuery, useIsRestoring, useQueryClient, type Query } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { queries, queryKeys, warmCache, NotFoundError, UnauthorizedError } from '@/lib/queries/hooks'

/** Bump to discard everyone's persisted cache after a breaking shape change. */
const CACHE_VERSION = 'v2' // v2: slim recipe list rows (no instructions/steps)
const CACHE_STORAGE_KEY = 'preptable-query-cache'
const CACHE_OWNER_KEY = 'preptable-cache-owner'
const DAY_MS = 24 * 60 * 60 * 1000

/** Only the core datasets go to localStorage; everything else (online search,
 *  grocery lists, …) stays in memory. The sync persister re-serializes the whole
 *  persisted set on every cache change, so keeping it small keeps writes cheap. */
const PERSISTED_ROOTS = new Set<unknown>([
  queryKeys.me[0],
  queryKeys.recipes[0],
  queryKeys.plans[0],
  queryKeys.cookbooks[0],
  queryKeys.feed[0],
  queryKeys.plannerPatterns[0],
  queryKeys.friends[0],
])
function shouldPersist(query: Query) {
  return defaultShouldDehydrateQuery(query) && PERSISTED_ROOTS.has(query.queryKey[0])
}

/** Wipe persisted data (call on sign-out and on user mismatch). */
export function clearPersistedCache(queryClient?: QueryClient) {
  queryClient?.clear()
  try {
    window.localStorage.removeItem(CACHE_STORAGE_KEY)
    window.localStorage.removeItem(CACHE_OWNER_KEY)
  } catch {
    // storage unavailable (private mode) — in-memory clear is enough
  }
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Navigation paints instantly from cache; data older than 5 minutes
        // refetches in the background (on mount, focus or reconnect). Every
        // mutation invalidates what it touches (useCacheInvalidation), so this
        // window only bounds staleness from changes made on other devices.
        staleTime: 5 * 60 * 1000,
        gcTime: DAY_MS, // must be >= persister maxAge or restores get dropped
        retry: (failureCount, error) =>
          error instanceof UnauthorizedError || error instanceof NotFoundError ? false : failureCount < 2,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  })
}

/** Routes where no one is signed in — never warm or persist there. */
function isPublicPath(pathname: string) {
  return (
    pathname.startsWith('/login') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/auth')
  )
}

/**
 * After auth, resolve the profile once, guard against a different user's
 * persisted cache (shared device), then prefetch every core dataset in
 * parallel so navigation reads from memory.
 */
function CacheWarmup() {
  const queryClient = useQueryClient()
  const isRestoring = useIsRestoring()
  const pathname = usePathname()
  const publicPath = isPublicPath(pathname)

  useEffect(() => {
    if (isRestoring || publicPath) return
    let cancelled = false

    ;(async () => {
      // Warm everything in parallel with /api/me rather than after it — one
      // round-trip on cold start instead of two. The owner check still runs
      // when `me` lands; on a mismatch we wipe and re-warm for the new user.
      const warming = warmCache(queryClient).catch(() => {})
      try {
        const me = await queryClient.fetchQuery(queries.me)
        if (cancelled || !me?.profile) return

        const owner = window.localStorage.getItem(CACHE_OWNER_KEY)
        window.localStorage.setItem(CACHE_OWNER_KEY, me.profile.id)
        if (owner && owner !== me.profile.id) {
          await warming
          clearPersistedCache(queryClient)
          window.localStorage.setItem(CACHE_OWNER_KEY, me.profile.id)
          queryClient.setQueryData(queries.me.queryKey, me)
          await warmCache(queryClient)
        }
      } catch (e) {
        if (e instanceof UnauthorizedError) clearPersistedCache(queryClient)
        // any other failure: individual hooks will retry on their own
      }
    })()

    return () => { cancelled = true }
  }, [isRestoring, publicPath, queryClient])

  return null
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient)
  const [persister] = useState(() =>
    createSyncStoragePersister({
      // undefined on the server → persister no-ops during SSR
      storage: typeof window === 'undefined' ? undefined : window.localStorage,
      key: CACHE_STORAGE_KEY,
    })
  )

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: DAY_MS,
        buster: CACHE_VERSION,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
      }}
    >
      {children}
      <CacheWarmup />
    </PersistQueryClientProvider>
  )
}
