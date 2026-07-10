# PrepTable Growth Plan — July 2026

*Synthesized from: full codebase audit, `research/competitive/*` (9 competitor analyses), `features/*` specs, `docs/style-guide.md`, a design/UX review, a performance review, and July-2026 market research.*

---

## 0. Verdict

The product is far better than its distribution. 12 of 13 specced features are actually built — social/video import, AI adaptation, guided cook mode, smart planning, skills, households — a feature set that beats most competitors on paper. But the app is **100% auth-walled** (only `/login` is public), sends **zero notifications** (permission is collected in onboarding, nothing dispatches), has **zero analytics**, is not yet in any app store, and has no public page a prospective user could ever see. Meanwhile ReciMe grew from ~800K (when our research was written) to a claimed **10M users**, largely on social-import wow + TikTok content + app-store presence.

**The gap is not features. It is: (1) no public surface, (2) no retention system, (3) no app-store distribution, (4) no measurement, (5) two table-stakes holes (nutrition, photo import).**

North star (unchanged, from `docs/executive-summary.md`): **home-cooked meals per active user per week.** User count = acquisition × activation × retention; the five features below each attack one of those terms.

---

## 1. Where the app stands

**Built and strong** (per code audit):
- Import: URL/HTML + YouTube (transcript) + TikTok/Instagram, SSRF-guarded, with text fallback and Android Web Share Target
- AI: adaptation into linked variants, streaming Chef AI coach, auto-fill planner, instruction generation, technique classification (Haiku/Sonnet cost split)
- Guided Cook Mode: wake lock, auto-detected + manual timers, voice control
- Social: friends, households, per-person rankings, activity feed, invites w/ QR
- Planner: relevance-scored picker, diversity nudges, AI auto-fill; grocery list with real consolidation (verified better than ReciMe's)
- Onboarding: polished 14-step Cal-AI-style wizard
- PWA plumbing: manifest, SW, offline fallback, TWA `assetlinks.json` placeholder

**Missing / broken for growth**:
- No public recipe pages, no landing page, no SEO surface, no share-out loop (share = household-only; visibility = friends-or-private)
- No push delivery, no streaks/habit loop (specs 15/16 unbuilt; a streak commit exists in git but no code survives in `src/`)
- No nutrition, no photo-scan (OCR) import, no Paprika/file import
- No analytics (PostHog/GA/etc.), no error tracking (Sentry)
- Not in Play Store yet (TWA Track A done; Tracks B/C pending; domain + final name undecided)
- Google OAuth is the only sign-in
- Feature 17 (grocery savings engine) is the only unbuilt spec
- Fabricated social proof in onboarding (`onboarding-wizard.tsx`: "Sarah K.", "4.9", "10K+ home cooks") — must be removed/replaced before public launch (store-review + FTC risk)
- Doc hygiene: `FEATURES.md` marks 18 as Pending (it shipped, #19); `plan.md`/`README.md` still say magic-link auth (it's Google OAuth)

---

## 2. Why the successful apps are bigger — and how to close each gap

| App | Scale (2026) | What actually makes them big | Our gap-closer |
|---|---|---|---|
| **ReciMe** | ~10M claimed users, 1M+ Play installs, 4.7★ | Social-import wow; relentless TikTok content (164K followers); both app stores; $39.99–59.99/yr monetization funding paid growth | We already match/beat the import tech. Close: app-store presence (TWA now), public web surface, content playbook. Exploit: their grocery dedup failure, static recipes, no households, pricing backlash → generous free tier |
| **Paprika** | 6M+ users | Decade of trust; offline-first reliability; one-time price | Real offline caching (Serwist) for cook mode + saved recipes; Paprika-export file import as a switcher ramp |
| **Samsung Food (Whisk)** | Tens of millions (bundled) | Free; giant SEO recipe database; nutrition on everything; community | Public/SEO recipe pages; AI nutrition estimates; differentiate on *personal* intelligence (they're generic) |
| **Plan to Eat** | 40K+ paying families | Planning→shopping pipeline depth; family sync | Features 10 (grocery 2.0) + 11 (household realtime) finish this — with AI they don't have |
| **Cal AI** | $40M ARR in ~18 months | Influencer engine (250 on retainer); quiz onboarding → hard paywall; 61 paywall experiments — a *measurement culture* | We copied the onboarding UX already. Copy the measurement: analytics + experiments. Monetization later (stay free until ~1K MAU per `research/competitive/recime-competitive-analysis.md` §8.5) |

**Structural differences in one line each:**
1. They can be discovered (stores + public web); PrepTable cannot be seen without an account.
2. They re-engage users (push/email/streaks); PrepTable never contacts a user again.
3. They measure funnels and iterate; PrepTable is flying blind.
4. They pass the roundup checklist (nutrition, photo import); PrepTable gets eliminated on two rows.
5. They run content/creator engines; PrepTable has no marketing surface at all (not a code feature, but the landing/share pages are its prerequisite).

**Our durable edges to lean into** (unique per all 9 competitor files): recipe intelligence (Elo-style ranking, cook history, skill tree, AI adaptation), verified-superior grocery consolidation, streaming AI coach, full web parity, and a generous free tier vs. everyone's caps.

---

## 3. The five next features (ranked for user-count impact)

### Feature 1 — Open the front door: public recipe pages + share loop + landing page
**Attacks: acquisition + referral (k-factor). The single biggest structural gap.**
- Public, logged-out recipe page at `/r/[token]` (or `/u/[username]/r/[slug]` honoring visibility): hero image, ingredients, steps, rich OG/Twitter card, `Recipe` JSON-LD for SEO, and a persistent **"Save to your PrepTable"** CTA → signup → recipe lands in the new user's library (the ReciMe-import wow, but as a *received-share* wow).
- Public cookbook share pages (same pattern, list view).
- "Share" action on recipe detail/cook-mode completion (Web Share API, already used for grocery text).
- Real logged-out landing page at `/` (currently redirects to `/login`): value prop, live import demo teaser, install CTAs; move dashboard to authed state only.
- Add **Apple + email (magic link) sign-in** alongside Google — Google-only is a conversion tax on the exact users arriving from shares.
- Success metric: share-link views → signups (target k ≥ 0.15 to start), SEO impressions compounding, % of new signups from shared links.

### Feature 2 — The retention engine: push notifications + flexible streaks + weekly ritual (specs 15 + 16)
**Attacks: retention — the multiplier on every acquired user. Also finishes a promise the app already makes (permission collected, nothing sent).**
- Web Push (VAPID) — works on Android + installed iOS PWA (16.4+), and in the Play TWA.
- Notification set (all opt-in, low frequency): "plan your week" Sunday ritual; day-before defrost/prep nudge from the plan; "you planned X tonight" with one-tap cook mode; weekly recap ("You cooked 4 of 5 planned meals").
- Streaks with **flexible cadence** (daily / 3×-week / weekly windows per spec 16) + freeze token; streak card on Home; feeds the activity feed (social pressure) once visible.
- Success metric: D7/D30 retention, notification opt-in %, planned-meals-per-week per active user (north star).

### Feature 3 — Close the consideration-set holes: AI nutrition + photo-scan import (+ Paprika file import)
**Attacks: acquisition (survive every roundup/comparison table) + activation ("import my life" moment).**
- Nutrition: Haiku estimates per-serving calories/macros on save/import, cached per recipe version; shown on detail + cards + filters ("under 600 cal"); pairs with the adaptation engine ("make it higher-protein" with real numbers — no competitor has that combination).
- Photo-scan import: photograph a cookbook page/handwritten card → Claude vision → same `ExtractedRecipe` preview flow that URL/video import uses. Research calls this "a migration path from physical cookbooks."
- Paprika/MMF/FDX file import (per `cookmate` analysis) — the switcher on-ramp; zero AI cost.
- Success metric: % of imports via photo/file; signup conversion from "switching from X" landing content; roundup inclusion.

### Feature 4 — Household realtime: shared plan + live grocery check-off (spec 11)
**Attacks: referral (mechanical — every household = at least one invite) + retention (two people depending on one app).**
- Supabase Realtime on `weekly_plan_slots` + a new shared grocery check-state (grocery checks are currently localStorage-only — they don't even sync across one user's devices).
- Shared cooking log visibility inside a household ("we made this"), split responsibilities (one plans, one shops).
- The segment (couples/families cooking together) is called "completely unserved by competitors" in the research; Plan to Eat's sync shares everything with no per-person prefs — ours already has per-person rankings.
- Success metric: household invites sent/accepted per 100 users; % multi-member households; churn delta for household vs. solo users.

### Feature 5 — Grocery Pipeline 2.0 + pantry + cost estimates (spec 10, folding in a "17-lite")
**Attacks: retention/word-of-mouth — fixes the #1 complaint against every app in the category.**
- Real-time plan→list sync (edit recipe/servings/day → list updates), serving scaling that propagates, customizable categories/aisle order, pantry ("I have this") deductions with a `pantry_items` table, "cook from what I have" suggestions (borrowed from KitchenPal per research).
- Claude-estimated per-recipe and per-week cost (defer the flyer-scraping pipeline of full spec 17 until this proves out).
- Marketing claim the research says only we can make: **"the only recipe app that actually combines your grocery list"** (ReciMe verifiably fails dedup).
- Success metric: weekly grocery-list opens per planner user; check-off completion rate; qualitative review mentions.

**Explicitly deferred:** full flyer-scraping savings engine (17) until cost-estimates prove demand; native iOS app (revisit after TWA + PWA-push data); community/discover feed (public pages first — they create the content surface).

---

## 4. Foundation track (parallel, mostly small — without these the five features can't compound)

1. **Analytics + error tracking (week 1):** PostHog (funnel: signup → first import → first plan → first cook → W1 return) + Sentry. Cal AI ran 61 paywall experiments; we can't run one.
2. **Ship the Play Store TWA** (memory: Track A done): lock domain → Bubblewrap build + assetlinks fingerprint (Track B) → Play Console org account, store assets, privacy policy page, demo credentials (Track C).
3. **Brand decision:** research flags the Mise/Meez/RecipeMise collision explicitly; code still ships `mise-v1` SW cache and `com.miseenplace.app` placeholder. Pick **PrepTable** (already differentiated) or rename deliberately — before store submission bakes it in.
4. **Compliance before public:** remove fabricated testimonials/ratings/statistics from onboarding; write privacy policy; Data Safety form.
5. **Auth options:** Apple + magic link (see Feature 1).
6. **Doc hygiene:** correct FEATURES.md statuses (18 shipped; cook mode/ranking/cookbooks lack specs), fix stale auth description in README/plan.md.

---

## 5. Design upgrade plan (from the design review)

**Quick wins (do in week 1–2):**
1. Promote **Grocery** into the bottom nav; demote Skills into a "More"/profile cluster — the style guide itself specifies this nav (`docs/style-guide.md:180-187`); grocery is currently two levels deep behind Planner.
2. Replace 3 native `alert()`/`confirm()` calls with the existing BottomSheet pattern (`profile/household-card.tsx:68`, `edit-recipe-form.tsx:131`, `grocery-list.tsx:74`).
3. Fix `safe-area-pb` no-op on `bottom-nav.tsx:55` (class is defined nowhere; use `pb-[env(safe-area-inset-bottom)]` like cook mode does correctly).
4. Give `BottomSheet` dialog semantics (`role="dialog"`, `aria-modal`, focus trap, Escape) — one component fixes every sheet in the app.
5. Fix sub-AA contrast in onboarding (`text-gray-400` body text) and sub-44px touch targets (library sort toggle, friend accept/decline, log-delete).
6. Replace hardcoded green/yellow/red feedback colors (`recipe-detail.tsx:29-33`) with the sage/cooking/tomato tokens that exist for exactly this; align grocery checkbox to sage.

**Structural (schedule with features):**
- **Cold start / activation:** new users land on an empty dashboard where Auto-fill is disabled at 0 recipes. Seed a starter pack from onboarding cuisine answers (5–8 curated recipes with photos) + first-run "import your first recipe" moment. This is an activation feature as much as design.
- **Recipe detail CTA wall:** up to ~8 stacked full-width buttons; collapse to one dominant "Cook this" + overflow, per the style guide's own spec.
- **Emoji-as-imagery:** the guide warns against it twice; it's the primary food visual everywhere. Move to the existing gradient placeholder + real photos (image search/upload already built).
- **Dark mode:** tokens are authored but no ThemeProvider is mounted, and 12 files hardcode light-only colors. Either wire + purge hardcodes, or delete the `.dark` block. (Recommend wiring it — table stakes for a kitchen app used at night.)
- **Motion polish:** sheets pop with no animation (guide specifies slide+fade), no pull-to-refresh, no swipe gestures. Add sheet transitions at minimum.

---

## 6. Performance upgrade plan (from the perf review, ranked)

1. **`React.cache` the user/profile lookup** — 92 `auth.getUser()` calls, zero memoization; a dashboard load makes ~6 serialized auth round-trips to Supabase before any data query (`src/lib/supabase/*`, `src/lib/db/*`).
2. **Add missing DB indexes** (one migration): `recipe_rankings(user_id, recipe_id)`, `weekly_plans(user_id, week_start)`, `weekly_plan_slots(plan_id)`, `cooking_log(user_id, cooked_at desc)`, `ingredients(recipe_id)`, `cookbook_recipes(cookbook_id)`/`(recipe_id)` — every hot path currently seq-scans, and RLS predicates compound it.
3. **Take AI off the render path:** `classifyTechniques()` blocks recipe-detail SSR for legacy recipes (`app/recipes/[id]/page.tsx:59-66`) — move to `after()`/Suspense; stream adapt-recipe + instruction generation the way chat already streams (3–4K-token blocking calls today).
4. **`next/image` + `remotePatterns`** — zero image optimization on an image-heavy mobile app (5 raw `<img>`; full-res originals to phones). Biggest LCP/data win.
5. **Adopt Next 16 Cache Components** (`cacheComponents: true`, `use cache` + `cacheLife`) — currently zero caching idioms; start with the `techniques` catalogue (re-fetched on every detail render and every chat message).
6. **Dashboard over-fetch:** Home selects the entire library with ingredient embeds to show 6 cards (`app/page.tsx:28-34`) — dedicated limited select.
7. **Code-split interaction-gated components** (`next/dynamic` for ChefAiChat, AdaptRecipeDialog, RecipeGallery inside the 1,073-line recipe-detail client component).
8. **Real offline (Serwist):** SW today only serves a fallback page; visited recipes/planner aren't available offline — core value for a kitchen app (and a Paprika edge).
9. **Re-enable build type-checking** (`ignoreBuildErrors: true` in `next.config.ts`) and fix the 3 open TS bugs in `bugs/` (BUG-001/002/003) + the `useState`-as-effect in `recipe-detail.tsx:167`.

---

## 7. 90-day sequence

**Phase 0 — Measure + polish (weeks 1–2)**
Analytics + Sentry · perf items 1, 2, 4, 6, 9 · design quick wins 1–6 · remove fake social proof · doc hygiene · lock domain + name → start Play Console org verification (runs in background).

**Phase 1 — Open the front door (weeks 2–5)**
Feature 1 (public pages, share loop, landing, OG/JSON-LD, Apple+email auth) · ship Play Store TWA (Tracks B+C) · starter-pack cold start.

**Phase 2 — Keep them (weeks 5–8)**
Feature 2 (push + streaks + weekly ritual) · perf item 3 (streaming AI, render path) · sheet animations · dark mode wiring.

**Phase 3 — Deepen + spread (weeks 8–12)**
Feature 4 (household realtime) · Feature 5 (grocery 2.0 + pantry + costs) · Feature 3 (nutrition + photo/file import) · perf items 5, 7, 8.

**Continuous:** TikTok/IG import-demo content (the ReciMe playbook — every public recipe page is a content asset); review funnel dashboards weekly; write specs in `features/` before each build (repo convention).

---

## 8. Metric tree

```
North star: home-cooked meals / active user / week
├─ Acquisition: signups/week
│   ├─ share-link views → signup conversion (Feature 1)
│   ├─ Play Store installs (Foundation 2)
│   └─ SEO impressions on public pages (Feature 1)
├─ Activation: % new users who import ≥1 recipe AND plan ≥1 meal in week 1
│   ├─ starter pack + first-import flow (Design/cold start)
│   └─ photo/file import for switchers (Feature 3)
├─ Retention: D30, weekly planning ritual completion
│   ├─ push opt-in % and CTR (Feature 2)
│   ├─ streak participation (Feature 2)
│   └─ grocery list weekly use (Feature 5)
└─ Referral: k-factor
    ├─ household invites (Feature 4)
    └─ recipe shares sent per user (Feature 1)
```

---

## 9. Sources (market data, July 2026)

- ReciMe scale & reviews: [recipeone.app ReciMe review](https://www.recipeone.app/blog/recime-app-review), [Google Play listing](https://play.google.com/store/apps/details?id=com.recime.app&hl=en_US), [SmartCompany growth story](https://www.smartcompany.com.au/startupsmart/recime-sizzles-jumping-20000-400000-users-in-2023/)
- Market size & engagement: [ElectroIQ recipe app statistics](https://electroiq.com/stats/recipe-app-statistics/), [XtendedView recipe app statistics](https://xtendedview.com/recipe-app-statistics/)
- Samsung Food: [Plan to Eat's Samsung Food review](https://www.plantoeat.com/blog/2026/01/samsung-food-review-pros-and-cons/)
- Cal AI playbook: [Growthcurve case study](https://growthcurve.co/three-engines-and-an-exit-the-cal-ai-growth-playbook), [Superwall paywall experiments](https://superwall.com/case-studies/cal-ai), [FunnelFox influencer engine](https://blog.funnelfox.com/cal-ai-influencer-marketing/), [Latka revenue](https://getlatka.com/companies/calai.app)
