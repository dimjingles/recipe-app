# 03 — Technique Taxonomy

**Build this before:** `04-recipe-technique-breakdown.md`, `05-skill-progression.md`,
`06-gamified-skill-map.md`. All three depend on the catalogue and classification system
defined here.

---

## Summary

A curated, seeded catalogue of cooking techniques with categories, descriptions, and
prerequisite relationships. A lightweight AI classification util tags each recipe with
techniques from this controlled vocabulary. User progress (which techniques are mastered)
is tracked in `profiles.skill_profile`. This is the shared backbone that makes badges,
skill progression, and the gamified map all consistent with each other.

---

## User story

There is no direct user-facing UI for this feature. Its effects are visible through the
three dependent features. The internal outcome: every recipe knows what techniques it
requires, and the user's profile tracks which techniques they've mastered.

---

## Product considerations

- **Fixed, curated catalogue** (not freeform AI tags). Techniques are a seeded SQL table.
  This enables a real prerequisite tree, consistent badge labels, and reliable gamification.
  AI classifies recipes *against this vocabulary* (controlled output), not freely.
- **~30 techniques at launch** is enough for a usable tree without being overwhelming.
  The catalogue can be extended later via new seed SQL.
- **Prerequisites define the skill tree.** A technique is only "unlocked" once all its
  prerequisites are mastered. Example: `braise` requires `sear` and `simmer`. The tree
  does not need to be deeply complex — 1–2 prerequisites per technique is sufficient.
- **Techniques table is public read** (not user-scoped). All users see the same catalogue.
  Only user progress (`skill_profile` on `profiles`) is user-scoped.
- **Classification runs once per recipe** (at import or first save) and is stored on the
  recipe row (`recipes.techniques text[]`). It is not re-inferred on every page load.
- **`profiles.skill_level`** (beginner/getting_there/confident/pro) already exists and
  should seed the initial `skill_profile.difficulty_ceiling` when a user's profile is
  first enriched with the new `skill_profile` column.

---

## DB changes

### 1. New `techniques` table

```sql
-- supabase/migrations/add_techniques.sql
create table if not exists techniques (
  key text primary key,             -- canonical slug, e.g. 'braise', 'julienne'
  label text not null,              -- display name, e.g. 'Braising'
  category text not null,           -- 'Heat & Cooking Methods' | 'Knife Skills' | 'Baking & Pastry' | 'Sauce & Emulsification' | 'Preservation'
  description text not null,        -- 1–2 sentence plain-English explanation
  prerequisites text[] default '{}'  -- array of technique keys that must be mastered first
);

-- Public read, no insert/update/delete for users (catalogue is app-managed)
alter table techniques enable row level security;
create policy "techniques are public read" on techniques for select using (true);
```

**Seed data (initial catalogue — ~30 techniques):**

