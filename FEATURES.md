# PrepTable — Feature Backlog

Per-feature specs live in `features/`. Each spec file has a full product brief, DB
changes, API/server work, UI work, exact reuse pointers, and acceptance criteria. Read
a single spec file to build a single feature — all context is self-contained.

---

## Existing app

PrepTable is a mobile-first PWA for personal recipe management and meal planning.
It feels native: installable on iOS and Android, supports the Android Web Share Target
(share any recipe URL from another app directly into PrepTable), and uses page transitions
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
- Household-aware rankings - shared household recipes can have different ranks per member
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
- Video/social URLs get a dedicated pipeline: YouTube title + description + spoken
  transcript (captions via watch page, InnerTube fallback), TikTok caption (oEmbed),
  Instagram caption (OpenGraph) — extracted by Claude Haiku into the same preview
- AI extracts: name, cuisine, ingredients, instructions, cook time, servings, image
- Text fallback — when the page/post can't be read, user pastes caption/recipe text
  instead; the original link is kept as the recipe source either way
- `?mode=text` opens the paste view directly (used by the Add-a-recipe sheet)
- Android Web Share Target — URLs shared from other apps open directly here with auto-import

**Add-a-recipe sheet** (from the library "Add Recipe" pill and Home "+" button)
- Import from social media → platform picker (YouTube / TikTok / Instagram) →
  per-platform share instructions with paste-link field and "Open app" shortcut
- Import from web / Import from text / Write from scratch tiles

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
| Video recipe import (YouTube transcript / TikTok / Instagram captions) | Claude Haiku | `/api/recipes/import` |
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
```plaintext
08-smart-meal-planning is fully independent — no new infra needed; all data exists.
17-grocery-savings-engine is fully independent — reuses 08's auto-fill pattern but needs no feature dependency.
18-recipe-library-sort-preferences is fully independent - uses existing recipe ranking/cooking history fields plus one profile preference column.
```

**Recommended sequence:** `00 → 07 → 08 → 18 → 17 → 01 → 02 → 03 → 04 → 05 → 06`

Feature 17 (Grocery Savings Engine) slots in early because it's high-impact and independent after 08. If done before 09-16, the savings data model is stable and all subsequent features (grocery list 2.0, habit loop) can layer on top of it.

Start with `00` to lay the streaming/model foundations, then `07` as an early independent
win, then `08` as the highest-impact integration of existing user data, then the Chef AI
and technique tracks in dependency order.

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
| 13 | (see "13 — Guided Cook Mode" below) | Full-screen guided cook mode: step-by-step view, wake lock, auto/manual timers, opt-in voice control, ingredient check-off, mark-as-cooked | recipe detail, cooking log | Built |
| 08 | [features/08-smart-meal-planning.md](features/08-smart-meal-planning.md) | Preference-aware AI auto-fill, smart recipe picker, plan diversity tools | — | Pending |
| 09 | [features/09-social-friends.md](features/09-social-friends.md) | Friends, households, shared recipe libraries & activity feed | — | Pending |
| 17 | [features/17-grocery-savings-engine.md](features/17-grocery-savings-engine.md) | Sale-matched recipe badges, cost estimation, budget-aware planning, flyer import | — | Pending |
| 18 | [features/18-recipe-library-sort-preferences.md](features/18-recipe-library-sort-preferences.md) | Recipe library sort control with account-level saved default preference | — | Pending |

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

> ReciMe saves your recipes. PrepTable helps you actually cook them — with your
> partner, on budget, adapted to your diet.

ReciMe's core weaknesses (from their user reviews and Reddit threads):
- Grocery list doesn't auto-sync with the meal plan; no dedup; can't customise categories
- Meal plan is single-week only — no saved templates, no multi-week view
- Recipes are static — no adaptation for diet, pantry, or portion size
- No household sharing at all
- No guided cook mode — just static text
- Free tier limited to 5 recipes; $9.99/mo pricing backlash driving users to look elsewhere

---

### 08 — Smart Meal Planning (specced and ready)

**Priority: 1 — see [`features/08-smart-meal-planning.md`](features/08-smart-meal-planning.md) for the full spec**

The current planner is a blank grid — useful but dumb. This feature makes it personal:
- **Smarter recipe picker** — when you tap an empty day, recipes are scored and sorted by relevance using your cuisine preferences, skill level, cooking history, diet/allergies, and plan diversity (no 3× Italian in one week).
- **AI Auto-fill week** — one tap fills unplanned days with a balanced, skill-appropriate week using Claude Haiku. Weekday quick meals, weekend projects. Respects `cook_frequency` so it doesn't overfill.
- **Plan diversity dashboard** — at-a-glance cuisine mix, difficulty spread, and gentle nudges ("You haven't cooked [recipe] in a while").
- **Rescue a saved recipe** — surfaces an uncooked recipe from your library that you'd probably enjoy.

