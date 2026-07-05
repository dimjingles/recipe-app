# 07 — Image Search

**Depends on:** Nothing. This is fully independent — build any time.

---

## Summary

Add a "Search online" third tab to the image picker in `recipe-gallery.tsx`, alongside
the existing "Paste URL" and "Upload" tabs. The user's recipe title pre-fills a search
query; results are shown as a thumbnail grid; the user picks one and it's added to the
recipe's gallery (or set as the hero image).

---

## User story

> As a user who saved a recipe manually (typed in or AI-generated), I want to find a
> photo for it without having to leave the app and hunt for an image URL — I just want
> to tap "Search online" and pick from results.

**Entry point:** New "Search online" tab inside the existing image picker `BottomSheet`
on the recipe detail page.

---

## Product considerations

- **Pre-fill the query with the recipe title.** Let the user edit it before searching (e.g.
  they might want "chocolate lava cake cross section" instead of just "Chocolate Lava Cake").
- **Image API: Google Programmable Search Engine (PSE) / Custom Search JSON API.**
  This is the practical, legitimate way to query Google Images programmatically. Setup:
  1. Create a Programmable Search Engine at https://programmablesearchengine.google.com,
     scoped to the whole web, image-search enabled.
  2. Enable the Custom Search JSON API in Google Cloud Console.
  3. Store `GOOGLE_CSE_ID` and `GOOGLE_CSE_API_KEY` in `.env.local`. Add both to
     `.env.local.example`.
  Free tier: 100 queries/day. Paid: $5 per 1,000 queries beyond that.
  Note: there is no fully free, license-clean image search API. PSE is the right call.
- **Server-side API call only.** API keys must never reach the client. The search goes
  through a new Next route handler.
- **Attribution.** Display the source domain under each thumbnail. This is both good
  practice and a condition of the CSE terms of service.
- **Caching per query.** Cache search results in memory (module-level Map with a TTL, or
  a simple Supabase table if you want persistence) so repeated searches for the same
  recipe title don't burn quota. For v1, a module-level in-memory cache is fine.
- **Selected image lands in `gallery_images` via the existing `/api/recipes/[id]/images`
  route.** No new DB column or write path needed.
- **Hero image gap.** Currently `image_url` (the hero displayed at top of the detail page
  and in library thumbnails) is only set during import — there is no UI to change it
  after the fact. The image picker is a natural place to also offer "Set as cover photo."
  Implement this as an optional enhancement: if the gallery is empty and the user picks
  an image, offer to set it as the cover. Requires a PATCH to `/api/recipes/[id]`
  updating `image_url` — the existing PATCH route already accepts `image_url`.
- **Grid layout.** Show 6–9 thumbnails per search (Google CSE returns up to 10 per
  request). A 3-column grid works well at mobile widths.

---

## DB changes

None. Selected images are stored in the existing `recipes.gallery_images text[]` column
via the existing POST `/api/recipes/[id]/images` route.

Optionally update `recipes.image_url` via existing PATCH `/api/recipes/[id]` if "Set as
cover" is implemented.

---

## API / server work

### New route: `GET /api/images/search?q={query}&recipeId={id}`

File: `src/app/api/images/search/route.ts`

**Server logic:**
1. Auth gate: `createClient()` + `supabase.auth.getUser()` → 401.
2. Read `q` from search params; 400 if missing or empty.
3. Optionally sanitize `q` (trim, max 100 chars).
4. Check in-memory cache for this query. Return cached result if fresh (TTL: 10 minutes).
5. Call Google Custom Search JSON API:
   ```
   https://www.googleapis.com/customsearch/v1
     ?key={GOOGLE_CSE_API_KEY}
     &cx={GOOGLE_CSE_ID}
     &q={encodeURIComponent(q)}
     &searchType=image
     &num=9
     &safe=active
     &imgType=photo
     &imgSize=medium
   ```
6. Map response items to a clean shape:
   ```ts
   type ImageResult = {
     thumbnailUrl: string   // item.image.thumbnailLink
     fullUrl: string        // item.link
     sourceDomain: string   // new URL(item.link).hostname
     title: string          // item.title
   }
   ```
