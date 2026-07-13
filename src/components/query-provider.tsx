'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { QueryClient, useIsRestoring, useQueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { queries, warmCache, UnauthorizedError } from '@/lib/queries/hooks'

/** Bump to discard everyone's persisted cache after a breaking shape change. */
const CACHE_VERSION = 'v1'
const CACHE_STORAGE_KEY = 'preptable-query-cache'
const CACHE_OWNER_KEY = 'preptable-cache-owner'
const DAY_MS = 24 * 60 * 60 * 1000

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
        // Short staleness window: navigation paints instantly from cache while
        // anything older than 30s refetches in the background, so data touched
        // by a mutation self-heals within one navigation even without an
        // explicit invalidation.
        staleTime: 30 * 1000,
        gcTime: DAY_MS, // must be >= persister maxAge or restores get dropped
        retry: (failureCount, error) =>
          error instanceof UnauthorizedError ? false : failureCount < 2,
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
      try {
        const me = await queryClient.fetchQuery(queries.me)
        if (cancelled || !me?.profile) return

        const owner = window.localStorage.getItem(CACHE_OWNER_KEY)
        if (owner && owner !== me.profile.id) {
          clearPersistedCache(queryClient)
          queryClient.setQueryData(queries.me.queryKey, me)
        }
        window.localStorage.setItem(CACHE_OWNER_KEY, me.profile.id)

        await warmCache(queryClient)
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
      persistOptions={{ persister, maxAge: DAY_MS, buster: CACHE_VERSION }}
    >
      {children}
      <CacheWarmup />
    </PersistQueryClientProvider>
  )
}
