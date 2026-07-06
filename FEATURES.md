# Mise en Place — Feature Backlog

Per-feature specs live in `features/`. Each spec file has a full product brief, DB
changes, API/server work, UI work, exact reuse pointers, and acceptance criteria. Read
a single spec file to build a single feature — all context is self-contained.

---

## Existing app

Mise en Place is a mobile-first PWA for personal recipe management and meal planning.
It feels native: installable on iOS and Android, supports the Android Web Share Target
(share any recipe URL from another app directly into Mise), and uses page transitions
and a persistent bottom-nav shell.

### Navigation

Fixed bottom nav with 5 tabs and a centre FAB:

| Tab | Route | Purpose |
|-----|-------|---------|
| Home | `/` | Dashboard |
| Recipes | `/recipes` | Recipe library |
| **+** (FAB) | `/recipes/new` | Add recipe |
| Skills | `/skills` | Technique skill map |
| Planner | `/planner` | Weekly meal plan |
| Grocery | `/planner/grocery` | Auto-generated grocery list |

Cookbooks are accessible from the Recipes library (filter + create inline).

### Pages

**Home** (`/`)
- Today's date header with sign-out and quick-add shortcuts
- Mini weekly plan — Mon–Sun grid showing assigned meals (cuisine emoji + name)
- "View grocery list" link appears when at least one day has a meal planned
- Recent recipes — 2-column card grid, up to 6, with image/emoji thumbnails
- Unauthenticated or un-onboarded users are redirected before seeing content

**Recipe Library** (`/recipes`)
- Scrollable grid of all user recipes with image thumbnails and cook-time badges
- Text search with debounced online recipe lookup (surfaces web results inline)
- Filter bar: cuisine dropdown, meal type (appetizer / main / dessert / drink), tag chips, cookbook filter
- AI Recipe Recommendations panel — Chef AI surfaces suggestions based on your library
- Inline cookbook creation from the filter bar

**Recipe Detail** (`/recipes/[id]`)
- Hero image (or cuisine emoji placeholder) + tap-to-expand image gallery
- Ingredients list grouped by category (produce, meat, seafood, dairy, bakery, pantry, spices, frozen)
- Step-by-step instructions
- Metadata strip: cook time, servings, difficulty (🔪 / 🔪🔪 / 🔪🔪🔪), tags, cuisine
- Technique mastery badges (requires skill system — see feature 04)
- Chef AI Chat — streaming cooking coach you can talk to while cooking
- "I cooked this" — log a cooking session with optional notes
- Head-to-head ranking — after the first cook log, new recipes are ranked against existing ones
- Add to / remove from cookbooks

**Recipe Editor** (`/recipes/new`, `/recipes/[id]/edit`)
- Fields: name, cuisine, cook time, servings, ingredients, instructions, difficulty, tags
- AI name-lookup — typing a dish name auto-fills cuisine, cook time, and description
- AI instruction generation — Claude Haiku writes step-by-step instructions and infers difficulty
- Image picker: direct upload, camera capture, or online image search (3-tab sheet)
- Difficulty picker — 3-button toggle (1–3 knives); AI sets the default, user can override
- Tag chips — predefined set (Vegan, Gluten-Free, Quick, Meal Prep, etc.) plus free-form custom tags

**Import** (`/import`)
- Paste any URL — recipe sites, YouTube videos, Instagram/TikTok posts
- AI extracts: name, cuisine, ingredients, instructions, cook time, servings, image
- Text fallback — when the page can't be scraped, user pastes caption/recipe text instead
- Android Web Share Target — URLs shared from other apps open directly here with auto-import

**Cookbooks** (`/cookbooks`, `/cookbooks/[id]`)
- Create named collections with an emoji
- Add / remove recipes from any cookbook
- Cookbook detail view with its recipe grid

**Skills** (`/skills`)
- Curated technique catalogue with categories (e.g. knife skills, braising, emulsification)
- Gamified skill map showing mastery state per technique
- Techniques have prerequisites — the tree visualises progression paths
- Mastery state is persisted in the user's profile

**Weekly Planner** (`/planner`)
- Mon–Sun grid for the current week
- Tap any day to assign a saved recipe; tap again to clear
- Plan persists week-over-week

