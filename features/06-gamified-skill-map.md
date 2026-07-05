# 06 — Gamified Technique Skill Map

**Depends on:**
- `03-technique-taxonomy.md` — technique catalogue with prerequisites (the tree edges).
- `05-skill-progression.md` — `profiles.skill_profile` with mastery state per user.

---

## Summary

A "My Skills" page that renders the technique catalogue as a visual skill tree. Each node
is a technique; edges are prerequisites. Node fill reflects the user's mastery state:
greyed (Locked), highlighted (Unlocked), filled (Mastered). Milestone badges reward
meaningful thresholds. A progress bar shows advancement toward the next milestone.

---

## User story

> As a cook working on improving my skills, I want to see a map of all the cooking
> techniques — which ones I've mastered, which are unlocked and ready to try, and which
> are still beyond my current level — so I can feel the progress I'm making and know
> exactly what to work toward next.

**Entry point:** "My Skills" tab in the bottom navigation (`bottom-nav.tsx`), plus a
link from technique badges on the recipe detail page (spec 04).

---

## Product considerations

- **The tree is the catalogue.** The `techniques` table provides all nodes and their
  `prerequisites[]` (edges). The skill map renders this structure; it does not define its
  own graph.
- **Mastery state from `skill_profile`:**
  - `Locked` — one or more prerequisites not yet in `techniques_mastered`.
  - `Unlocked` — all prerequisites in `techniques_mastered`, but technique itself is not
    yet mastered.
  - `Mastered` — key is in `techniques_mastered`.
- **Root nodes** (techniques with empty `prerequisites`) are always Unlocked (or Mastered).
- **Milestone badges:** Reward progress at specific thresholds. Starting set:
  - 🌱 "First Cook" — first technique mastered.
  - 🔥 "Getting Saucy" — mastered all Heat & Cooking Methods root techniques.
  - 🥩 "Knife Confident" — mastered all Knife Skills techniques.
  - 🏆 "10 Mastered" — 10 total techniques mastered.
  - ⭐ "Pro Kitchen" — all techniques mastered.
  Badges are computed client-side from `techniques_mastered` — no separate DB table needed
  for v1.
- **Progress bar:** Shows progress toward the next unearned badge.
- **Tap a node:** Shows a popover/bottom sheet with the technique name, description,
  example use, and a "Find recipes using this" shortcut that filters the library.
- **Graph library:** The app has no graph rendering dependency today. Add a lightweight
  one. Options:
  - `react-flow` (most feature-complete, ~50 KB gzipped) — recommended.
  - `d3-dag` (lower level, more control, smaller) — good if you want more custom layout.
  - Avoid heavy options like Cytoscape.js.
  Flag this as a new `npm` dependency that must be evaluated against modified-Next 16's
  bundling before committing.
- **Mobile-first layout:** The skill tree must be navigable on a 390px screen. Options:
  - Horizontally scrollable canvas (recommended for a tree layout).
  - Category-grouped accordion (simpler, no graph lib needed — consider this as a v1
    fallback if the graph lib proves problematic with modified-Next).
  - The category accordion is the safer v1 path; the visual skill tree is the aspirational
    v2.

---

## DB changes

None. Reads `techniques` (catalogue) and `profiles.skill_profile` (established in
spec 03 and written in spec 05).

---

## API / server work

### New `GET /api/profile/skills`

Returns the full catalogue + the user's mastery state in one response, shaped for the
client:

```ts
// Response shape:
{
  techniques: Technique[],       // full catalogue (all rows from techniques table)
  skillProfile: SkillProfile,    // user's mastered/seen/etc
  badges: string[],              // badge keys the user has earned (computed server-side)
}
```

Server logic:
1. Auth gate.
2. Parallel fetch: `supabase.from('techniques').select('*')` + `getProfile()`.
3. Compute earned badges from `skillProfile.techniques_mastered` + the catalogue.
4. Return combined response.

Computing badges server-side (once) avoids re-running the logic on every render and is
easier to extend.

---

## UI work

### New page: `src/app/skills/page.tsx` (server component)

Thin server component — calls `GET /api/profile/skills` (or calls the DB functions
directly), then renders `<SkillMap>`.

```ts
// src/app/skills/page.tsx
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/db/profile'
import SkillMap from '@/components/skill-map'

export default async function SkillsPage() {
  // fetch techniques + profile in parallel, pass to <SkillMap>
}
```

### New component: `src/components/skill-map.tsx` (`'use client'`)

**Option A — graph view (aspirational):**
Uses `react-flow` (or chosen library) to render techniques as nodes positioned by
category. Each node is styled by mastery state.

**Option B — category accordion (safer v1):**
Groups techniques by `category`. Each category is an expandable section. Within each
section, techniques are shown as cards with name, mastery state badge, description, and a
lock icon for locked ones. No graph dependency needed. Less visually striking but fully
functional and mobile-safe.

