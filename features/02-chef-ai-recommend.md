# 02 — Chef AI: Recipe Recommendations

**Depends on:** `00-shared-ai-infra.md` (streaming pattern + `SONNET` constant)

**Important context:** The core recommendation engine **already exists.**
`/api/recipes/recommend/route.ts` fetches the user's library + onboarding profile and
returns 5 personalized suggestions as JSON. This spec is about surfacing that capability
in the right places and adding import/streaming polish — not rebuilding it.

---

## Summary

Surface the existing recommendation engine inside Chef AI chat (via natural language) and
on the recipe library page (via an explicit button). Add an "import this suggestion"
action that pre-fills the recipe editor, so a user can go from "what should I cook next?"
to a saved recipe in a few taps.

---

## User story

> As a user with a growing recipe library, I want to ask Chef AI "what should I cook
> next?" and get tailored suggestions based on what I already cook — with one tap to
> import any suggestion directly into my library.

**Entry points:**
1. Natural language inside any Chef AI chat session ("what should I cook next?",
   "suggest me something new", etc.)
2. "Suggest recipes" button on the recipe library page (`recipe-library.tsx`).

---

## Product considerations

- **The existing route is already personalized** — it uses the user's `recipes` table
  (name, cuisine, tags, cooked_count) plus onboarding `profile` (diet, favorite_cuisines,
  allergies, primary_goal, skill_level, household_size). Do not rebuild this logic.
- **Suggestions are generative, not a database query.** Chef AI describes recipes the user
  hasn't tried — they don't exist in the DB until the user imports them.
- **"Import" action:** Each suggestion card should have an "Add to library" button that
  pre-fills `RecipeEditor` with the suggestion's name, cuisine, description, and
  cook_time_minutes. `RecipeEditor` already accepts an `initialValues` prop
  (`RecipeEditorValues` interface in `recipe-editor.tsx`) — this is a zero-infrastructure
  bridge.