**Grocery List** (`/planner/grocery`)
- Auto-generated from the current week's planned recipes
- Ingredients aggregated and combined across all recipes, grouped by category (with emoji headers)
- Per-item check-off with localStorage persistence; progress bar shows checked/total
- Share button exports the full list as text via the Web Share API (clipboard fallback)

**Onboarding** (`/onboarding`)
- Multi-step wizard shown to new users on first login
- Collects: cooking skill level, cuisine preferences

**Auth** (`/login`)
- Google OAuth via Supabase — no email/password option
- Every page except `/login` redirects unauthenticated users

### Core data model

| Table | Key columns |
|-------|-------------|
| `recipes` | `name`, `cuisine`, `cook_time_minutes`, `servings`, `difficulty` (1–3), `tags text[]`, `image_url`, `gallery_images`, `techniques text[]`, `instructions` |
| `ingredients` | `recipe_id`, `name`, `quantity`, `unit`, `category` |
| `cooking_log` | `recipe_id`, `user_id`, `cooked_at`, `notes` |
| `weekly_plans` | `user_id`, `week_start` |
| `weekly_plan_slots` | `plan_id`, `day_of_week` (0–6), `recipe_id` |
| `cookbooks` | `user_id`, `name`, `emoji` |
| `cookbook_recipes` | `cookbook_id`, `recipe_id` |
| `techniques` | `label`, `category`, `description`, `prerequisites text[]` |
| `profiles` | `user_id`, `skill_level`, `onboarding_completed`, `skill_profile jsonb` |

### AI features (all shipped)

| Feature | Model | Entry point |
|---------|-------|-------------|
| Recipe import extraction from URL | Claude Haiku | `/api/recipes/import` |
| Recipe import extraction from pasted text | Claude Haiku | `/api/recipes/import` |
| AI instruction generation | Claude Haiku | `/api/recipes/generate-instructions` |
| Recipe name lookup / autofill | Claude Haiku | `/api/recipes/lookup` |
| Chef AI cooking coach (streaming chat) | Claude Sonnet | `/api/recipes/[id]/chat` |
| Recipe recommendations | Claude Sonnet | `/api/recipes/recommend` |
| Skill-stretch behaviour in Chef AI | Claude Sonnet | Chef AI chat system prompt |

### PWA

- Installable manifest (`/public/manifest.json`)
- Service worker with offline caching
- Apple Web App capable (home-screen icon, default status bar)
- Android Web Share Target (receives shared URLs via `?url=` / `?text=` params)

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

## Implemented feature batch

| # | Spec file | What it builds | Depends on | Status |
|---|-----------|---------------|------------|--------|
| 00 | [features/00-shared-ai-infra.md](features/00-shared-ai-infra.md) | Streaming foundations + SONNET model constant | — | Built |
| 07 | [features/07-image-search.md](features/07-image-search.md) | "Search online" third tab in the image picker | — | Built |
| 01 | [features/01-chef-ai-chat.md](features/01-chef-ai-chat.md) | Streaming step-by-step cooking coach chat | 00 | Built |
| 02 | [features/02-chef-ai-recommend.md](features/02-chef-ai-recommend.md) | Surface existing recommendation route in Chef AI | 00 | Built |
| 03 | [features/03-technique-taxonomy.md](features/03-technique-taxonomy.md) | Curated technique catalogue + recipe classification | — | Built |
| 04 | [features/04-recipe-technique-breakdown.md](features/04-recipe-technique-breakdown.md) | Technique mastery badges on the recipe detail page | 03, 05 | Built |
| 05 | [features/05-skill-progression.md](features/05-skill-progression.md) | Chef AI stretches user toward harder techniques | 00, 03 | Built |
| 06 | [features/06-gamified-skill-map.md](features/06-gamified-skill-map.md) | "My Skills" gamified skill tree page | 03, 05 | Built |
| 09 | [features/09-social-friends.md](features/09-social-friends.md) | Friends, shared collections & activity feed | — | Pending |

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

---

## Roadmap

Ideas ranked by impact-per-dev-hour. These are the features that would differentiate
Mise from the market leader (ReciMe, 800K users) whose users are actively complaining
about pricing hikes and broken core workflows. Write a spec in `features/` before
building any of these.

### The pitch against ReciMe

> ReciMe saves your recipes. Mise en Place helps you actually cook them — with your
> partner, on budget, adapted to your diet.

