# 04 — Recipe Technique Breakdown

**Depends on:**
- `03-technique-taxonomy.md` — for `recipes.techniques[]` to be populated and the
  `techniques` catalogue table to exist.
- `05-skill-progression.md` — for `profiles.skill_profile` to exist so mastery state
  can be resolved per technique.

Build 03 and 05 first. This feature is then a thin UI layer with no new DB work.

---

## Summary

Each recipe detail page shows the cooking techniques the recipe requires, displayed as
badges with the user's mastery state colour-coded: **Mastered** (green), **Unlocked**
(yellow — ready to try), **Locked** (grey — prerequisites not yet met). Tapping a badge
links to that technique's node on the "My Skills" page.

---

## User story

> As a user viewing a recipe, I want to see at a glance which techniques it uses and
> whether I already know them — so I can gauge difficulty, spot what I'd be learning,
> and feel good about the skills I'm bringing to the dish.

**Entry point:** Technique badge row on the recipe detail page, below the title / alongside
the difficulty rating.

---

## Product considerations

- **Mastery state is resolved at render time** by crossing `recipe.techniques[]` against
  `user.skill_profile.techniques_mastered` and `techniques_seen`. No extra DB queries
  beyond what the detail page already loads.
- **Locked vs Unlocked:** A technique is Locked if any of its `prerequisites` keys are
  not yet in `techniques_mastered`. Unlocked = all prerequisites met but technique not yet
  mastered. This logic runs in the component, not the server.
- **No technique = no badge row.** If `recipe.techniques` is empty (not yet classified),
  omit the section silently rather than showing an empty row.
- **Tap → skill map.** Tapping a badge navigates to `/skills#[key]` (the gamified skill
  map from `06-gamified-skill-map.md`). Until that page exists, tapping can show a simple
  tooltip (native `title` attribute, consistent with how difficulty uses `title` today).
- **Keep the section light.** The recipe detail page is already information-dense. A
  horizontal scrollable row of chips is sufficient — no accordion, no modal.

---

## DB changes