**Recommended approach:** Ship Option B first (accordion), add Option A (graph) as a
polish pass once the data flow is proven.

**Layout for Option B (accordion groups):**

```tsx
{CATEGORIES.map(cat => (
  <section key={cat}>
    <h2 className="font-heading font-bold text-lg mb-3">{cat}</h2>
    <div className="flex flex-col gap-2">
      {techniquesByCategory[cat].map(t => (
        <TechniqueCard key={t.key} technique={t} state={resolveState(t.key, t.prerequisites, mastered)} />
      ))}
    </div>
  </section>
))}
```

**`TechniqueCard` component:**
```tsx
function TechniqueCard({ technique, state }: { technique: Technique; state: TechniqueState }) {
  return (
    <div className={`rounded-2xl border p-4 ${state === 'locked' ? 'opacity-60' : ''}`}
         onClick={() => setSelectedTechnique(technique)}>
      <div className="flex items-center justify-between">
        <span className="font-heading font-semibold">{technique.label}</span>
        <StateBadge state={state} />
      </div>
      {state !== 'locked' && (
        <p className="text-sm text-muted-foreground mt-1">{technique.description}</p>
      )}
      {state === 'locked' && (
        <p className="text-xs text-muted-foreground mt-1">
          Learn first: {technique.prerequisites.join(', ')}
        </p>
      )}
    </div>
  )
}
```

**Milestone badges section:** Above the technique tree, a horizontal row of badge chips
(earned = filled with accent, unearned = muted outline). Tapping an earned badge shows
when it was earned (if tracked) or a celebratory message.

**Progress bar:** Below the badge row, a single `<div>` progress bar showing
`techniques_mastered.length / techniques.length` as a percentage, labelled
"X of Y techniques mastered."

### Add to bottom nav: `src/components/bottom-nav.tsx`

Add a new nav item for the skills page:
```ts
{ href: '/skills', icon: <TrophyIcon />, label: 'Skills' }
```
Use `lucide-react`'s `Trophy` or `Star` icon (both are available via lucide-react). Match
the existing nav item structure exactly.

### New accent token (optional)

If the skills page needs a distinct visual identity, add a `--achievement` semantic token
to `src/app/globals.css` (e.g. a gold/amber-gold OKLCH value). Use it for mastered
technique nodes, milestone badges, and the progress bar fill. If amber is close enough,
reuse the existing `--cooking` accent.

---

## Reuse pointers

| What | Where |
|------|-------|
| `getProfile()` | `src/lib/db/profile.ts` |
| `SkillProfile` / `Technique` types | `src/types/database.ts` (added in spec 03) |
| `resolveState()` utility | Define once, share between this component and `recipe-detail.tsx` (spec 04); consider extracting to `src/lib/skills.ts` |
| `BottomSheet` (for technique detail on tap) | `src/components/ui/bottom-sheet.tsx` |
| `Button` | `src/components/ui/button.tsx` |
| `EmptyState` + `Shimmer` | `src/components/ui/empty-state.tsx`, `shimmer.tsx` |
| Bottom nav (to extend) | `src/components/bottom-nav.tsx` |
| Sage / cooking accent tokens | `src/app/globals.css` |
| Category list | Derive from `techniques` table `category` column; the 5 categories are: Heat & Cooking Methods, Knife Skills, Baking & Pastry, Sauce & Emulsification, Preservation |
| `filterChipClass` pattern (active/inactive chips) | `src/components/recipe-library.tsx` ~line 195 |

---

## Open questions

- **Graph library:** Can `react-flow` be bundled cleanly with modified Next 16 + React 19?
  Test a minimal install before committing to the graph approach. If bundling is
  problematic, go with the accordion (Option B) and revisit in a future iteration.
- **Badge persistence:** For v1, badges are computed dynamically from `techniques_mastered`.
  If the user wants to see "when" they earned a badge, store timestamps. Defer to v2.
- **"Find recipes using this" shortcut:** Link to `/recipes?technique=[key]` — requires
  a technique filter in `recipe-library.tsx`. This is a small extension to the existing
  filter row. Can be deferred to a polish pass.

---

## Acceptance criteria

- [ ] `/skills` page is accessible via the bottom navigation.
- [ ] All catalogue techniques are shown, grouped by category.
- [ ] Each technique card correctly shows Mastered / Unlocked / Locked state based on
  the user's `skill_profile`.
- [ ] Root techniques (no prerequisites) are shown as Unlocked for new users with zero
  mastery.
- [ ] Earned milestone badges are displayed above the technique list.
- [ ] Progress bar shows correct percentage of techniques mastered.
- [ ] The page is navigable on a 390px-wide screen.
- [ ] Tapping a technique shows its description and prerequisite information.