ReciMe's core weaknesses (from their user reviews and Reddit threads):
- Grocery list doesn't auto-sync with the meal plan; no dedup; can't customise categories
- Meal plan is single-week only — no saved templates, no multi-week view
- Recipes are static — no adaptation for diet, pantry, or portion size
- No household sharing at all
- No guided cook mode — just static text
- Free tier limited to 5 recipes; $9.99/mo pricing backlash driving users to look elsewhere

---

### 09 — AI Recipe Adaptation

**Priority: 1 — highest impact, no competitor does it well**

Let any saved recipe be transformed in one tap via Claude. Proposed entry points:
- **Dietary swap** — make it vegan / vegetarian / GF / dairy-free. Claude rewrites
  ingredients and instructions, flags substitutions, warns where the result materially
  changes (e.g. texture loss from removing eggs).
- **Portion scaling** — not just multiply quantities; also adjusts cook times, pan sizes,
  and temperatures where relevant.
- **Pantry substitution** — user says "I don't have X" or marks pantry gaps; Claude
  suggests what to swap and how that changes the recipe.
- **Dietary-aware meal planning** — when suggesting meals for the week, filter and
  adapt to household constraints automatically.

Why 10x: ReciMe recipes are static. Ours are alive. Users with dietary restrictions
currently have to mentally translate every recipe they find. We'd be first to solve that.

**Depends on:** 00-shared-ai-infra, existing `ingredients` table, existing Chef AI chat.
**New data:** Adapted recipe stored as a variant linked to the original, not overwriting it.

---

### 10 — Grocery Pipeline 2.0

**Priority: 1 — fixes the #1 complaint against every recipe app**

The current grocery list aggregates ingredients from the week's plan. What it lacks:

- **Real-time sync** — change a recipe, swap a planned day, change servings → the list
  updates immediately without a manual refresh.
- **Smart dedup** — "1 onion" in Monday's recipe + "2 onions" in Wednesday's = "3 onions",
  one line item. Unit normalization (tbsp ↔ tsp ↔ cup) is partially done; extend it.
- **Customisable categories and aisle order** — user can rename categories, reorder them,
  and reassign items to different aisles to match their store's layout.
- **Pantry deductions** — user marks what they already have; those items are struck
  through or hidden from the shopping list automatically.
- **Cost estimates** — per-recipe and per-week estimates so the user knows the grocery
  bill before walking into the store.

**Depends on:** existing grocery list, planner, ingredients table.
**New data:** `pantry_items` table (ingredient name + have_it boolean); optional price
data source (manual entry or supermarket API where available).

---

### 09 — Social: Friends, Shared Collections & Activity Feed

**Priority: 1 (specced and ready) — see [`features/09-social-friends.md`](features/09-social-friends.md) for the full spec**

- **Mutual friends** — request/accept graph with pending/accepted/blocked state machine.
- **Browse collections** — friends can see each other's cookbooks and recipes by default;
  per-item private toggle to hide anything.
- **Activity feed** — home screen feed showing what friends are cooking and creating.
- **Discovery** — username search, invite link/QR, email lookup.

Built in four vertical slices: Identity → Graph → Visibility + Browse → Feed.

**Depends on:** nothing in the existing feature chain. Lays groundwork for feature 11.
**New data:** `friendships`, `activity`, `visibility` columns, `public_profiles` view,
`are_friends()` / mutation RPCs, identity columns on `profiles`.

---

### 11 — Household / Partner Sharing

**Priority: 2 — huge segment (couples cooking together) completely unserved by competitors**
**Note:** builds on the social identity + friendship infrastructure from feature 09.

- **Invite partner** — user sends an invite link; partner joins the same household.
- **Shared meal plan** — both users see and edit the same weekly plan in real time.
- **Shared grocery list** — both can check off items while shopping; changes sync live
  (walking through the store, one person adds milk, the other sees it immediately).
- **Shared recipe library** — optional per-cookbook permission: keep personal collections
  private but share a "Family Favourites" cookbook.
- **Shared cooking history** — "we made this on our Japan trip" — log entries visible to
  both members.
- **Split responsibility** — one plans, one shops; each has their own view but the same
  underlying data.

**Depends on:** Supabase RLS policy changes; real-time subscriptions (Supabase Realtime).
**New data:** `households` table linking multiple `profiles`; shared RLS policies on
`weekly_plans`, `weekly_plan_slots`, `cooking_log`, and whitelisted `cookbooks`.