Why 10x: ReciMe's planner is a blank grid. Ours knows who you are, what you can cook, and what you like.

**Depends on:** nothing new — all data exists in `profiles`, `cooking_log`, `recipes`, `skill_profile`, `weekly_plans`, `weekly_plan_slots`.
**New data:** No new tables or columns.

---

### 09 — AI Recipe Adaptation ✅ IMPLEMENTED (v1)

**Priority: 1 — highest impact, no competitor does it well**

**Status:** shipped. Full spec: [`features/09-ai-recipe-adaptation.md`](features/09-ai-recipe-adaptation.md).

Any saved recipe can be transformed into a **new variant** via Claude (`POST
/api/recipes/[id]/adapt` → preview → save through `POST /api/recipes`). The original is
never overwritten. Entry points, all live via the **Adapt recipe** button on recipe detail:
- **Dietary swap** ✅ — make it vegan / vegetarian / GF / dairy-free. Claude rewrites
  ingredients and instructions, updates tags, flags substitutions, and warns where the
  result materially changes (e.g. texture loss from removing eggs).
- **Portion scaling** ✅ — not just multiply quantities; also adjusts cook times, pan sizes,
  and temperatures where relevant.
- **Pantry substitution** ✅ — user says "I don't have X"; Claude suggests what to swap and
  how that changes the recipe.
- **Freeform** ✅ — any plain-language request ("make it spicier", "lower-carb").
- **Dietary-aware meal planning** ⏳ — filter/adapt weekly suggestions to household
  constraints automatically. Deferred; ties into 08-smart-meal-planning.

Why 10x: ReciMe recipes are static. Ours are alive. Users with dietary restrictions
currently have to mentally translate every recipe they find. We're first to solve that.

**Depends on:** 00-shared-ai-infra, existing `ingredients` table, existing recipe save flow.
**New data:** `recipes.original_recipe_id` (FK) + `recipes.adaptation_metadata` (jsonb) —
variant linked to the original, not overwriting it. Migration:
`supabase/migrations/add_recipe_adaptations.sql`.

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

- **Mutual friends** - request/accept graph with pending/accepted/blocked state machine.
- **Households** - partner/couple accounts can join one household, share the same recipe
  library and cookbooks, and keep separate per-person recipe rankings.
- **Browse collections** - friends can see each other's cookbooks and recipes by default;
  per-item private toggle to hide anything.
- **Activity feed** - home screen feed showing what friends and household members are cooking
  and creating.
- **Discovery** - username search, invite link/QR, email lookup, household invite link/QR.

Built in five vertical slices: Identity → Graph → Household Library → Visibility + Browse → Feed.

**Depends on:** nothing in the existing feature chain. Partially absorbs feature 11's shared
recipe-library use case while leaving shared planner/grocery sync for feature 11.
**New data:** `friendships`, `households`, `household_members`, `recipe_rankings`, `activity`,
`visibility`/`owner_scope` columns, `public_profiles` view, `are_friends()` / `same_household()`
/ mutation RPCs, identity columns on `profiles`.

---

### 11 — Household / Partner Sharing

**Priority: 2 - huge segment (couples cooking together) completely unserved by competitors**
**Note:** builds on the social identity + friendship infrastructure from feature 09.

- **Invite partner** — user sends an invite link; partner joins the same household.
- **Shared meal plan** — both users see and edit the same weekly plan in real time.
- **Shared grocery list** — both can check off items while shopping; changes sync live
  (walking through the store, one person adds milk, the other sees it immediately).
- **Shared recipe library** - handled in feature 09. Household members can share the same
  recipes and cookbooks while each person keeps their own ranking for every recipe.
- **Shared cooking history** — "we made this on our Japan trip" — log entries visible to
  both members.
- **Split responsibility** — one plans, one shops; each has their own view but the same
  underlying data.

**Depends on:** feature 09 household membership and shared library; Supabase RLS policy
changes; real-time subscriptions (Supabase Realtime).
**New data:** shared RLS policies on `weekly_plans`, `weekly_plan_slots`, and `cooking_log`;
reuse `households`, `household_members`, and `recipe_rankings` from feature 09.

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

### 13 — Guided Cook Mode ✅ Built

**Priority: 3 — turns Mise from a recipe storage app into a cooking companion**

