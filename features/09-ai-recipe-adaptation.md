# 09 — AI Recipe Adaptation

**Status: ✅ Implemented (v1)** — dietary swaps, portion scaling, pantry substitution, and freeform adaptation, saved as linked variants.

**Priority: 1 — highest impact, no competitor does it well.**

**Depends on:** `00-shared-ai-infra` (shared Anthropic client), existing `recipes` + `ingredients` tables, existing recipe create/save flow (`POST /api/recipes`).

---

## What it builds

Any saved recipe can be transformed into a **new variant** via Claude, without ever
overwriting the original. From the recipe detail screen the cook taps **Adapt recipe**
and picks one of:

- **Dietary swap** — Make vegan / vegetarian / gluten-free / dairy-free. Claude rewrites
  ingredients and instructions, updates tags, and flags where the result materially
  changes (e.g. texture loss from removing eggs).
- **Portion scaling** — rescales quantities *and* adjusts things that don't scale linearly:
  cook/bake times, pan/pot sizes, oven temperatures, resting times.
- **Pantry substitution** — "I don't have…" — the cook lists missing ingredients and Claude
  proposes realistic swaps, adjusting quantities and steps.
- **Freeform** — any request in plain language ("make it spicier", "lower-carb", "kid-friendly").

The adapted result is shown as a **preview** (name, servings, warnings, substitution
notes, ingredients, instructions) before the cook saves it. Saving creates a fresh recipe
linked back to the original.

---

## User story

> As a home cook with a dairy allergy (or a doubled dinner party, or an empty pantry shelf),
> I want to take a recipe I already saved and get a version that fits my constraint — without
> losing the original and without having to mentally translate every ingredient myself.

---

## Data model

Two nullable columns on `recipes` (migration `supabase/migrations/add_recipe_adaptations.sql`):

| Column | Type | Purpose |
|---|---|---|
| `original_recipe_id` | `uuid` FK → `recipes(id)` `on delete set null` | Links a variant to the recipe it was adapted from. `NULL` for normal recipes. |
| `adaptation_metadata` | `jsonb` | Provenance of the adaptation. |

`adaptation_metadata` shape (see `AdaptationMetadata` in `src/types/database.ts`):

```jsonc
{
  "adaptation_type": "dietary_swap | portion_scaling | pantry_substitution | freeform",
  "user_request": "make it dairy-free",
  "warnings": ["Coconut cream tastes different from heavy cream…"],
  "substitution_notes": ["Butter → olive oil: less rich, more savoury"],
  "created_from_recipe_id": "<uuid>",
  "created_from_name": "Clam chowder"
}
```

`ON DELETE SET NULL` means deleting an original leaves its variants intact (just unlinked).
An index `recipes_original_recipe_id_idx` powers the "Variants" lookup.

> **Migration note:** run `supabase/migrations/add_recipe_adaptations.sql` in the Supabase
> SQL editor (same manual process as every other migration in this repo) before the save
> path will work end-to-end. `schema.sql` is kept in sync.

---

## API

**`POST /api/recipes/[id]/adapt`** — generates a draft (does **not** save).

Request body:

| Field | Type | Required | Notes |
|---|---|---|---|
| `adaptation_type` | `dietary_swap \| portion_scaling \| pantry_substitution \| freeform` | yes | |
| `request` | string | for `dietary_swap` / `freeform` | free-text instruction |
| `target_servings` | number | for `portion_scaling` | new serving count |
| `missing_ingredients` | string[] | for `pantry_substitution` | items the cook lacks |

Fetches the recipe + ingredients (ownership-checked), builds a type-specific prompt, and
calls Claude. **Model choice by complexity** (`pickModel` in `src/lib/ai/adapt-recipe.ts`):
Haiku for `dietary_swap` and `portion_scaling` (well-trodden), Sonnet for
`pantry_substitution` and `freeform` (open-ended reasoning + safety warnings).

Returns an `AdaptedRecipeDraft`: `name, description, cuisine, cook_time_minutes, servings,
difficulty, instructions, ingredients[], tags[], warnings[], substitution_notes[]` plus the
echoed provenance (`adaptation_type, user_request, created_from_recipe_id, created_from_name`).

**Saving** reuses `POST /api/recipes` — the client posts the draft with `original_recipe_id`
and `adaptation_metadata` set. That route already runs technique classification and
instruction structuring, so variants get the same treatment as any other recipe. The
original row is never touched.

Core logic lives in `src/lib/ai/adapt-recipe.ts` (`adaptRecipe`) so it is unit-testable
independent of the request layer.

---

## UI

- **Adapt recipe** button on recipe detail (`src/components/recipe-detail.tsx`).
- **`AdaptRecipeDialog`** (`src/components/adapt-recipe-dialog.tsx`) — bottom sheet with quick
  actions (Make vegan / vegetarian / gluten-free / dairy-free, Scale servings, I don't have…)
  plus a freeform box, then a full **preview** with warnings surfaced prominently.
- **Save as new variant** → navigates to the new recipe. A toast confirms.
- On the **original**, a **Variants** section lists adapted children (with their adaptation type).
- On a **variant**, an **Adapted from [original]** banner links back to the source.

---

## Safety / product behaviour

- Claude is instructed to flag **material changes** in `warnings` (texture, flavour, rise,
  browning, cook time) — e.g. removing eggs from a cake reduces rise and makes it denser.
- Claude must **not claim a substitute is equivalent** when it isn't; trade-offs are stated plainly.
- The original recipe is **never overwritten** — a variant is always a new row.
- Any `Source:` attribution line in the original instructions is **preserved** in the adaptation.

---

## Verification (v1)

- `npm run typecheck` and `npm run build` pass.
- Live test against a real recipe ("Clam chowder", 4 servings):
  - **Dairy-free swap** → all dairy removed, servings preserved (4), honest warnings
    (coconut cream ≠ heavy cream), substitution notes; original untouched.
  - **Scale 4 → 8** → quantities doubled, cook time 40 → 45 min, larger-pot warning.
- By construction: original is unchanged (fresh insert) and each variant carries
  `original_recipe_id` + `adaptation_metadata` linking it back.

---

## Future work

- **Dietary-aware meal planning** — filter/adapt weekly suggestions to household constraints
  automatically (ties into `08-smart-meal-planning`).
- Structured, per-ingredient substitution mapping (currently prose notes).
- "Re-adapt" a variant, and de-duplication when the same adaptation is requested twice.