```sql
insert into techniques (key, label, category, description, prerequisites) values
-- Heat & Cooking Methods
('sear',      'Searing',       'Heat & Cooking Methods', 'Cooking food at high heat to develop a browned, flavourful crust before finishing by another method.', '{}'),
('simmer',    'Simmering',     'Heat & Cooking Methods', 'Cooking liquid just below boiling (around 85–95°C) so small bubbles break gently at the surface.', '{}'),
('boil',      'Boiling',       'Heat & Cooking Methods', 'Cooking food in a full rolling boil (100°C); used for pasta, eggs, vegetables.', '{}'),
('saute',     'Sautéing',      'Heat & Cooking Methods', 'Cooking food quickly in a small amount of fat over high heat while keeping it moving.', '{}'),
('roast',     'Roasting',      'Heat & Cooking Methods', 'Cooking food uncovered in an oven using dry heat; ideal for meats and vegetables.', '{}'),
('steam',     'Steaming',      'Heat & Cooking Methods', 'Cooking food suspended over boiling water using steam; preserves nutrients and moisture.', '{}'),
('fry',       'Frying',        'Heat & Cooking Methods', 'Cooking food submerged or partially submerged in hot oil.', '{}'),
('braise',    'Braising',      'Heat & Cooking Methods', 'Slow-cooking food in a covered pot with a small amount of liquid after an initial sear; breaks down tough cuts.', '{"sear","simmer"}'),
('stew',      'Stewing',       'Heat & Cooking Methods', 'Slow-cooking food fully submerged in liquid over low heat; similar to braising but with more liquid.', '{"simmer"}'),
('grill',     'Grilling',      'Heat & Cooking Methods', 'Cooking food on a grate over direct dry heat (gas, charcoal, or electric).', '{}'),
('poach',     'Poaching',      'Heat & Cooking Methods', 'Cooking food gently in liquid kept between 70–80°C; great for eggs, fish, and chicken.', '{"simmer"}'),
('blanch',    'Blanching',     'Heat & Cooking Methods', 'Briefly boiling food then plunging it into ice water to stop cooking; sets colour and texture.', '{"boil"}'),
('deglaze',   'Deglazing',     'Heat & Cooking Methods', 'Adding liquid to a hot pan to lift browned bits (fond) and create a sauce base.', '{"sear","saute"}'),
('reduce',    'Reducing',      'Heat & Cooking Methods', 'Simmering a liquid to evaporate water and concentrate flavour.', '{"simmer"}'),
-- Knife Skills
('dice',      'Dicing',        'Knife Skills', 'Cutting food into uniform cubes; sizes range from small (brunoise) to large.', '{}'),
('julienne',  'Julienne',      'Knife Skills', 'Cutting food into thin matchstick strips, typically 3mm × 3mm × 6cm.', '{"dice"}'),
('chiffonade','Chiffonade',    'Knife Skills', 'Stacking leafy greens or herbs, rolling them, and slicing into thin ribbons.', '{"dice"}'),
('mince',     'Mincing',       'Knife Skills', 'Chopping food (usually garlic or herbs) into very small, uniform pieces.', '{"dice"}'),
-- Baking & Pastry
('fold',      'Folding',       'Baking & Pastry', 'Gently combining a light airy mixture into a heavier one using a spatula to preserve volume.', '{}'),
('cream',     'Creaming',      'Baking & Pastry', 'Beating butter and sugar together until light and fluffy to incorporate air.', '{}'),
('proof',     'Proofing',      'Baking & Pastry', 'Allowing yeast dough to rise so it develops flavour and the gluten structure relaxes.', '{}'),
('knead',     'Kneading',      'Baking & Pastry', 'Working dough by pressing and folding to develop gluten structure for chewy baked goods.', '{}'),
('laminate',  'Laminating',    'Baking & Pastry', 'Folding butter into dough repeatedly to create flaky, layered pastry (croissants, puff pastry).', '{"fold","knead"}'),
-- Sauce & Emulsification
('emulsify',  'Emulsifying',   'Sauce & Emulsification', 'Combining two liquids that normally separate (e.g. oil and water) into a stable mixture, as in mayonnaise or vinaigrette.', '{}'),
('roux',      'Making a Roux', 'Sauce & Emulsification', 'Cooking flour and fat together as the base for sauces like béchamel or velouté.', '{"saute"}'),
('temper',    'Tempering',     'Sauce & Emulsification', 'Gradually raising the temperature of a sensitive ingredient (eggs, chocolate) to incorporate it into a hot mixture without curdling.', '{}'),
('beurre_blanc', 'Beurre Blanc', 'Sauce & Emulsification', 'A classic French butter sauce made by whisking cold butter into a wine-vinegar reduction.', '{"reduce","emulsify"}'),
-- Preservation
('cure',      'Curing',        'Preservation', 'Preserving food using salt, sugar, or a combination to draw out moisture and prevent spoilage.', '{}'),
('pickle',    'Pickling',      'Preservation', 'Preserving food in an acidic brine (vinegar-based) or through lacto-fermentation.', '{}'),
('ferment',   'Fermenting',    'Preservation', 'Using microorganisms (bacteria, yeast) to convert sugars into acids, gases, or alcohol; used for kimchi, yogurt, bread.', '{"pickle"}')
;
```

### 2. Add `recipes.techniques text[]`

```sql
-- supabase/migrations/add_techniques.sql (continued)
alter table recipes add column if not exists techniques text[] default '{}';
```

### 3. Add `skill_profile jsonb` to `profiles`

```sql
alter table profiles add column if not exists skill_profile jsonb default '{}'::jsonb;
```

**`skill_profile` shape:**
```ts
{
  techniques_mastered: string[],   // technique keys the user has used in cooked recipes
  techniques_seen: string[],       // keys Chef AI has introduced (unlocked but not yet cooked)
  difficulty_ceiling: 1 | 2 | 3,  // inferred from existing recipes / profiles.skill_level
  last_stretch_technique: string | null  // last technique Chef AI pushed them toward
}
```

Seed `difficulty_ceiling` from existing `profiles.skill_level`:
- `'beginner'` → 1, `'getting_there'` → 1, `'confident'` → 2, `'pro'` → 3.

Also fold all three SQL changes into `supabase/schema.sql`.

---

## API / server work

### 1. AI classification util: `src/lib/ai/classify-techniques.ts`

