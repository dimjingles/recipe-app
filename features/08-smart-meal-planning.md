# 08 — Smart Meal Planning: AI-Powered, Preference-Aware Weekly Plans

**Priority: 1 — highest impact integration of existing user data (preferences, skills, cooking history) into the planner to differentiate from every other recipe app.**

**Depends on:** Existing `weekly_plans` / `weekly_plan_slots` tables, existing `profiles` (all onboarding fields), existing `cooking_log`, existing `recipes` (difficulty, cuisine, cook_time), existing `skill_profile` (techniques), existing `/api/recipes/recommend` route (reuse pattern).

---

## What it builds

The current planner (`/planner`) is a manual grid — tap a day, pick a recipe, slot it in. This feature makes the planner **smart** by using everything the app already knows about the user:

| What it uses | Where it lives |
|---|---|
| Cuisine preferences, diet, allergies | `profiles.favorite_cuisines`, `.diet`, `.allergies` |
| Cooking skill level | `profiles.skill_level` |
| Technique mastery (what they've proven they can do) | `profiles.skill_profile` → `techniques_mastered`, `difficulty_ceiling` |
| Cooking history & frequency patterns | `cooking_log` + `recipes.cooked_count`, `.last_cooked_at` |
| Recipe attributes (difficulty, cook time, cuisine, tags) | `recipes.difficulty`, `.cook_time_minutes`, `.cuisine`, `.tags` |
| Cooking frequency goal | `profiles.cook_frequency` (e.g. "3-5 times a week") |

---

## User story

> As a home cook, I want my meal plan to feel personal — not a blank grid every week. The app should know what I like to eat, how skilled I am, how much time I have on weekdays vs. weekends, and what I haven't cooked in a while. One tap should fill my empty week with a balanced, achievable plan. Another tap should swap any slot with a smarter alternative.

---

## Product considerations

- **Data-first, AI-enhanced.** Most of the smart behaviour should work *without* calling Claude — sorting, filtering, and surfacing favourites based on DB queries. The AI call is reserved for the "Auto-fill week" action and one-shot "Suggest swap" on a slot.
- **The AI call is optional.** Users who never tap "Auto-fill" still get a smarter manual experience via ranked suggestions.
- **Plan diversity matters.** An AI-generated plan of 7 Italian pasta dishes is a failure. The system must actively balance cuisines, cook times, and difficulty across the week.
- **Weekday vs. weekend awareness.** Weekdays (Mon–Thu) bias toward quick meals (< 30 min). Weekends (Fri–Sun) can have longer cook times and more involved techniques.
- **Skill-appropriate suggestions.** A beginner should never be suggested a recipe that requires techniques they haven't mastered. A pro shouldn't be fed "boil pasta" recipes unless they're a favourite.
- **Cooking frequency as a constraint.** If the user set `cook_frequency = "0-2"`, don't fill all 7 days. Suggest only the number of days that matches their stated goal, leaving the rest intentionally blank.
- **Cookbook awareness.** When a user has cookbooks (e.g. "Quick Weeknight Meals", "Weekend Projects"), the system can preferentially pull from relevant cookbooks for the right day type.
- **No new DB tables.** All data already exists. Only new API routes and client components. If a new table is needed for plan templates, that's feature 12 (Multi-Week Calendar + Templates), not this one.
- **Cost discipline.** The AI auto-fill route calls Claude Haiku (not Sonnet) — same model as `/api/recipes/recommend`. Each auto-fill = ~1 Haiku call per week. The "Suggest swap" action = ~1 Haiku call per swap. This is cheap.

---

## Build sequence — ship in 3 vertical slices

### Slice 1 — Smarter recipe picker (the manual experience upgrade)

No AI calls. Pure SQL + sorting logic.

**What changes:**

1. **Ranked recipe list in the picker sheet** — when a user taps an empty day slot, the bottom sheet shows recipes sorted by a relevance score, not alphabetically or by creation date. Score factors (all computed client-side from the plan context + profile data):

   - `+50` — recipe cuisine is in `favorite_cuisines`
   - `+30` — recipe has `difficulty <= skill_profile.difficulty_ceiling`
   - `+20` — recipe is tagged "Quick" and the selected day is Mon–Thu
   - `+10` — `cooked_count > 0` (they've tried it before)
   - `+5`  — recipe is in a cookbook matching the day type (e.g. "Quick Weeknight" → weekday)
   - `-20` — `last_cooked_at` is within the last 7 days (avoid repetition)
   - `-15` — recipe cuisine already appears 2+ times in the current week's plan (encourage diversity)
   - `-40` — recipe contains an ingredient or cuisine that conflicts with `allergies` or `diet`
   - `-10` — recipe difficulty exceeds `difficulty_ceiling`

2. **Search bar respects same scoring** — the existing text search still works, but results are reordered by the relevance score above so the most relevant match is always at the top.

3. **Diet/allergy safety filter** — recipes that conflict with the user's declared diet or allergies are visually de-emphasised (greyed out with a "Contains [allergen]" badge) rather than hidden. The user can still pick them — the app informs, not restricts. A one-time confirmation dialog fires on first attempt: "This recipe may contain [allergen]. Are you sure?"

4. **Empty day placeholder context** — each empty day slot shows a subtle contextual hint:
   - Weekdays: "Quick meal?"
   - Weekends: "Something special?"
   - If a recipe has `cooked_count > 0` and `last_cooked_at > 30 days ago`: "Haven't had [recipe name] in a while"
   - If the user has unscheduled recipes with high `cooked_count`: "You usually cook [recipe name] on [day of week]"

5. **Cooking history day-of-week patterns** — query `cooking_log` for day-of-week clusters. If the user has cooked Italian on 4 of the last 5 Sundays, show a small hint: "You often cook Italian on Sundays" on the Sunday slot. This uses a simple DB aggregation query (`extract(dow from cooked_at)` grouped by recipe cuisine), not ML.

**Files to create/modify:**

| File | Change |
|---|---|
| `src/lib/db/planner.ts` | Add `getRelevanceScore(recipe, profile, planContext)` — pure function, no DB call. Add `getCookingPatterns(userId)` — returns day-of-week cuisine clusters from `cooking_log`. |
| `src/components/planner-view.tsx` | Import and pass relevance data to the picker. Replace simple recipe list with scored + sorted list. Add contextual hints to empty slots. Add diet/allergy warnings. |
| `src/components/ui/bottom-sheet.tsx` or planner-view | Add scored results rendering with badge chips for "Quick", "Favourite cuisine", "Try again?" etc. |
| `src/lib/db/profile.ts` | Already has `getProfile()` and `updateSkillProfile()`. No changes needed — just ensure it's called in the planner page. |
| `src/app/planner/page.tsx` | Fetch profile + cooking patterns alongside plan data. Pass all context to `PlannerView`. |

**Acceptance:**
- Tap an empty day slot → bottom sheet opens with the most relevant recipes at the top
- A weekday slot shows a "Quick meal?" hint
- A weekend slot shows a "Something special?" hint
- A recipe from a non-favourite cuisine that was cooked yesterday appears below favourites
- A recipe with a conflicting allergen shows a greyed-out badge
- A Monday slot with no plan shows "You often cook Italian on Mondays" if the pattern exists

---

### Slice 2 — AI Auto-fill week

One new API route + one button + one confirmation flow.

**New API route: `POST /api/planner/auto-fill`**

Takes `{ week_start: string }`. Returns `{ slots: Array<{ day_of_week: 0-6, recipe_id: string }> }`.

Called with the same user context as the recommend route:

```ts
// Server-side (Haiku call)
const profile = await getProfile()
const recipes = await supabase.from('recipes')
  .select('id, name, cuisine, difficulty, cook_time_minutes, tags, cooked_count, last_cooked_at')
  .eq('user_id', user.id)

const cookingLog = await supabase.from('cooking_log')
  .select('recipe_id, cooked_at')
  .eq('user_id', user.id)
  .order('cooked_at', { ascending: false })
  .limit(200)

const skillProfile = profile?.skill_profile as SkillProfile | null
```

Prompt sends Claude:
- Full recipe list with (id, name, cuisine, difficulty, cook_time_minutes, tags, cooked_count)
- Cooking history summary (total entries, most-cooked cuisines, day-of-week patterns, recently cooked recipes)
- User preferences (diet, allergies, favorite_cuisines, skill_level, cook_frequency, household_size)
- Skill context (difficulty_ceiling, techniques_mastered)
- Current week's existing plan (so it can fill around already-planned days)
- Weekday/weekend constraint

Prompt instructs:
1. Only suggest recipes from the user's own library (no external recipe generation)
2. Fill exactly `N` days where `N` matches `cook_frequency` (default: 5 if unset)
3. Leave weekends free for "something special" unless user prefers them filled
4. No cuisine repeated more than 2× in the week
5. No recipe repeated in the same week
6. Weekday slots: prefer `difficulty <= 2` and `cook_time_minutes <= 30` where possible
7. Weekend slots: can include difficulty 3 or longer cook times
8. Respect diet/allergies strictly — never suggest a conflicting recipe
9. Favour recipes with `cooked_count > 0` (they've been vetted)
10. Avoid recipes cooked in the last 7 days
11. Occasionally surface a recipe with `cooked_count === 0` — but only if it matches skill level (a "rescue a saved recipe" nudge)
12. Return ONLY valid JSON: `{ "slots": [{ "day_of_week": 0, "recipe_id": "uuid" }, ...] }`

**Frontend — "Auto-fill week" button:**
- Location: Below the week navigation arrows, next to the week label.
- On click: show a confirmation action sheet ("Auto-fill this week based on your preferences and cooking history? Unplanned days will be filled.")
- On confirm: call `POST /api/planner/auto-fill`, show loading spinner on the button, render returned slots optimistically, show a toast on success/failure.
- If partial plan exists: the API fills only empty slots. The prompt receives the current plan so Claude doesn't duplicate.
- Undo: the button text changes to "Undo auto-fill" after a successful fill. Tapping it clears all slots that were added by the auto-fill (not manually-assigned slots). Store the pre-fill slot set in a ref before applying.

**Smart defaults integration with Slice 1:**
- After auto-fill, the recency/diversity scores in the picker adjust so the next manual interaction reflects the new plan.

**Files to create/modify:**

| File | Change |
|---|---|
| `src/app/api/planner/auto-fill/route.ts` | New POST route. Haiku call. Returns `{ slots }`. |
| `src/components/planner-view.tsx` | Add "Auto-fill week" button + confirmation sheet + undo logic. |
| `src/lib/anthropic.ts` | No changes — reuses `HAIKU` constant and `extractJsonObject` or inline regex. |
| `src/app/planner/page.tsx` | No changes (it already passes `initialPlan` and `recipes`). |

**Acceptance:**
- Tapping "Auto-fill week" with 0 planned slots fills 5 days (or `cook_frequency` days)
- Weekdays get quick, approachable recipes; weekends get longer/richer ones
- No cuisine appears more than 2×
- No recipe appears twice
- A slot with an existing manually-assigned recipe is preserved
- Tapping "Undo" restores the pre-fill state
- A user with `diet: 'vegan'` never gets a non-vegan recipe suggested
- A user with `skill_level: 'beginner'` never gets difficulty-3 recipes
- A user with `cook_frequency: '6+'` gets 6–7 days filled

---

### Slice 3 — Plan diversity dashboard & "Cook again" nudges

The finished planner shows more than just a grid — it gives the user at-a-glance awareness of their week and gentle nudges to rescue underused recipes.

**Week diversity bar** — a compact collapsible strip above the grid showing:
- Cuisine diversity: emoji chips showing which cuisines are represented. If 3+ days are the same cuisine, a subtle warning "Italian 3× this week — mix it up?"
- Difficulty distribution: 🔪🔪🔪 count. If all recipes are beginner-level and the user is "confident", show "Ready for something harder? Try [recipe name]."
- Cook time spread: "Avg cook time: 28 min" with a dot showing it's balanced.

**"Rescue a recipe" nudge** — below the grid, a compact card:
- Surfaces one recipe the user has saved but never cooked (`cooked_count === 0`)
- Shows the recipe name, cuisine, difficulty, and why they'd like it (matches a favourite cuisine, difficulty ≤ skill level)
- "Add to plan" button that opens the picker for the first empty day
- Dismissible (X to hide for this week)
- Rotates weekly — never shows the same "rescue" two weeks in a row (track `last_shown_rescue` in localStorage)

**"You cook this a lot" nudge** — below the rescue card:
- Shows the recipe with the highest `cooked_count` that hasn't been cooked in the last 14 days
- "Add back to this week" button
- Only shown if the user has at least 3 cooking log entries and the top recipe isn't already planned for this week

**Files to create/modify:**

| File | Change |
|---|---|
| `src/components/planner-view.tsx` | Add diversity bar component, rescue card, cook-again card sections. |
| `src/components/plan-diversity-bar.tsx` | New component — compact collapsible diversity strip. |
| `src/components/rescue-recipe-card.tsx` | New component — "rescue a saved recipe" nudge card. |
| `src/components/top-cooked-card.tsx` | New component — "you cook this a lot" nudge card. |

**Acceptance:**
- The diversity bar shows cuisine emoji chips for the current week's plan
- The rescue card shows a recipe with `cooked_count === 0` that matches user preferences
- The top-cooked card shows the most-cooked recipe not planned this week
- Both cards are dismissible
- Diversity warnings appear when 3+ days share the same cuisine

---

## Reuse pointers

| Pattern | Source file | How to reuse |
|---|---|---|
| User preference context building | `src/app/api/recipes/recommend/route.ts` (lines 14–49) | Extract into a shared helper `buildUserContext(userId)` in `src/lib/db/profile.ts`. Both `/api/recipes/recommend` and `/api/planner/auto-fill` call it. |
| Haiku JSON extraction | `src/app/api/recipes/recommend/route.ts` (lines 83–88) | Same regex/extract pattern for parsing auto-fill response. |
| Planner slot upsert | `src/lib/db/planner.ts` (lines 25–64) | Auto-fill route reuses `upsertSlot()` per day. |
| Profile fetch | `src/lib/db/profile.ts` | Already used in recommend route. Import in auto-fill route. |
| Skill profile normalization | `src/lib/skills.ts` (implied) | Used to resolve `difficulty_ceiling` for both auto-fill and picker scoring. |
| Cuisine emoji mapping | `src/lib/cuisine-emoji.ts` | Reuse in diversity bar chips. |
| Bottom sheet pattern | `src/components/ui/bottom-sheet.tsx` | Already used in planner-view for the recipe picker. Slice 1 upgrades the picker content, not the sheet itself. |

---

## Open questions

1. **Should the auto-fill ever suggest *new* recipes the user hasn't saved yet (external recipes)?** My recommendation: No, for v1. The user hasn't added them to their library. Auto-fill should only use what they own. External recommendations belong in the existing Chef AI recommend panel on the home page. If this goes well, a future "Auto-fill week with new ideas" mode could be added where Haiku also suggests unsaved recipes and auto-imports them.

2. **How aggressive should the diversity enforcement be?** If the user's favourite cuisine is Italian and 4 of 5 auto-filled days are Italian, is that a bug or a feature? My recommendation: enforce at most 2× per cuisine in auto-fill, but show a gentle "Mix it up?" callout on the manual plan if the user self-selects 4 Italian days. The app should inform, not override.

3. **What about meal types (breakfast, lunch, dinner)?** The current schema only stores `meal_type` but the planner only assigns dinner. For v1, auto-fill assigns dinner. A future slice could add breakfast/lunch slots. Open `meal_type` as a follow-up.

---

## Acceptance criteria (all slices)

1. User opens `/planner` → empty days show contextual hints based on day of week and cooking history.
2. Tapping an empty slot → bottom sheet ranks recipes by relevance (preferences, skill, history, diversity).
3. Diet/allergy-conflicting recipes are greyed out with a warning badge.
4. "Auto-fill week" button fills unplanned days with a balanced, skill-appropriate, preference-aligned plan using Claude Haiku.
5. Auto-fill respects `cook_frequency`, weekday/weekend split, and cuisine diversity.
6. Undo restores pre-fill slots.
7. Diversity bar shows cuisine distribution.
8. Rescue card surfaces an uncooked recipe.
9. Top-cooked card surfaces a favourite that's been neglected recently.
10. No recipes suggesting allergens or violating diet.
11. No new DB tables or columns added.
12. Total new code: ≤ 3 new API route files + ≤ 3 new components + modifications to existing `planner-view.tsx` + shared context helper.
