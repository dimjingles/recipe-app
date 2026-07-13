# Performance Plan: Instant Navigation via Client-Side Data Cache

*Written 2026-07-13, branch `cache-profile-on-login`. Research sources at bottom.*

## Where the time goes today

Every navigation server-renders the target page, which re-runs Supabase queries
(~85–300ms each, sequential in places) before any HTML is sent. PR #48 cut the
round-trips per page from ~7 to ~3, but the architecture still pays
**(server render + DB round-trips) on every single click**, and on Vercel
serverless + a phone's network, that's the ~1s the user feels. The full HTML
payload is also re-downloaded per nav (126–196KB).

## What modern fast apps do (research summary)

1. **Client-side stale-while-revalidate cache** (TanStack Query / SWR — the
   industry default): keep server data in a client cache; render instantly from
   cache on navigation; revalidate in the background. `staleTime` controls
   freshness, `gcTime`/persistence controls retention; mutations update the
   cache optimistically.
2. **Local-first sync engines** (Linear, ~50ms page loads): full DB in the
   browser (IndexedDB), server is a sync target, deltas over WebSocket.
   Gold standard, but a large engineering investment — overkill here.
3. **Framework-native caching** (Next 16 Cache Components): `use cache` +
   Suspense + prefetched static shells + `unstable_instant` validation.
   Excellent for shared/public data, but this app's data is ~100% per-user:
   per-user shells can't be prefetched statically (`use cache: private` is
   experimental, runtime prefetching "not yet stable"), so each nav would still
   show skeletons while user data streams. Revisit when stable.
4. **Perceived-speed staples**: route prefetching (Next `<Link>` does this in
   production), `loading.tsx` skeletons, optimistic UI, `next/image`.

**Chosen approach: #1 (client cache, hydrated at login, persisted) + #4.**
This matches the user's instinct ("load everything at login, keep it in
cache"). The app's dataset is small (tens of recipes, one plan, one profile —
well under 1MB JSON), so caching *all of it* client-side is trivially cheap,
and the PWA gets offline reads for free. #2 is explicitly out of scope; #3 is
a future migration once `use cache: private`/runtime prefetching stabilize.

## Target architecture

```
Login / first app load
  └─ AppDataProvider (client, in root layout)
       └─ warm-up: parallel GET /api/{recipes,profile,planner/week,cookbooks,feed}
            → TanStack Query cache (staleTime 5min, gcTime 24h)
            → persisted to localStorage (versioned, keyed by user id)

Navigation (e.g. tap "Planner")
  └─ route is a static client page → prefetched by <Link> → renders instantly
       └─ usePlan() reads cache → REAL data on screen in ~0ms
            └─ background refetch if stale → cache update re-renders

Mutation (e.g. assign recipe to Tuesday)
  └─ POST /api/planner/slots (existing route, unchanged auth)
       └─ optimistic cache update immediately; invalidate on error
```

Server stays the source of truth; RLS and the auth proxy are untouched. The
cache is a read accelerator, not a second authority.

## Phases

### Phase 1 — Client cache foundation ✅ (implemented on `cache-profile-on-login`)
- Add `@tanstack/react-query` + persistence plugin.
- `QueryProvider` client component in `src/app/layout.tsx` (wraps children;
  layout itself stays a server component).
- Persist cache to localStorage via `persistQueryClient`, cache-buster version
  string, **keyed by user id and cleared on signout** (shared-device safety).
- Query hooks in `src/lib/queries/`: `useRecipes`, `useProfile`, `usePlan`,
  `useCookbooks`, `useFeed` — each a thin `useQuery` over an API route.
- Add missing `GET /api/recipes` (list, same shape as `getRecipes()`); all
  other needed GET routes already exist.
- Warm-up hook: after auth, `queryClient.prefetchQuery` all five in parallel
  ("load everything on login").
- Defaults: `staleTime: 5min`, `refetchOnWindowFocus: true`,
  `refetchOnReconnect: true`.

### Phase 2 — Make nav-hot routes render from cache ✅ (implemented on `cache-profile-on-login`)
Convert `/`, `/recipes`, `/planner`, `/cookbooks`, `/feed` so `page.tsx` is a
zero-await server shell rendering a client view: view reads its hook, shows
skeleton only on true cold start (empty persisted cache). These routes become
static → fully prefetchable → client-side nav with **no server round-trip**.
Server-side page data fetching for these routes is deleted (the API routes
take over). Detail pages (`/recipes/[id]`, `/u/[username]`) stay
server-rendered (deep-linkable, unbounded key space) — Phase 3 makes the
*list→detail* hop instant via `initialData` from the cached list.

### Phase 3 — Mutations keep the cache honest ✅ (invalidation map done; optimistic `useMutation` refactor still open)
- Central invalidation map (mutation → affected query keys), e.g. recipe CRUD
  → `['recipes']` (+ `['plan']` since plan embeds recipes).
- Existing 18 client `fetch('/api/...')` call sites: replace bespoke
  `useState`/`router.refresh()` juggling with `useMutation` + optimistic
  updates for the high-frequency actions (plan a slot, rank a recipe, grocery
  check-off).
- `/recipes/[id]` seeds from the cached list row via `initialData` (name,
  image, cuisine paint instantly; ingredients/log stream in).

### Phase 4 — Perceived-speed + payload polish (cheap, do alongside)
- `loading.tsx` skeletons for the routes that remain server-rendered.
- `next/image` for recipe images (currently raw `<img>` with remote URLs).
- Verify `<Link>` prefetching isn't disabled anywhere; hover/viewport prefetch
  of recipe detail routes from the library grid.

### Later / explicitly out of scope now
- **Supabase Realtime** channel per household → `invalidateQueries` for
  cross-device freshness (nice-to-have; solo/household usage tolerates 5min
  staleness + focus refetch).
- **Cache Components / `unstable_instant`** migration once per-user caching
  ('use cache: private') and runtime prefetching leave experimental status.
- **Local-first sync engine** (IndexedDB mirror, delta sync): revisit only if
  the app grows offline-write requirements.

## Success criteria
- Warm navigation between the five hot routes: **<50ms to real data** (from
  cache), measured via Performance API marks; no skeletons after first load.
- Cold start (fresh login): one parallel warm-up batch (~300–500ms), then
  everything instant.
- Mutations reflect in UI in <16ms (optimistic), reconcile in background.
- Signout leaves no cached user data in localStorage.

## Risks & mitigations
- **Stale UI after external change** → focus/reconnect refetch + 5min
  staleTime; Realtime later if needed.
- **localStorage quota (5MB)** → dataset is ~100s of KB; strip `instructions`
  from the persisted list if it ever grows; gcTime caps retention.
- **Two sources of truth during migration** → convert route-by-route (Phase 2
  order: planner → recipes → home → cookbooks → feed), delete the server
  fetch in the same PR as each conversion.
- **Auth edge**: API routes already 401 without session; hooks treat 401 as
  "clear cache + redirect to login".

## Research sources
- TanStack Query v5 defaults/SWR model: tanstack.com/query docs ("caching",
  "query invalidation", QueryClient reference)
- Linear's speed: "How's Linear so fast?" (1023jack.com / performance.dev),
  reverse-linear-sync-engine (github.com/wzhudev)
- Next 16 (version-local docs in `node_modules/next/dist/docs`):
  `01-getting-started/08-caching.md`, `02-guides/instant-navigation.md`,
  `02-guides/prefetching.md`, `01-directives/use-cache-private.md`
  (experimental), `05-config/.../staleTimes.md`
