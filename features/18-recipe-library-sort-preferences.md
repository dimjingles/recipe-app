# 18 - Recipe Library Sort Preferences

**Priority: 3 - small usability feature that makes the recipe library feel user-owned instead of resetting every session.**

**Depends on:** Existing `/recipes` library, `recipes.rank`, `recipes.last_cooked_at`, `recipes.cooked_count`, existing `profiles` row for authenticated users.

---

## What it builds

The recipe library gets an explicit sort control with three options:

| Sort option | Behaviour |
|---|---|
| **Ranking** | Default option. Sort by recipe ranking, best ranked recipes first. Ranked recipes appear above unranked recipes. |
| **Most recently cooked** | Sort by `last_cooked_at` descending. Recipes never cooked appear last. |
| **Most times cooked** | Sort by `cooked_count` descending. Ties fall back to ranking, then name. |

When the user changes the sort option, PrepTable immediately persists that choice as the user's default. The next time they log in or return to `/recipes`, the library opens with that saved sort selected.

---

## User story

> As a cook, I want to sort my recipes by ranking, most recently cooked, or most cooked overall. When I choose a sort, I want PrepTable to remember it so the recipe library opens the way I prefer next time.

---

## Product considerations

- **Ranking remains the first-run default.** New users and existing users without a saved preference see Ranking first.
- **Sort preference is account-level, not device-local.** If a user changes the sort on mobile, web should use the same default on next login.
- **Changing sort is also changing default.** No separate settings screen, no extra save button. The control is the preference.
- **Sort applies after scoping and filters.** Cookbook selection, Cooked/Want to try tabs, search, cuisine, type, and tag filters run first. The visible result set is then sorted.
- **Ranking is still meaningful only where ranking exists.** Unranked recipes fall to the bottom for Ranking. Within unranked recipes, use `last_cooked_at` descending, then recipe name.
- **Want to try recipes have `cooked_count === 0`.** For that tab, Most recently cooked and Most times cooked will mostly tie. Keep the selected sort visible anyway so the user's preference is consistent across tabs.
- **No localStorage as source of truth.** Local state can provide instant UI response, but persisted preference lives in Supabase under `profiles`.

---

## Data model

Add a nullable-safe profile preference column:

```sql
alter table profiles
  add column if not exists recipe_sort_preference text not null default 'ranking'
  check (recipe_sort_preference in ('ranking', 'recently_cooked', 'most_cooked'));
```

Recommended TypeScript type:

```ts
export type RecipeSortPreference = 'ranking' | 'recently_cooked' | 'most_cooked'
```

Update `Profile` Row/Insert types in `src/types/database.ts`.

---

## Build sequence

### Slice 1 - Sort control and client-side sorting

Add a compact sort dropdown or segmented control near the existing library filters. Recommended placement: below the search box, before type/cuisine/tag filters, so the user reads it as a library-level control.

Sort order details:

```ts
const SORT_OPTIONS = [
  { value: 'ranking', label: 'Ranking' },
  { value: 'recently_cooked', label: 'Most recently cooked' },
  { value: 'most_cooked', label: 'Most cooked' },
] as const
```

```ts
function compareRecipes(a, b, sort) {
  if (sort === 'ranking') {
    const aRank = a.rank ?? Number.POSITIVE_INFINITY
    const bRank = b.rank ?? Number.POSITIVE_INFINITY
    if (aRank !== bRank) return aRank - bRank
    return compareDateDesc(a.last_cooked_at, b.last_cooked_at) || a.name.localeCompare(b.name)
  }

  if (sort === 'recently_cooked') {
    return compareDateDesc(a.last_cooked_at, b.last_cooked_at)
      || compareRank(a.rank, b.rank)
      || a.name.localeCompare(b.name)
  }

  return (b.cooked_count ?? 0) - (a.cooked_count ?? 0)
    || compareRank(a.rank, b.rank)
    || a.name.localeCompare(b.name)
}
```

