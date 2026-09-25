'use client'

import { useMemo } from 'react'
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Profile, RecipeListItem, RecipeWithDetails, PlanWithSlots, CookbookWithCount, Technique, RecipeVariantLink } from '@/types/database'
import type { Feed } from '@/lib/db/activity'
import type { FriendGraph } from '@/lib/db/social'
import type { FriendRecipe, RecentSearch } from '@/lib/db/search'
import type { DayCuisinePattern } from '@/lib/db/planner'
import { getWeekStart } from '@/lib/week'

export interface GroceryItem {
  name: string
  quantity: number
  displayQty: string
  unit: string
  category: string
  recipes: string[]
}

/** GET /api/planner/grocery — the week's shopping list. */
export interface GroceryData {
  grouped: Record<string, GroceryItem[]>
  items: GroceryItem[]
}

/** GET /api/me — the signed-in user's own profile. */
export interface Me {
  profile: Profile | null
  email: string | null
}

export class UnauthorizedError extends Error {
  constructor() { super('Unauthorized') }
}

/** 404 — gone or not visible to this user. Not worth retrying. */
export class NotFoundError extends Error {
  constructor(url: string) { super(`${url} not found`) }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (res.status === 401) throw new UnauthorizedError()
  if (res.status === 404) throw new NotFoundError(url)
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
  recipe: (id: string) => ['recipe', id] as const,
  recipeDetails: ['recipe'] as const, // prefix matching every recipe detail
  techniques: ['techniques'] as const,
  plan: (weekStart: string) => ['plan', weekStart] as const,
  plans: ['plan'] as const, // prefix matching every week
  // Under the week's plan key, so plan (and recipe) invalidation covers it.
  grocery: (weekStart: string) => ['plan', weekStart, 'grocery'] as const,
  cookbooks: ['cookbooks'] as const,
  feed: ['feed'] as const,
  /** Every loaded page of the full feed (under the ['feed'] prefix, so feed invalidation covers it). */
  feedPages: ['feed', 'pages'] as const,
  plannerPatterns: ['planner-patterns'] as const,
  friends: ['friends'] as const,
  /** Friends' recipes matching a search (in memory only — not persisted). */
  searchFriends: (q: string) => ['search', 'friends', q] as const,
  search: ['search'] as const, // prefix matching every friend search
  forYou: ['for-you'] as const,
  searchRecents: ['search-recents'] as const,
}

export const queries = {
  me: {
    queryKey: queryKeys.me,
    queryFn: () => getJson<Me>('/api/me'),
  },
  recipes: {
    queryKey: queryKeys.recipes,
    queryFn: () => getJson<RecipeListItem[]>('/api/recipes'),
  },
  recipe: (id: string) => ({
    queryKey: queryKeys.recipe(id),
    queryFn: () =>
      getJson<{ recipe: RecipeWithDetails; variants: RecipeVariantLink[]; isOwner: boolean }>(`/api/recipes/${id}`),
  }),
  techniques: {
    queryKey: queryKeys.techniques,
    queryFn: () => getJson<Technique[]>('/api/techniques'),
    staleTime: Infinity, // static reference data
  },
  plan: (weekStart: string) => ({
    queryKey: queryKeys.plan(weekStart),
    queryFn: () =>
      getJson<{ plan: PlanWithSlots | null }>(
        `/api/planner/week?week_start=${weekStart}`
      ).then(r => r.plan),
  }),
  grocery: (weekStart: string) => ({
    queryKey: queryKeys.grocery(weekStart),
    queryFn: () => getJson<GroceryData>(`/api/planner/grocery?week_start=${weekStart}`),
  }),
  cookbooks: {
    queryKey: queryKeys.cookbooks,
    queryFn: () => getJson<CookbookWithCount[]>('/api/cookbooks'),
  },
  feed: {
    queryKey: queryKeys.feed,
    queryFn: () => getJson<Feed>('/api/feed'),
  },
  friends: {
    queryKey: queryKeys.friends,
    queryFn: () => getJson<FriendGraph>('/api/friends'),
  },
  plannerPatterns: {
    queryKey: queryKeys.plannerPatterns,
    queryFn: () => getJson<{ patterns: DayCuisinePattern[] }>('/api/planner/patterns').then(r => r.patterns),
  },
  searchFriends: (q: string) => ({
    queryKey: queryKeys.searchFriends(q),
    queryFn: () =>
      getJson<{ results: FriendRecipe[] }>(`/api/search/friends?q=${encodeURIComponent(q)}`).then(r => r.results),
  }),
  forYou: {
    queryKey: queryKeys.forYou,
    queryFn: () => getJson<{ results: FriendRecipe[] }>('/api/search/for-you').then(r => r.results),
  },
  searchRecents: {
    queryKey: queryKeys.searchRecents,
    queryFn: () => getJson<{ results: RecentSearch[] }>('/api/search/recents').then(r => r.results),
  },
}