None. This feature reads columns established in `03-technique-taxonomy.md`:
- `recipes.techniques text[]`
- `profiles.skill_profile jsonb` (via the detail page's server fetch)

The recipe detail page already calls `getRecipe(id)` (which returns `RecipeWithDetails`)
and the page's server component already has access to the user's profile data via
`getProfile()` — or the profile can be fetched once in the server component and passed
down as a prop.

---

## API / server work

No new routes. The only server-side addition:

**Update `src/app/recipes/[id]/page.tsx` (server component)** to also call `getProfile()`
and pass `profile.skill_profile` as a prop to `<RecipeDetail>`. Currently the page only
fetches the recipe and cookbooks. Add:

```ts
const [recipe, cookbooks, profile] = await Promise.all([
  getRecipe(id),
  getCookbooks(),
  getProfile(),
])
// Pass skillProfile={profile?.skill_profile ?? null} to <RecipeDetail>
```

---

## UI work

### Changes to `src/components/recipe-detail.tsx`

This is a large `'use client'` component (~725 lines). The technique section is additive —
no existing UI is removed.

**1. New prop:**
```ts
interface RecipeDetailProps {
  recipe: RecipeWithDetails
  initialCookbooks: CookbookWithCount[]
  skillProfile: SkillProfile | null   // add this
}
```

**2. New `TechniqueBadge` sub-component (inline or extracted):**

```tsx
type TechniqueState = 'mastered' | 'unlocked' | 'locked'

function TechniqueBadge({
  techniqueKey,
  label,
  state,
}: {
  techniqueKey: string
  label: string
  state: TechniqueState
}) {
  const styles: Record<TechniqueState, string> = {
    mastered: 'bg-sage-subtle text-sage border-sage/30',   // green — use sage accent
    unlocked: 'bg-amber-100 text-amber-700 border-amber-300',  // yellow
    locked:   'bg-muted text-muted-foreground border-border opacity-60',
  }
  const icons: Record<TechniqueState, string> = {
    mastered: '✓ ',
    unlocked: '○ ',
    locked:   '🔒 ',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${styles[state]}`}
      title={state === 'mastered' ? 'You know this' : state === 'unlocked' ? 'Ready to learn' : 'Locked — learn prerequisites first'}
    >
      {icons[state]}{label}
    </span>
  )
}
```

**3. State resolution logic (pure function, no network):**

```ts
function resolveState(
  key: string,
  prerequisites: string[],
  mastered: string[],
  seen: string[]
): TechniqueState {
  if (mastered.includes(key)) return 'mastered'
  if (prerequisites.every(p => mastered.includes(p))) return 'unlocked'
  return 'locked'
}
```

Note: you need the `prerequisites` for each technique key. Two options:
- **Option A (recommended):** Fetch the full `techniques` table once in the server
  component and pass it as a prop (a `Record<string, Technique>` lookup map). Cheapest
  and simplest.
- **Option B:** Fetch prerequisites lazily client-side. Unnecessary complexity.

**4. Render the section:**

Place after the difficulty row, before the tags section (or after — match visual flow):

```tsx
{recipe.techniques && recipe.techniques.length > 0 && (
  <div className="mb-4">
    <h3 className="font-heading text-sm font-semibold text-muted-foreground mb-2">
      Techniques
    </h3>
    <div className="flex flex-wrap gap-2 overflow-x-auto">
      {recipe.techniques.map(key => {
        const tech = techniquesMap[key]
        if (!tech) return null
        const state = resolveState(
          key,
          tech.prerequisites,
          skillProfile?.techniques_mastered ?? [],
          skillProfile?.techniques_seen ?? []
        )
        return (
          <TechniqueBadge key={key} techniqueKey={key} label={tech.label} state={state} />
        )
      })}
    </div>
  </div>
)}
```

### Styling notes

- **Mastered** → use the `sage` accent family (`bg-sage-subtle text-sage`) — already used
  for the Ingredients section, semantically appropriate for "things you know."
- **Unlocked** → amber (inline Tailwind values are fine here since there's no existing
  `unlocked` semantic token).
- **Locked** → `bg-muted text-muted-foreground` with reduced opacity.
- Do **not** use raw `orange-*` or `gray-*` — match the token system from
  `src/app/globals.css`.
- Badge border (`border` class + border colour) distinguishes the badge style from plain
  tag chips which have no border.

---

## Reuse pointers

| What | Where |
|------|-------|
| `getRecipe(id)` | `src/lib/db/recipes.ts` |
| `getProfile()` | `src/lib/db/profile.ts` |
| `SkillProfile` type | `src/types/database.ts` (added in spec 03) |
| `Technique` row type | `src/types/database.ts` (added in spec 03) |
| Tag-chip pattern (to mirror) | `src/components/recipe-detail.tsx` ~line 640 |
| Difficulty knife rendering (to mirror) | `src/components/recipe-detail.tsx` ~line 550 |
| Sage accent tokens | `src/app/globals.css` — `--sage` family |
| Recipe detail page (server component, to extend) | `src/app/recipes/[id]/page.tsx` |
| Recipe detail component (to extend) | `src/components/recipe-detail.tsx` |

---

## Open questions

- Should the badge tap navigate to `/skills#[key]` immediately, or fall back to `title`
  tooltip until spec 06 (gamified skill map) is built? Recommended: start with `title`
  and add the nav link in spec 06's pass.
- Where exactly in the visual layout should the technique row sit? After difficulty, before
  tags seems right — but confirm against the actual component layout during implementation.

---

## Acceptance criteria

- [ ] Technique badges appear on every recipe detail page that has `techniques[]`
  populated.
- [ ] Each badge is correctly colour-coded (Mastered / Unlocked / Locked) based on the
  user's `skill_profile`.
- [ ] A recipe with no techniques classified shows no technique section.
- [ ] The page layout is not broken on 390px-wide screens (badges wrap or scroll
  horizontally).
- [ ] Tapping a badge shows a descriptive tooltip (native `title` at minimum).
- [ ] No extra network requests beyond what the page already makes.