7. Store in cache. Return `{ results: ImageResult[] }`.
8. On Google API error, return `{ results: [], error: 'Search unavailable' }` (graceful
   degradation — don't 500 the UI).

**Important:** `recipeId` is optional in the route — the route is intentionally generic
(search by any query). The client passes `recipeId` so it can subsequently POST to
`/api/recipes/[recipeId]/images` after the user picks.

---

## UI work

### Changes to `src/components/recipe-gallery.tsx`

This component is ~225 lines. The tab state currently is:
```ts
const [tab, setTab] = useState<'url' | 'upload'>('url')
```

Extend to a three-value union:
```ts
const [tab, setTab] = useState<'url' | 'upload' | 'search'>('url')
```

**Add a third tab button** to the existing segmented control (mirror the exact pattern
already used for URL and Upload tabs):
```tsx
<button onClick={() => setTab('search')}
  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
    tab === 'search' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
  <Search className="w-3.5 h-3.5" /> Search
</button>
```
`Search` is available from `lucide-react`.

**New "Search online" tab content:**

```tsx
{tab === 'search' && (
  <div>
    <div className="flex gap-2 mb-4">
      <Input
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSearch()}
        placeholder="Search for images…"
      />
      <Button onClick={handleSearch} disabled={isSearching}>
        {isSearching ? <Shimmer className="w-12 h-4" /> : 'Search'}
      </Button>
    </div>

    {searchResults.length > 0 && (
      <div className="grid grid-cols-3 gap-2">
        {searchResults.map(result => (
          <button key={result.fullUrl} onClick={() => handlePickImage(result)}
            className="relative aspect-square rounded-xl overflow-hidden border border-border">
            <img src={result.thumbnailUrl} alt={result.title}
                 className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
              <span className="text-white text-[9px] truncate block">{result.sourceDomain}</span>
            </div>
          </button>
        ))}
      </div>
    )}

    {searchResults.length === 0 && !isSearching && hasSearched && (
      <p className="text-sm text-muted-foreground text-center py-6">No results. Try a different search.</p>
    )}
  </div>
)}
```

**`handlePickImage(result)` logic:**
1. POST `result.fullUrl` to `/api/recipes/[id]/images` (existing endpoint — same as
   the URL tab, just pre-filled with the search result URL rather than user-typed).
2. On success, update local `galleryImages` state + call `router.refresh()` (same pattern
   as the URL tab).
3. Optionally: if `galleryImages` is currently empty, show a "Set as cover photo?" prompt
   before adding. On confirm, PATCH `/api/recipes/[id]` with `{ image_url: result.fullUrl }`.

**State additions to `recipe-gallery.tsx`:**
```ts
const [searchQuery, setSearchQuery] = useState(recipe.name)  // pre-fill with recipe title
const [searchResults, setSearchResults] = useState<ImageResult[]>([])
const [isSearching, setIsSearching] = useState(false)
const [hasSearched, setHasSearched] = useState(false)
```

**`handleSearch`:**
```ts
async function handleSearch() {
  if (!searchQuery.trim()) return
  setIsSearching(true)
  setHasSearched(true)
  try {
    const res = await fetch(`/api/images/search?q=${encodeURIComponent(searchQuery)}&recipeId=${recipe.id}`)
    const { results } = await res.json()
    setSearchResults(results ?? [])
  } catch {
    setSearchResults([])
  } finally {
    setIsSearching(false)
  }
}
```

### Primitives to use

- `Input` from `src/components/ui/input.tsx`.
- `Button` from `src/components/ui/button.tsx`.
- `Shimmer` from `src/components/ui/shimmer.tsx` (for the search loading state).
- No new shadcn primitives needed.

---

## Reuse pointers

| What | Where |
|------|-------|
| `recipe-gallery.tsx` — the file to extend | `src/components/recipe-gallery.tsx` |
| Existing segmented tab pattern (to mirror for 3rd tab) | `src/components/recipe-gallery.tsx` ~line 60 |
| Existing URL-add flow (`POST /api/recipes/[id]/images`) | `src/app/api/recipes/[id]/images/route.ts` |
| Existing PATCH route (for `image_url` cover photo) | `src/app/api/recipes/[id]/route.ts` |
| Supabase server client + auth gate pattern | `src/lib/supabase/server.ts` |
| `Input`, `Button`, `Shimmer` primitives | `src/components/ui/` |
| SSRF protection pattern (for reference) | `src/app/api/recipes/import/route.ts` — `isBlockedHost()`, `validateUrl()` |

---

## Open questions

- Should the search tab default to being visible only when the recipe has a name (so the
  pre-fill is useful)? Recipes created from scratch always have a name at the point of
  opening the gallery — this shouldn't be an issue.
- How should the "Set as cover photo?" prompt be surfaced? A `Dialog` confirmation is the
  clearest UX. `Dialog` from `src/components/ui/dialog.tsx` is already available.
- Is 100 queries/day enough for the current user base? At one search per recipe-save, this
  comfortably handles dozens of users. Revisit when the app scales.

---

## Acceptance criteria

- [ ] A "Search online" tab appears in the image picker alongside "Paste URL" and "Upload".
- [ ] The search query is pre-filled with the recipe title.
- [ ] Tapping "Search" returns a 3-column thumbnail grid with source domain attribution.
- [ ] Tapping a thumbnail adds it to `gallery_images` and closes/resets the search tab.
- [ ] API keys (`GOOGLE_CSE_ID`, `GOOGLE_CSE_API_KEY`) are never exposed to the client.
- [ ] If the Google API is unavailable or returns an error, the tab shows a graceful
  error message rather than crashing.
- [ ] The UI is usable on a 390px-wide screen.
- [ ] `.env.local.example` documents the two new env vars.