> **Shipped.** Full-screen route `/recipes/[id]/cook` (`src/components/cook/cook-mode.tsx`),
> launched by a "Start Cooking" CTA on the recipe detail page. One step per screen with a
> progress bar and large text; Screen Wake Lock keeps the display on where supported
> (`src/lib/cook/use-wake-lock.ts`). Timers are auto-detected from time phrases in each step
> (`src/lib/cook/durations.ts`) plus a manual timer sheet, and keep running across steps with
> a wall-clock tick + beep/vibrate alarm (`src/lib/cook/use-cook-timers.ts`). Opt-in voice
> control ("next" / "back" / "repeat" / "start timer") via the Web Speech API degrades
> gracefully where unsupported (`src/lib/cook/use-voice-control.ts`). Ingredient check-off
> lives in a bottom sheet (local state). The final screen offers "Mark as Cooked" with an
> optional notes field, posting through the existing `/api/recipes/[id]/log` path. Static
> reading mode on the recipe detail page is unchanged.

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

### 14 — Video Recipe Import (TikTok / Instagram / YouTube) — ✅ Built

**This was ReciMe's flagship feature and why 800K users chose them.**

- **Implementation:** `src/lib/import/video.ts` classifies URLs (YouTube incl. Shorts /
  youtu.be / m., TikTok incl. vm. short links, Instagram p/reel/tv) and gathers context
  per platform with no scraping dependencies:
  - **YouTube** — watch-page `ytInitialPlayerResponse` for title/description/thumbnail +
    caption tracks; caption URLs that come back empty (proof-of-origin gating) retry
    through the InnerTube ANDROID client. Transcript parsed from json3/srv XML. Recipes
    spoken in the video but absent from the description import via the transcript.
  - **TikTok** — documented public oEmbed endpoint (caption/author/thumbnail), page
    OpenGraph fallback.
  - **Instagram** — OpenGraph tags on the post page (no login-required scraping); when
    blocked, users are guided to the paste-caption fallback, which stays first-class.
  - Claude Haiku extracts the same `ExtractedRecipe` shape (video-specific prompt turns
    spoken transcripts into written steps), feeding the existing preview → edit → save
    flow. Thumbnail becomes the cover image; `source_url` is preserved — including
    through the paste-text fallback, which now sends the originally-attempted URL.
  - **UI:** ReciMe-style Add-a-recipe bottom sheet (`add-recipe-sheet.tsx`) from the
    library pill and Home "+": social platform picker → per-platform share instructions
    (share-sheet steps, paste-link field, "Open app" shortcut).
  - Manual pipeline test: `node --env-file=.env.local scripts/test-video-import.mts <url>`.
- **Not built (stretch):** keyframe vision extraction, per-step timestamp sync.

---

### 15 — Habit Feedback Loop

**Priority: 4 — makes the app sticky; most recipe apps are graveyards**

Most users save 100 recipes and cook 5. Fix the loop:
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

### 16 — Cooking Streak

**Priority: 4 — habit-forming mechanic; flexible cadence sets it apart from Duolingo clones**

Most streak systems demand daily check-ins and punish a missed day harshly — wrong fit
for cooking. Mise's streak adapts to how the user actually cooks:

- **User-configured cadence** — during onboarding (or in settings) the user picks their
  target: "daily", "a few times a week" (default: 3×), or "at least once a week". The
  streak counts consecutive *cadence windows* met, not raw calendar days.
- **Streak card on Home** — compact card showing current streak (🔥 N weeks / days),
  cadence goal, and sessions logged this window. Disappears if the user hasn't cooked
  yet and the window hasn't started; appears once the first cook of a window is logged.
- **Streak freeze** — one grace period per month (e.g. travel, illness) that preserves
  the streak without a cook log. User taps "Freeze this week" before the window closes.
- **Milestones** — quiet celebrations at 4, 8, 13, 26, 52 weeks (or daily equivalents):
  a confetti moment and a badge stored on the profile. No push spam.
- **Streak broken state** — if the window closes without a log, show "Streak ended at
  N — start a new one" rather than resetting to zero silently. Softer than Duolingo.
- **Social hook** — when feature 09 (social) ships, streaks are visible on public
  profiles and the activity feed ("Emily is on a 6-week streak 🔥").

**Depends on:** `cooking_log` table (already exists); feature 09 (social) for the
social hook only — the core streak works standalone.

**New data:** `streak_settings` column on `profiles` (`{ cadence: "daily" | "weekly" |
"custom", target_per_week: number }`); `streak_freezes` table (`user_id`, `window_start`,
`used_at`); milestone badges stored in existing `skill_profile jsonb` or a new `badges`
column.