Acceptance:
- `/recipes` shows a sort control with Ranking, Most recently cooked, and Most cooked.
- Ranking is selected when no saved preference exists.
- Changing sort immediately reorders the currently visible recipe list.
- Sorting applies after cookbook/category/search/filter scoping.
- Empty states remain unchanged.

### Slice 2 - Persist the default sort preference

Add the `profiles.recipe_sort_preference` column and expose it to the library page.

Implementation options:
1. Fetch the profile in `src/app/recipes/page.tsx` and pass `initialSortPreference` into `RecipeLibrary`.
2. Add a small authenticated API route for preference updates, such as `PATCH /api/profile/preferences`, with body `{ recipe_sort_preference }`.
3. On sort change, update local state immediately, then call the API in the background.
4. If the API fails, keep the UI state for the current session but show a toast: `Could not save sort preference`.

Acceptance:
- Changing sort writes the selected option to `profiles.recipe_sort_preference`.
- Logging out and back in opens `/recipes` with the last selected sort.
- Refreshing `/recipes` keeps the saved sort.
- Invalid sort values are rejected server-side with a 400.
- Unauthenticated users cannot update profile preferences.

### Slice 3 - Polish and edge cases

- Keep the current sort when switching between Cooked and Want to try tabs.
- Keep the current sort when changing cookbook scope.
- The sort control should fit mobile width without wrapping awkwardly.
- The currently selected sort should be visually obvious.
- Do not reset sort when the user searches or clears search.

Acceptance:
- Sort selection survives tab switches, cookbook switches, filters, search, page refresh, and login.
- If a profile row somehow predates the migration and has no value, the app uses Ranking and backfills only when the user changes the sort.

---

## Files to create or modify

| File | Change |
|---|---|
| `supabase/migrations/018_recipe_sort_preference.sql` | Add `recipe_sort_preference` profile column with default and check constraint. |
| `src/types/database.ts` | Add `recipe_sort_preference` to `profiles` Row/Insert types and export `RecipeSortPreference`. |
| `src/app/recipes/page.tsx` | Fetch profile sort preference and pass it to `RecipeLibrary`. |
| `src/components/recipe-library.tsx` | Add sort state, sort control, comparator, and save-on-change behavior. |
| `src/app/api/profile/preferences/route.ts` | New PATCH route for authenticated profile preference updates. |
| `src/lib/db/profile.ts` | Optional helper: `updateRecipeSortPreference(userId, preference)`. |

---

## Reuse pointers

| Pattern | Source file | How to reuse |
|---|---|---|
| Recipe library filters | `src/components/recipe-library.tsx` | Apply sort after the existing `scopedRecipes.filter(...)` pipeline. |
| Profile reads | `src/lib/db/profile.ts` | Use `getProfile()` in the server page or add a focused helper if the page should avoid pulling full profile logic inline. |
| Auth-required API routes | Existing routes under `src/app/api/` | Use `createClient()`, `auth.getUser()`, and `NextResponse.json({ error }, { status })`. |
| Toast feedback | `src/components/recipe-library.tsx` | Reuse existing `sonner` toast import for save failure. |

---

## Open questions

1. **Should sort preference be global or per cookbook?** Recommendation: global for v1. Per-cookbook preferences add complexity without much value.
2. **Should Want to try default to newest saved instead of Ranking?** Recommendation: no. Keep one user preference across the library. If this feels odd later, add tab-specific defaults.
3. **Should sorting be URL-addressable?** Recommendation: not for v1. Persisted account preference is enough. URL params can be added later if sharing filtered views matters.

---

## Acceptance criteria

1. User opens `/recipes` for the first time and sees Ranking selected.
2. User can choose Ranking, Most recently cooked, or Most cooked.
3. Recipe list reorders immediately when the sort changes.
4. Sort runs after cookbook, Cooked/Want to try, search, cuisine, type, and tag filters.
5. Sort choice persists to `profiles.recipe_sort_preference` when changed.
6. User refreshes or logs in again and sees their last selected sort as the default.
7. Server rejects invalid sort values.
8. If saving fails, the user gets a toast and the current session still shows their chosen sort.
9. No localStorage dependency for the persisted default.
10. Ranking remains the default fallback for new users and missing values.