A server-side function (not a Route Handler — it's called internally by other routes).

```ts
import { anthropic, HAIKU } from '@/lib/anthropic'

/** Returns technique keys from the catalogue that this recipe uses. */
export async function classifyTechniques(
  recipeName: string,
  instructions: string,
  allKeys: string[]  // the full catalogue keys, passed in so the caller controls the vocab
): Promise<string[]> {
  const message = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `You are a culinary expert. Given the cooking instructions for "${recipeName}", identify which of the following cooking techniques are used.

Techniques catalogue (use ONLY keys from this list):
${allKeys.join(', ')}

Instructions:
${instructions.slice(0, 3000)}

Return ONLY a valid JSON array of matching technique keys. If none match, return [].
Example: ["sear", "simmer", "deglaze"]`
    }]
  })
  const content = message.content[0]
  if (content.type !== 'text') return []
  try {
    const arr = JSON.parse(content.text.match(/\[[\s\S]*\]/)?.[0] ?? '[]')
    return arr.filter((k: unknown) => typeof k === 'string' && allKeys.includes(k))
  } catch {
    return []
  }
}
```

- Uses `HAIKU` (fast, cheap — classification is a short task).
- Validates returned keys against the catalogue to prevent hallucinated keys.
- Caps instructions at 3000 chars to control token cost.

### 2. Trigger classification on recipe import and save

**On import** (`src/app/api/recipes/import/route.ts`): after the recipe is saved to the
DB, call `classifyTechniques` and update `recipes.techniques`. This can be async/non-
blocking (fire and forget after the user gets their confirmation).

**On create** (`src/app/api/recipes/route.ts` POST): same — classify after insert.

**On update** (`src/app/api/recipes/[id]/route.ts` PATCH): re-classify if `instructions`
changed.

**Fetching catalogue keys efficiently:** Cache the full keys list in a module-level
variable or use a lightweight in-memory cache (revalidated on cold start). Avoid fetching
the full `techniques` table on every recipe save — fetch once and reuse within the
request.

### 3. Extend `createRecipe` / `updateRecipe` in `src/lib/db/recipes.ts`

Current gap: `createRecipe` does not accept `techniques`; `updateRecipe` does not accept
`difficulty` or `techniques`. Both need to be extended:
- `createRecipe`: add `techniques?: string[]` to the input type and insert it.
- `updateRecipe`: add `difficulty?: number | null` and `techniques?: string[]` to the
  input type and patch them.

---

## TypeScript types

Update `src/types/database.ts`:

1. Add `Technique` Row/Insert/Update types for the new `techniques` table.
2. Add `techniques: string[] | null` to `recipes` Row type.
3. Add `skill_profile: SkillProfile | null` to `profiles` Row type.
4. Export `SkillProfile` interface matching the jsonb shape above.
5. Export `Technique` row alias.

---

## UI work

None for this feature — the catalogue and classification are backend-only. The UI
manifestations are in specs 04, 05, and 06.

---

## Reuse pointers

| What | Where |
|------|-------|
| Shared Anthropic client + `HAIKU` | `src/lib/anthropic.ts` |
| `extractJsonArray` helper | `src/lib/anthropic.ts` |
| Supabase server client | `src/lib/supabase/server.ts` |
| `createRecipe` / `updateRecipe` (to extend) | `src/lib/db/recipes.ts` |
| `getProfile()` (for seeding skill_profile) | `src/lib/db/profile.ts` |
| `completeOnboarding` / upsert pattern | `src/lib/db/profile.ts` |
| Import route (trigger point for classification) | `src/app/api/recipes/import/route.ts` |
| Recipe create route (trigger point) | `src/app/api/recipes/route.ts` |
| Recipe update route (trigger point) | `src/app/api/recipes/[id]/route.ts` |
| schema.sql (source of truth) | `supabase/schema.sql` |
| database.ts types | `src/types/database.ts` |

---

## Open questions

- Should `classifyTechniques` block recipe creation (synchronous) or be fire-and-forget?
  Fire-and-forget is better UX (recipe saves instantly) but means `techniques` is empty
  briefly. A background approach is fine for v1.
- What's the right catalogue size? ~30 techniques is proposed. Too few = no progression
  depth. Too many = overwhelming skill tree. Review the seed list above before shipping.
- Should classification run retroactively on existing recipes? If so, a one-off migration
  script would be needed. Defer to a follow-up.

---

## Acceptance criteria

- [ ] `techniques` table exists in Supabase with the seeded catalogue (~30 rows).
- [ ] `recipes.techniques text[]` column exists.
- [ ] `profiles.skill_profile jsonb` column exists.
- [ ] `classifyTechniques()` returns only valid catalogue keys (no hallucinations).
- [ ] New and imported recipes have `techniques[]` populated within a reasonable delay.
- [ ] `createRecipe` and `updateRecipe` accept and persist `techniques` and `difficulty`.
- [ ] TypeScript types in `database.ts` reflect all new columns.
- [ ] All RLS policies are in place — techniques are public read; skill_profile is gated
  to the owning user via `profiles` policies.
