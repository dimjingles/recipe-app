# 05 — Chef AI: Skill Progression

**Depends on:**
- `00-shared-ai-infra.md` — streaming + `SONNET` constant.
- `03-technique-taxonomy.md` — `techniques` catalogue, `recipes.techniques[]`, and
  `profiles.skill_profile` column.

---

## Summary

Chef AI acts as a long-term cooking coach, tracking the user's current skill level and
deliberately introducing harder techniques over time. When the user asks what to cook
next, Chef AI surfaces a recipe that stretches them exactly one step beyond their comfort
zone — targeting the highest-priority technique they're ready to learn but haven't
mastered yet.

---

## User story

> As someone who wants to improve as a cook, I want Chef AI to notice what I already know
> and nudge me toward the next technique I'm ready for — not just suggest things I can
> already make, but gently push my skills forward each time I cook.

**Entry points:**
- "What should I learn next?" prompt inside any Chef AI chat session.
- Naturally folded into the recommendation flow from `02-chef-ai-recommend.md` (the
  recommendation prompt is extended to be skill-aware).

---

## Product considerations

- **Skill profile as the source of truth:** `profiles.skill_profile` (a jsonb column
  added in spec 03) is where mastery state lives. It contains:
  - `techniques_mastered` — techniques the user has genuinely cooked with (logged via
    `cooking_log`).
  - `techniques_seen` — techniques Chef AI has introduced this session; user knows about
    them but hasn't cooked them yet.
  - `difficulty_ceiling` — 1/2/3, raised over time as the user consistently cooks at
    a given level.
  - `last_stretch_technique` — the last technique Chef AI targeted; prevents bouncing
    back and forth on the same technique.
- **Mastery is earned by cooking, not just chatting.** A technique becomes "mastered"
  when the user logs a cook (`cooking_log`) for a recipe that uses that technique. The
  `logCooking()` function in `src/lib/db/recipes.ts` is the trigger point.
- **"Unlocked" ≠ "Mastered."** If Chef AI introduces a technique in chat (adds it to
  `techniques_seen`), it is unlocked for the skill map but not mastered. The user still
  needs to cook a recipe using it.
- **One new technique per cycle.** Chef AI introduces at most one new technique per
  recommendation to avoid overwhelm. It picks the technique where all prerequisites are
  already in `techniques_mastered`.
- **Difficulty ceiling progression:** If the user's last 3 logged recipes are all
  difficulty 2, raise `difficulty_ceiling` to 3. This is a simple heuristic — not ML.
- **Seeding from existing data:** On first use (when `skill_profile` is empty), seed it:
  - `difficulty_ceiling` from `profiles.skill_level` (beginner→1, getting_there→1,
    confident→2, pro→3).
  - `techniques_mastered` from all techniques present in recipes the user has already
    cooked (`cooking_log JOIN recipes WHERE techniques && recipe.techniques`).
- **Do not re-introduce already-mastered or already-seen techniques.** Once a technique
  is in either `techniques_mastered` or `techniques_seen`, Chef AI skips it when looking
  for the next stretch goal.

---

## DB changes

All columns were added in `03-technique-taxonomy.md`:
- `profiles.skill_profile jsonb` — already exists.
- `recipes.techniques text[]` — already exists.

No new columns for this feature.

### New write: update `skill_profile` after cooking

When `logCooking(recipeId)` is called (in `src/lib/db/recipes.ts`), also:
1. Fetch `recipe.techniques[]` for the cooked recipe.
2. Read the user's current `skill_profile`.
3. Merge any new technique keys into `techniques_mastered`.
4. Re-evaluate `difficulty_ceiling` based on recent cooking log.
5. Write back the updated `skill_profile`.

This can be done in the same request as the `cooking_log` insert (inside the existing
`logCooking` function), or as a separate `updateSkillProfile(userId, newKeys)` helper in
`src/lib/db/profile.ts`.

---

## API / server work

### 1. Seed / initialize skill profile: `GET /api/profile/skill-profile`

Called once when the user first visits a Chef AI feature and `skill_profile` is empty.
Builds the initial profile from existing data:

```ts
// Logic:
// 1. Fetch all recipes the user has ever cooked (from cooking_log JOIN recipes)
// 2. Collect all technique keys from those recipes
// 3. Read profiles.skill_level → map to difficulty_ceiling
// 4. Upsert profiles.skill_profile with the derived values
```

Alternatively, this seeding logic can be inlined directly inside the Chef AI chat route
(`01`) or the recommend route (`02`) rather than as a separate endpoint — run it lazily
on first call if `skill_profile` is empty or null.

