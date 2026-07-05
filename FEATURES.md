# Mise en Place — Feature Backlog

Per-feature specs live in `features/`. Each spec file has a full product brief, DB
changes, API/server work, UI work, exact reuse pointers, and acceptance criteria. Read
a single spec file to build a single feature — all context is self-contained.

---

## Build order & dependency graph

```
00-shared-ai-infra ─┬─> 01-chef-ai-chat
                    └─> 02-chef-ai-recommend

03-technique-taxonomy ─┬─> 04-recipe-technique-breakdown
                       ├─> 05-skill-progression ──> 06-gamified-skill-map
                       └─> 06-gamified-skill-map

01 + 03 + 05 together complete the "skill-stretch" behaviour in Chef AI chat.
07-image-search is fully independent — can be built any time.
```

**Recommended sequence:** `00 → 07 → 01 → 02 → 03 → 04 → 05 → 06`

Start with `00` to lay the streaming/model foundations, then `07` as an early independent
win, then the Chef AI and technique tracks in dependency order.

---

## Pending features

| # | Spec file | What it builds | Depends on |
|---|-----------|---------------|------------|
| 00 | [features/00-shared-ai-infra.md](features/00-shared-ai-infra.md) | Streaming foundations + SONNET model constant | — |
| 07 | [features/07-image-search.md](features/07-image-search.md) | "Search online" third tab in the image picker | — |
| 01 | [features/01-chef-ai-chat.md](features/01-chef-ai-chat.md) | Streaming step-by-step cooking coach chat | 00 |
| 02 | [features/02-chef-ai-recommend.md](features/02-chef-ai-recommend.md) | Surface existing recommendation route in Chef AI | 00 |
| 03 | [features/03-technique-taxonomy.md](features/03-technique-taxonomy.md) | Curated technique catalogue + recipe classification | — |
| 04 | [features/04-recipe-technique-breakdown.md](features/04-recipe-technique-breakdown.md) | Technique mastery badges on the recipe detail page | 03, 05 |
| 05 | [features/05-skill-progression.md](features/05-skill-progression.md) | Chef AI stretches user toward harder techniques | 00, 03 |
| 06 | [features/06-gamified-skill-map.md](features/06-gamified-skill-map.md) | "My Skills" gamified skill tree page | 03, 05 |

---

## Done

### AI-generated cooking instructions
Generate step-by-step instructions for a recipe using AI, based on the ingredients and
dish name. User can review and edit before saving.

- **Implementation:** Added `/api/recipes/generate-instructions` POST route that calls
  Claude Haiku with recipe name + ingredients. Returns instructions text + inferred
  difficulty (1–3). Both `recipe-editor.tsx` and `edit-recipe-form.tsx` have a "Generate
  with AI" button next to the instructions textarea.

### Difficulty rating (knife emojis)
Add a difficulty field (1–3) represented visually as 🔪 / 🔪🔪 / 🔪🔪🔪. Difficulty is
inferred from the instructions by AI as a default, but the user can override it. Store as
an integer (1, 2, or 3) in the database.

- **Implementation:** Added `difficulty integer check (difficulty between 1 and 3)` column
  via `supabase/migrations/add_difficulty.sql`. Updated `types/database.ts` Row/Insert
  types. Three-button picker in both editor forms. AI infers during instruction generation.
  Displayed as knife emojis on recipe detail page. User can override freely.

### Recipe tags
Support common tags for filtering and browsing: Vegan, Vegetarian, Gluten-Free,
Dairy-Free, Nut-Free, Spice Level (Mild / Medium / Hot), Quick (<30 min), Meal Prep.
Tags should be selectable via a multi-select chip UI. Allow user-defined custom tags as
well.

- **Implementation:** Replaced the comma-separated text input with a chip-based
  multi-select UI in both `recipe-editor.tsx` and `edit-recipe-form.tsx`. Predefined tags
  are toggle-able chips; custom tags can be typed in an input below and added as chips with
  an X to remove. Added tag filter chip row in `recipe-library.tsx`. Backed by existing
  `tags text[]` column.

### Recipe image
Images are extracted from the source URL on import (JSON-LD `image` field, falling back
to `og:image`). Displayed as hero on the detail page and as thumbnails in the library
list. Stored as `image_url` in the recipes table.