- **"Why" field:** The existing route already returns a `why` field per suggestion ("why
  you'd enjoy this"). Display it. It's the differentiator from a generic list.
- **Streaming (optional upgrade):** The existing route returns a single JSON blob. For the
  library-page entry point this is fine. For surfacing inside Chef AI chat, streaming the
  suggestions progressively feels more natural. Decide per entry point:
  - Library button → keep non-streaming, render all 5 cards at once.
  - Chef AI chat → stream the response, render each suggestion as its JSON object
    completes (parse incrementally).
- **Skill-aware (future):** Once `05-skill-progression.md` is built, extend the
  recommendation prompt to also factor in `skill_profile.techniques_mastered` and
  `skill_profile.difficulty_ceiling` for even more targeted suggestions. This is a deferred
  enhancement — mark it as a TODO comment in the route.

---

## DB changes

None. The existing route reads `recipes` and `profiles`; the import path reuses
`RecipeEditor` which calls `POST /api/recipes` on save.

---

## API / server work

### Existing route: `POST /api/recipes/recommend`

File: `src/app/api/recipes/recommend/route.ts` — **do not rewrite the core logic.**

Possible enhancements:
1. **Add `difficulty` and `techniques` to the recipe payload** (once `03-technique-taxonomy.md`
   is built). Update the `.select('name, cuisine, tags, cooked_count')` to also include
   `difficulty` and `techniques` so the AI has richer signals. Keep the payload lean.
2. **Model upgrade (optional):** The route currently uses `HAIKU`. If recommendation
   quality is underwhelming, upgrade to `SONNET` for this route. Trade-off: ~5× cost per
   call. Decision can be deferred until user feedback.
3. **Streaming variant (for chat integration):** If surfacing inside Chef AI chat,
   the chat route (`01-chef-ai-chat.md`) can simply call the recommendation logic inline
   rather than calling the separate HTTP endpoint — avoids an internal fetch. Extract the
   recommendation-building logic into a shared util `src/lib/ai/recommend.ts` that both
   routes can import.

### Suggested new shared util: `src/lib/ai/recommend.ts`

```ts
export async function buildRecommendationPrompt(userId: string, supabase): Promise<string> {
  // Moved from the route: fetch recipes + profile, build the prompt string.
  // Both the standalone /recommend route and the chat route can call this.
}
```

---

## UI work

### 1. Library page — "Suggest recipes" button

Add a "Suggest recipes" button to `recipe-library.tsx` (in the header bar alongside the
"Add recipe" menu, or as a secondary CTA in the empty state).

On click:
- Show a loading state (shimmer cards or a spinner — use `<Shimmer>` from
  `src/components/ui/shimmer.tsx`).
- POST to `/api/recipes/recommend`.
- Render 5 suggestion cards in a dismissible `BottomSheet` or inline panel.

**Suggestion card layout:**
```
[Recipe Name]          [cook_time]m
[cuisine chip]
[description — 2–3 sentences]
[why — italic, muted]
[Add to library button]  [Dismiss]
```

"Add to library" → `router.push('/recipes/new?name=...&cuisine=...&description=...&cook_time_minutes=...')`
passing values as query params, or hold them in client state and render `<RecipeEditor
initialValues={suggestion} />` in a nested sheet.

### 2. Chef AI chat — natural language trigger

Inside the Chef AI chat (`01-chef-ai-chat.md`), the system prompt should already instruct
the agent to offer recommendations if asked. No additional API route needed for the chat
path — the chat session handles it as a natural conversation turn.

If suggestions are returned in chat, render them as structured cards (same card layout as
above) by detecting the JSON array in the assistant response. This requires parsing the
streamed JSON once the stream is complete.

### Primitives to use

- `BottomSheet` for the suggestion sheet on the library page.
- `Button` (variant="outline" for Dismiss, variant="default" for "Add to library").
- `Shimmer` for loading state.
- Tag-chip `<span>` for the cuisine display (mirror `bg-brand-subtle text-brand
  rounded-full px-3 py-1 text-sm font-medium` from `recipe-detail.tsx`).

---

## Reuse pointers

| What | Where |
|------|-------|
| Existing recommendation route (do not rebuild) | `src/app/api/recipes/recommend/route.ts` |
| `getProfile()` — reads onboarding answers | `src/lib/db/profile.ts` |
| `RecipeEditor` + `RecipeEditorValues` interface | `src/components/recipe-editor.tsx` |
| `initialValues` prop on RecipeEditor | `src/components/recipe-editor.tsx` (prop signature) |
| `Shimmer` loading skeleton | `src/components/ui/shimmer.tsx` |
| `BottomSheet` | `src/components/ui/bottom-sheet.tsx` |
| Recipe library (where button is added) | `src/components/recipe-library.tsx` |
| Tag-chip pattern | `src/components/recipe-detail.tsx` ~line 640 |

---

## Open questions

- Should the "Add to library" action navigate to `/recipes/new` (full page) or open a
  nested `BottomSheet` with `RecipeEditor`? Full page is simpler; nested sheet keeps
  context. Decide based on how the RecipeEditor form behaves at BottomSheet height.
- Should the route be upgraded to `SONNET` at the same time? Or keep `HAIKU` and decide
  after user feedback on recommendation quality?

---

## Acceptance criteria

- [ ] A "Suggest recipes" entry point is visible on the recipe library page.
- [ ] Tapping it fetches recommendations and renders 5 suggestion cards with name,
  cuisine, description, why, and cook time.
- [ ] Each card has an "Add to library" action that pre-fills `RecipeEditor` with the
  suggestion's data.
- [ ] Dietary restrictions and allergies from the user's profile are respected — no
  suggestion violates them.
- [ ] The existing `/api/recipes/recommend` route is unchanged in its core logic.
- [ ] Loading and error states are handled gracefully.
