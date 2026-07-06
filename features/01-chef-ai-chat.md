# 01 — Chef AI: Interactive Cooking Coach

**Depends on:** `00-shared-ai-infra.md` (streaming pattern + `SONNET` constant)

---

## Summary

A streaming chat agent that walks the user through a recipe step by step. Launched from
the recipe detail page. Maintains conversation history client-side so the user can ask
free-form questions mid-cook and get answers grounded in the specific recipe before the
agent continues guidance.

---

## User story

> As a home cook opening a recipe, I want to tap "Cook with Chef AI" and have the AI
> walk me through each step one at a time — waiting for me to say "done" before
> continuing — and answer questions like "what does fold mean?" or "can I use olive oil
> instead?" without losing my place in the recipe.

**Entry point:** "Cook with Chef AI" button on the recipe detail page (`recipe-detail.tsx`).

---

## Product considerations

- **Step-by-step pacing:** Chef AI opens by greeting the user and presenting step 1. It
  waits for the user to confirm ("done", "next", "ok", etc.) before advancing. It does not
  dump all steps at once.
- **Free-form Q&A:** The user can ask anything mid-cook. Chef AI answers in context (using
  the recipe's specific ingredients and quantities) and then offers to continue from the
  current step.
- **Ephemeral sessions (v1):** No chat history is persisted. Closing the drawer ends the
  session. This keeps DB scope minimal — revisit in v2 if users request history.
- **Streaming is required:** Sonnet responses for multi-step guidance take several seconds.
  Streaming tokens progressively prevents a dead UI during generation.
- **Mobile-first:** The app is a mobile PWA. The chat UI must work at narrow widths, with
  the keyboard raised (the drawer should scroll independently of the page).
- **Model choice:** Use `SONNET` (not `HAIKU`). This is the primary user-facing AI
  interaction and quality matters — the chef persona needs to be coherent, patient, and
  contextually accurate.

---

## DB changes

None for v1. Chat history is held entirely in client-side React state.

---

## API / server work

### New route: `POST /api/recipes/[id]/chat`

File: `src/app/api/recipes/[id]/chat/route.ts`

**Request body:**
```ts
{
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}
```

**Server logic:**
1. Auth-gate: `createClient()` + `supabase.auth.getUser()` → 401 if no user.
2. Async params: `const { id } = await params` (existing convention in all `[id]` routes).
3. Load recipe: call `getRecipe(id)` from `src/lib/db/recipes.ts`. This returns
   `RecipeWithDetails` including `name`, `instructions`, and `ingredients[]`.
4. Build a **system prompt** that fully contextualizes the recipe. Example shape:
   ```
   You are Chef AI, a warm and patient cooking coach inside the PrepTable app.
   You are helping the user cook: [recipe name].

   RECIPE DETAILS:
   Servings: [n]
   Cook time: [n] minutes

   INGREDIENTS:
   - [quantity] [unit] [name] ([category])
   ...

   INSTRUCTIONS:
   [full instructions text]

   COACHING RULES:
   - Present one step at a time. After presenting a step, wait for the user to say
     they're ready before giving the next step.
   - If the user asks a question, answer it using the specific ingredients and
     quantities from this recipe, then offer to continue from the current step.
   - Be warm, encouraging, and concise. Never dump all steps at once.
   - If the user says "done", "next", "ok", "ready", or similar, advance to the
     next step.
   - When all steps are complete, congratulate the user.
   ```
5. Return a **streaming SSE response** using the pattern from `00-shared-ai-infra.md`:
   `anthropic.messages.stream({ model: SONNET, system: systemPrompt, messages, max_tokens: 1024 })`

**Note:** `instructions` is a single `text` blob on the `recipes` table (not a structured
steps array). The system prompt passes it verbatim; the model handles step extraction.
`ingredients` come from the `ingredients[]` join included in `getRecipe()`.

---

## UI work

### Option A (recommended for v1): `BottomSheet` chat drawer on `recipe-detail.tsx`

Add a "Cook with Chef AI" button to `recipe-detail.tsx` (below the title, alongside the
existing cook/rank/cookbook action buttons). Tapping it opens a `BottomSheet` with
`zIndex="top"` (the existing `elevated`/`top` z-index options in `BottomSheet`).

**Chat drawer structure:**
- Fixed header: "Chef AI" title + close button.
- Scrollable message list (`overflow-y-auto`, fixed height = viewport minus keyboard).
  Each message is a styled bubble — assistant on the left (warm-off-white `bg-card`),
  user on the right (`bg-brand text-brand-foreground`).
- Assistant messages stream token-by-token (update the last message in state as chunks
  arrive from the SSE reader).
- Fixed input bar at the bottom: `<Textarea>` (auto-resize) + Send `<Button>`. Disable
  send while streaming. Show a subtle "typing…" indicator (three animated dots) while
  waiting for the first chunk.
- On open: fire an initial `POST /api/recipes/[id]/chat` with an empty `messages` array
  so Chef AI sends its opening greeting + step 1 automatically.

**Option B (alternative):** A dedicated `/recipes/[id]/cook` route with a full-page chat
layout. More vertical space, but more navigation overhead. Recommended only if the
BottomSheet proves too cramped on small phones after testing.

### Primitives to use

- `BottomSheet` from `src/components/ui/bottom-sheet.tsx` — the app-native mobile bottom
  sheet; use `zIndex="top"` so it sits above all other sheets.
- `Sheet` from `src/components/ui/sheet.tsx` — alternative if a slide-in side panel is
  preferred on wider screens.
- `Button` from `src/components/ui/button.tsx`.
- `Textarea` from `src/components/ui/textarea.tsx`.
- No new shadcn primitives needed for the chat UI.

### Styling conventions

- Use Tailwind v4 semantic tokens (`bg-card`, `bg-brand`, `text-brand-foreground`,
  `text-muted-foreground`, `border-border`). Do not use raw `orange-*` / `gray-*`.
- Font: `font-heading` for the drawer title ("Chef AI"), `font-sans` for messages.
- The existing "cooking" accent (amber — `--cooking`) is a natural fit for the Chef AI
  UI. Check `src/app/globals.css` for the exact token name and apply consistently.

---

## Reuse pointers

| What | Where |
|------|-------|
| Streaming route pattern | `features/00-shared-ai-infra.md` |
| `SONNET` constant | `src/lib/anthropic.ts` (add per spec 00) |
| `getRecipe(id)` — loads recipe + ingredients + log | `src/lib/db/recipes.ts` |
| Supabase server client + auth gate pattern | `src/lib/supabase/server.ts` |
| Async dynamic params convention | `src/app/api/recipes/[id]/rank/route.ts` (reference) |
| `BottomSheet` primitive | `src/components/ui/bottom-sheet.tsx` |
| Recipe detail component (where button is added) | `src/components/recipe-detail.tsx` |
| Existing action button style (cook/rank) | `src/components/recipe-detail.tsx` ~line 100 |
| Cooking accent token | `src/app/globals.css` — `--cooking` family |

---

## Open questions

- Does the modified Next 16 streaming route need any special `export const dynamic` or
  `export const runtime` config for SSE? Check
  `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`.
- Should the initial greeting be hard-coded ("Let's make [name]! Here's step 1…") or
  generated by the model? Model-generated is richer but costs one extra round-trip before
  the user sees anything. Consider a hard-coded preamble + first streaming message.

---

## Acceptance criteria

- [ ] "Cook with Chef AI" button appears on every recipe detail page.
- [ ] Tapping it opens the chat drawer and Chef AI immediately streams a greeting + step 1
  without the user having to type anything.
- [ ] Typing "done" / "next" in the input causes Chef AI to advance to the next step.
- [ ] Asking a free-form question returns a contextual answer that references the recipe's
  specific ingredients/quantities, then offers to continue.
- [ ] Tokens stream visibly (text appears progressively, not all at once after a delay).
- [ ] Closing and reopening the drawer starts a fresh session (no state persistence).
- [ ] The UI is usable on a 390px-wide screen with the keyboard raised.
