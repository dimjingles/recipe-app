'use client'

import { useMemo } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Profile, RecipeWithIngredients, PlanWithSlots, CookbookWithCount } from '@/types/database'
import type { Feed } from '@/lib/db/activity'
import type { DayCuisinePattern } from '@/lib/db/planner'
import { getWeekStart } from '@/lib/week'

/** GET /api/me — the signed-in user's own profile. */
export interface Me {
  profile: Profile | null
  email: string | null
}

export class UnauthorizedError extends Error {
  constructor() { super('Unauthorized') }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (res.status === 401) throw new UnauthorizedError()
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`)
  return res.json()
}

/**
 * Central query-key registry. Mutations invalidate by these keys, so every
 * consumer must go through this object rather than inlining key arrays.
 */
export const queryKeys = {
  me: ['me'] as const,
  recipes: ['recipes'] as const,
  plan: (weekStart: string) => ['plan', weekStart] as const,
  plans: ['plan'] as const, // prefix matching every week
  cookbooks: ['cookbooks'] as const,
  feed: ['feed'] as const,
  plannerPatterns: ['planner-patterns'] as const,
}

export const queries = {
  me: {
    queryKey: queryKeys.me,
    queryFn: () => getJson<Me>('/api/me'),
  },
  recipes: {
    queryKey: queryKeys.recipes,
    queryFn: () => getJson<RecipeWithIngredients[]>('/api/recipes'),
  },
  plan: (weekStart: string) => ({
    queryKey: queryKeys.plan(weekStart),
    queryFn: () =>
      getJson<{ plan: PlanWithSlots | null }>(
        `/api/planner/week?week_start=${weekStart}`
      ).then(r => r.plan),
  }),
  cookbooks: {
    queryKey: queryKeys.cookbooks,
    queryFn: () => getJson<CookbookWithCount[]>('/api/cookbooks'),
  },
  feed: {
    queryKey: queryKeys.feed,
    queryFn: () => getJson<Feed>('/api/feed'),
  },
  plannerPatterns: {
    queryKey: queryKeys.plannerPatterns,
    queryFn: () => getJson<{ patterns: DayCuisinePattern[] }>('/api/planner/patterns').then(r => r.patterns),
  },
}

export function useMe() {
  return useQuery(queries.me)
}

export function useRecipes() {
  return useQuery(queries.recipes)
}

export function usePlan(weekStart: string = getWeekStart()) {
  return useQuery(queries.plan(weekStart))
}

export function useCookbooks() {
  return useQuery(queries.cookbooks)
}

export function useFeed() {
  return useQuery(queries.feed)
}

export function usePlannerPatterns() {
  return useQuery(queries.plannerPatterns)
}

/**
 * Domain-level cache invalidation, called after successful mutations so other
 * views refetch instead of showing stale cached data. Grouped by what actually
 * ripples: recipe rows are embedded in plans and joined to cookbooks.
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient()
  return useMemo(
    () => ({
      /** Any recipe created/edited/deleted/ranked/logged. */
      recipesChanged: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.recipes })
        void queryClient.invalidateQueries({ queryKey: queryKeys.plans })
        void queryClient.invalidateQueries({ queryKey: queryKeys.cookbooks })
      },
      /** A weekly-plan slot changed (any week). */
      planChanged: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.plans })
      },
      /** Cookbook created/renamed/deleted or membership changed. */
      cookbooksChanged: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cookbooks })
        void queryClient.invalidateQueries({ queryKey: queryKeys.recipes })
      },
      /** Own profile changed. */
      meChanged: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.me })
      },
    }),
    [queryClient]
  )
}

/**
 * Warm every core dataset in one parallel batch ("load everything at login").
 * prefetchQuery respects staleTime, so fresh persisted data costs no network.
 */
export function warmCache(queryClient: QueryClient) {
  return Promise.allSettled([
    queryClient.prefetchQuery(queries.recipes),
    queryClient.prefetchQuery(queries.plan(getWeekStart())),
    queryClient.prefetchQuery(queries.cookbooks),
    queryClient.prefetchQuery(queries.feed),
    queryClient.prefetchQuery(queries.plannerPatterns),
  ])
}