---

### 17 — Grocery Savings Engine: Sale-Matched Meal Planning & Budget Tracking

**Priority: 1 — see [`features/17-grocery-savings-engine.md`](features/17-grocery-savings-engine.md) for the full spec**

Skrimp.ai proved the market wants their meal plan driven by what's cheap this week, not what they feel like cooking. Mise matches Skrimp's flyer data with a weekly automated scraping pipeline and goes further:

- **Automated flyer scraping** — a Hermes cron crawls 15+ Canadian grocery flyers every Wednesday, runs Claude Sonnet vision to extract deals, and upserts them into a shared sale-items database. No manual entry needed.
- **Cost estimation on every recipe** — each recipe card shows an estimated total cost. Per-ingredient breakdown on the detail page. Claude Haiku estimates baseline prices; flyer data provides real prices.
- **Weekly budget tracking** — set a weekly grocery budget. The planner shows cost total vs. budget in real time. Auto-fill respects the budget constraint.
- **Sale-matched badges** — recipes whose key ingredients match active sale items get "On Sale", "🔥 Sale match", or "This week's steal" badges. "On Sale First" sort in the library.
- **"Cook what's on sale" auto-fill** — an alternative auto-fill mode that prioritises sale-matched recipes. At least 70% of the week from what's cheap.
- **Grocery list cost breakdown** — per-ingredient costs, store subtotals, sale savings callout. Shows strikethrough regular price + sale price on matched items.

Why 10x: Skrimp has flyers and 300 curated recipes — no cooking history, no personalization, no budget tracking. Mise has flyers **plus** your own recipe library, full cooking history, skill tracking, dietary adaptation, Chef AI coaching, and budget management. No competitor combines sale awareness + personalization + budget tracking in one app.

**Depends on:** None in the feature chain. Reuses feature 08's auto-fill route pattern (`/api/planner/auto-fill`) and ingredient data model.
**New data:** `ingredient_prices`, `user_ingredient_prices`, `sale_items` tables; `weekly_budget`, `savings_mode`, `preferred_stores`, `currency` columns on `profiles`. Cron job for weekly flyer scraping. System user for shared flyer data.

---

### 18 - Recipe Library Sort Preferences

**Priority: 3 - see [`features/18-recipe-library-sort-preferences.md`](features/18-recipe-library-sort-preferences.md) for the full spec**

The recipe library gets a sort control that lets users choose how their recipes are ordered:
- **Ranking** - default option, best ranked recipes first.
- **Most recently cooked** - recipes with the newest `last_cooked_at` first.
- **Most cooked** - recipes with the highest `cooked_count` first.

Changing the sort option also changes the user's saved default. The next time they log in or return to `/recipes`, PrepTable opens with that saved sort selected.

Why useful: this is a small control that makes the library feel personal. Users who treat PrepTable as a favourites list want Ranking; users cooking on habit want recency or frequency.

**Depends on:** Existing `/recipes` library, `recipes.rank`, `recipes.last_cooked_at`, `recipes.cooked_count`, and `profiles`.
**New data:** `recipe_sort_preference` column on `profiles` with allowed values `ranking`, `recently_cooked`, and `most_cooked`.

---

### Priority summary

| # | Feature | Effort | Impact | Differentiator vs. ReciMe |
|---|---------|--------|--------|---------------------------|
| 08 | Smart Meal Planning | Medium | Very High | ReciMe: blank grid, no personalization |
| 09 | AI Recipe Adaptation ✅ | Medium | Very High | No competitor does it |
| 10 | Grocery Pipeline 2.0 | Medium | High | Fixes ReciMe's #1 complaint |
| 11 | Household Sharing | Medium | High | ReciMe has nothing |
| 12 | Multi-Week Calendar + Templates | Medium | High | ReciMe: single week only |
| 13 | Guided Cook Mode | Medium | Medium-High | ReciMe: static text |
| 14 | Video Import (TikTok/IG/YT) | Medium-High | Very High | ✅ Built — ReciMe's flagship, done better |
| 15 | Habit Feedback Loop | Low-Medium | Medium | Makes the app sticky |
| 16 | Cooking Streak | Low | Medium | Flexible cadence — not a Duolingo clone |
| 17 | Grocery Savings Engine | Medium-High | Very High | Skrimp: flyer-only, no personalization. Ours: sale + preference + budget |
| 18 | Recipe Library Sort Preferences | Low | Medium | Personal default library ordering by rank, recency, or cooking frequency |