---

### 12 — Multi-Week Calendar and Saved Plans

**Priority: 2 — serious meal planners think in weeks ahead; ReciMe shows one week only**

- **Calendar view** — toggle between single-week (current), two-week, and month view.
- **Save plan as template** — name and save any week's meal plan ("Busy Week", "Summer
  BBQ", "Meal Prep Sunday").
- **Apply template to next week** — one-tap autofill with optional slot-by-slot confirmation.
- **Drag recipes across weeks** — move planned meals between days and weeks.
- **Repeat schedule** — mark a plan as "repeat every N weeks" for households with fixed
  rotation menus.

**Depends on:** existing `weekly_plans` / `weekly_plan_slots` tables.
**New data:** `plan_templates` table storing a named snapshot of slots.

---

### 13 — Guided Cook Mode

**Priority: 3 — turns Mise from a recipe storage app into a cooking companion**

- **Full-screen step mode** — tap "Start Cooking" from the recipe detail; each step fills
  the screen, large readable text, screen stays awake.
- **Built-in timers** — steps that mention time ("simmer for 10 minutes") get an
  auto-detected timer button. User can add manual timers per step.
- **Voice control** — "Hey Mise, next step" / "repeat that" / "set a 5-minute timer"
  using the Web Speech API.
- **Log from cook mode** — "Mark as cooked" lives at the end of the guide so the habit
  loop closes without leaving the mode.
- **Ingredient check-off** — side panel lets user tick off ingredients as they prep.

**Depends on:** existing recipe detail, cooking log, Chef AI chat (can optionally surface
tips per step if the user opens it).

---

### 14 — Video Recipe Import (TikTok / Instagram / YouTube)

**Priority: 3 — this is ReciMe's flagship feature and why 800K users chose them**

ReciMe's main draw is one-tap video import. Match and exceed it:
- **Transcript extraction** — pull closed captions/transcript from YouTube via the Data
  API; for TikTok and IG, use the video description + caption text (already works via
  the existing text-paste fallback).
- **Vision model extraction** — for videos without transcripts, pass keyframes to Claude's
  vision to read on-screen ingredient lists and steps.
- **Structured output** — same `ExtractedRecipe` shape as URL import; feeds into the
  existing preview → edit → save flow.
- **Timestamp sync (stretch goal)** — if we store the source video URL, link each step
  to its timestamp in the video so guided cook mode can play the relevant clip.

**Depends on:** 00-shared-ai-infra, existing import flow (`/api/recipes/import`).
**Why build:** This is the feature that gets ReciMe users to even consider switching.

---

### 15 — Habit Feedback Loop

**Priority: 4 — makes the app sticky; most recipe apps are graveyards**

Most users save 100 recipes and cook 5. Fix the loop:
- **Cooking streaks** — Duolingo-style. "You've cooked 4 nights in a row 🔥"
- **Weekly cook rate** — "You cooked 4 of 5 planned meals this week" on the home
  dashboard. Gentle accountability without shame.
- **AI preference learning** — Claude analyses cooking history (what was actually cooked
  vs. saved, ratings, cuisine patterns) and improves recommendations over time. "Based
  on what you liked last week, try this."
- **"Rescue a saved recipe"** — surface one recipe the user saved but never cooked,
  with a prompt to plan it this week.
- **Push notifications (opt-in)** — "Your chicken needs to defrost tonight for tomorrow's
  plan" style contextual nudges.

**Depends on:** existing cooking log, recommendations route, onboarding notification
permission request (already wired).

---

### Priority summary

| # | Feature | Effort | Impact | Differentiator vs. ReciMe |
|---|---------|--------|--------|---------------------------|
| 09 | AI Recipe Adaptation | Medium | Very High | No competitor does it |
| 10 | Grocery Pipeline 2.0 | Medium | High | Fixes ReciMe's #1 complaint |
| 11 | Household Sharing | Medium | High | ReciMe has nothing |
| 12 | Multi-Week Calendar + Templates | Medium | High | ReciMe: single week only |
| 13 | Guided Cook Mode | Medium | Medium-High | ReciMe: static text |
| 14 | Video Import (TikTok/IG/YT) | Medium-High | Very High | ReciMe's flagship, done better |
| 15 | Habit Feedback Loop | Low-Medium | Medium | Makes the app sticky |