export function useMe() {
  return useQuery(queries.me)
}

export function useRecipes() {
  return useQuery(queries.recipes)
}

/** One recipe with everything the detail page shows. */
export function useRecipe(id: string) {
  return useQuery(queries.recipe(id))
}

export function useTechniques() {
  return useQuery(queries.techniques)
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

/**
 * The full feed with "Load more" pages, kept in the query cache so loaded pages
 * survive navigating away. Seeded from the first page the home screen already
 * has cached.
 */
export function useFeedPages() {
  const first = useFeed()
  return useInfiniteQuery({
    queryKey: queryKeys.feedPages,
    queryFn: ({ pageParam }) =>
      getJson<Feed>(pageParam ? `/api/feed?cursor=${encodeURIComponent(pageParam)}` : '/api/feed'),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
    initialData: first.data ? { pages: [first.data], pageParams: [null] } : undefined,
    initialDataUpdatedAt: first.dataUpdatedAt,
  })
}

export function useGrocery(weekStart: string) {
  return useQuery(queries.grocery(weekStart))
}

/** Friends plus incoming / outgoing requests. */
export function useFriends() {
  return useQuery(queries.friends)
}

export function usePlannerPatterns() {
  return useQuery(queries.plannerPatterns)
}

/** Friends' recipes matching `q` (already debounced by the caller). Keeps the
 *  previous results on screen while the next query loads. */
export function useFriendRecipeSearch(q: string) {
  return useQuery({
    ...queries.searchFriends(q),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
  })
}

/** "Recipes we think you'll like" — friends' recipes like the user's favourites. */
export function useForYou() {
  return useQuery(queries.forYou)
}

export function useSearchRecents() {
  return useQuery(queries.searchRecents)
}

/** The fields a recent needs, from whichever list the recipe was picked in. */
export type RecentInput = Omit<RecentSearch, 'searched_at'>

/**
 * Add (or bump) a recipe in the search Recents. The list updates optimistically
 * so it's already right when the user comes back from the recipe.
 */
export function useRecordRecent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (recipe: RecentInput) =>
      fetch('/api/search/recents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: recipe.id }),
      }),
    onMutate: recipe => {
      queryClient.setQueryData<RecentSearch[]>(queryKeys.searchRecents, prev => [
        { ...recipe, searched_at: new Date().toISOString() },
        ...(prev ?? []).filter(r => r.id !== recipe.id),
      ])
    },
    // A refetch racing the write (e.g. recipesChanged after a create) could drop
    // the new row; refetch once the write has landed.
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.searchRecents }),
  })
}

/** Remove one recipe from the search Recents (optimistic; restored on failure). */
export function useRemoveRecent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (recipeId: string) => {
      const res = await fetch(`/api/search/recents?recipe_id=${encodeURIComponent(recipeId)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not remove')
    },
    onMutate: recipeId => {
      const previous = queryClient.getQueryData<RecentSearch[]>(queryKeys.searchRecents)
      queryClient.setQueryData<RecentSearch[]>(queryKeys.searchRecents, prev => (prev ?? []).filter(r => r.id !== recipeId))
      return { previous }
    },
    onError: (_error, _recipeId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.searchRecents, context.previous)
    },
  })
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
        void queryClient.invalidateQueries({ queryKey: queryKeys.recipeDetails })
        void queryClient.invalidateQueries({ queryKey: queryKeys.plans })
        void queryClient.invalidateQueries({ queryKey: queryKeys.cookbooks })
        // Ratings shape "Recipes we think you'll like"; renames/deletes show in Recents.
        void queryClient.invalidateQueries({ queryKey: queryKeys.forYou })
        void queryClient.invalidateQueries({ queryKey: queryKeys.searchRecents })
      },
      /** A weekly-plan slot changed (any week). */
      planChanged: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.plans })
      },
      /** Cookbook created/renamed/deleted or membership changed. */
      cookbooksChanged: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cookbooks })
        void queryClient.invalidateQueries({ queryKey: queryKeys.recipes })
        void queryClient.invalidateQueries({ queryKey: queryKeys.recipeDetails })
      },
      /** Own profile changed. */
      meChanged: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.me })
      },
      /** Friendship added/removed/requested — changes who's in the feed. */
      socialChanged: () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.friends })
        void queryClient.invalidateQueries({ queryKey: queryKeys.feed })
        void queryClient.invalidateQueries({ queryKey: queryKeys.search })
        void queryClient.invalidateQueries({ queryKey: queryKeys.forYou })
        void queryClient.invalidateQueries({ queryKey: queryKeys.searchRecents })
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
    queryClient.prefetchQuery(queries.friends),
  ])
}