### 2. Extend the recommendation route for skill awareness

In `src/app/api/recipes/recommend/route.ts` (or the shared util from spec 02), extend
the prompt context to include:

```
User skill profile:
- Techniques mastered: [list]
- Current difficulty ceiling: [1|2|3]
- Ready to learn next: [the one unlocked technique with all prerequisites met]

Please include at least one recipe that specifically uses "[ready-to-learn technique]"
so the user can advance this skill.
```

Compute "ready-to-learn" server-side before building the prompt:
1. Fetch the full `techniques` catalogue.
2. Find techniques where all prerequisites are in `techniques_mastered` and the key is
   not already in `techniques_mastered` or `techniques_seen`.
3. Pick the one that is the "closest" to the user's existing skills (fewest unmet
   prerequisites among unlocked neighbours).

### 3. Update `skill_profile` after Chef AI introduces a technique

When Chef AI's chat response includes a new technique introduction (the AI mentions a
specific technique key from the catalogue), add that key to `techniques_seen`. Two
approaches:
- **Explicit tracking in the chat route:** After a streaming response completes, run a
  quick classification call to detect which technique keys were mentioned. Write to
  `skill_profile.techniques_seen`.
- **Simpler v1 approach:** Only update `techniques_seen` when the user asks "what should
  I learn next?" and the server deliberately selects a stretch technique. Log the selected
  key immediately, without parsing the chat response.

The simpler v1 approach is recommended — parsing streamed responses for technique keys is
fragile.

### 4. Extend `logCooking` in `src/lib/db/recipes.ts`

```ts
export async function logCooking(recipeId: string, opts: { notes?: string; cooked_at?: string }) {
  // existing logic: insert cooking_log row, increment cooked_count ...

  // NEW: update skill_profile
  const recipe = await getRecipe(recipeId)
  if (recipe?.techniques?.length) {
    await updateSkillProfile(user.id, { newMasteredKeys: recipe.techniques })
  }
}
```

Add `updateSkillProfile(userId, updates)` to `src/lib/db/profile.ts`:
```ts
export async function updateSkillProfile(
  userId: string,
  updates: {
    newMasteredKeys?: string[]
    newSeenKeys?: string[]
    lastStretchTechnique?: string
  }
) {
  // Read current skill_profile, merge updates, upsert back
}
```

---

## UI work

No dedicated UI for this feature — skill progression surfaces through:
- The "Mastered/Unlocked/Locked" badge states in spec 04.
- The skill tree in spec 06.
- Chef AI chat responses that mention the stretch technique.

One optional UI addition: when Chef AI recommends a stretch recipe (in the chat or
recommendation cards from spec 02), annotate the card with a "🌱 New technique:
[Braising]" chip to make the stretch explicit.

---

## Reuse pointers

| What | Where |
|------|-------|
| `logCooking()` — extend here | `src/lib/db/recipes.ts` |
| `getProfile()` / `completeOnboarding()` upsert pattern | `src/lib/db/profile.ts` |
| `SkillProfile` type | `src/types/database.ts` (added in spec 03) |
| `Technique` type + `prerequisites` | `src/types/database.ts` (added in spec 03) |
| Existing recommend route to extend | `src/app/api/recipes/recommend/route.ts` |
| Shared Anthropic client + `HAIKU` / `SONNET` | `src/lib/anthropic.ts` |
| `profiles.skill_level` (for seeding) | `profiles` table, `profiles.skill_level` column |

---

## Open questions

- Should technique mastery be immediate on log (all techniques from a cooked recipe
  become mastered) or require cooking a recipe with that technique multiple times?
  Immediate is simpler and more rewarding; require-multiple-times is more rigorous.
  Recommend immediate for v1.
- Should `techniques_seen` be cleared periodically (e.g. reset if the user hasn't cooked
  for 30 days)? Not for v1.
- What happens if a recipe has no classified techniques? Skip the skill profile update
  silently.

---

## Acceptance criteria

- [ ] After the user logs their first cook with Chef AI, `skill_profile.techniques_mastered`
  is updated with the recipe's technique keys.
- [ ] On subsequent "what should I cook next?" queries, Chef AI targets a technique the
  user is ready for (prerequisites met) that they haven't yet mastered.
- [ ] The same technique is not re-introduced within the same session
  (`last_stretch_technique` is respected).
- [ ] `difficulty_ceiling` increases correctly as the user's cooking history grows.
- [ ] First-time users (empty `skill_profile`) get a sensible starting state seeded from
  `profiles.skill_level` and `cooking_log`.
- [ ] No regressions in `logCooking()` — existing cooked count and timestamp behaviour
  is unchanged.
