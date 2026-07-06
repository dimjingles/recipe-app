# 17 - Grocery Savings Engine: Sale-Matched Meal Planning & Budget Tracking

**Priority: 1 - differentiator against every recipe app, matches the Skrimp.ai product model on cost savings.**

**Depends on:** Existing `recipes` (ingredients table, cook_time), `weekly_plans` / `weekly_plan_slots`, existing grocery list (`/planner/grocery`), existing `ingredients` table. Reuses the `/api/planner/auto-fill` pattern from feature 08 and the `buildUserContext()` helper from feature 08's reuse pointers.

---

## What it builds

Skrimp.ai showed the market that people want their meal plan driven by what's cheap this week - not what they feel like cooking. PrepTable can do the same thing and go further by combining **automated flyer scraping** (matching Skrimp's core data moat) with everything the app already knows about the user: cooking history, skill level, dietary preferences, and personal recipe library.

| Layer | What it does | Data source |
|-------|-------------|-------------|
| **Automated flyer scraping** | Weekly crawl of 15+ Canadian grocery flyers, parsed by Claude Sonnet vision | Public flyer PDFs/pages + Claude Sonnet |
| **Cost estimation** | Tags every recipe with an estimated total ingredient cost | Claude Haiku + ingredient-level price mapping DB |
| **Sale-match badges** | "On Sale" badges on recipes whose key ingredients match active sale items | Automated flyer pipeline + manual entry |
| **Sale-driven auto-fill** | AI meal planning that checks the pantry of sale items first | Feature 08's auto-fill + sale item context |
| **Budget awareness** | User sets a weekly grocery budget; planner warns if exceeded | User input + plan-level cost aggregation |
| **Cost breakdown on grocery list** | Shows per-ingredient estimate, per-store subtotals, and total vs. budget | Ingredient pricing + sale deductions |

---

## User story

> As a home cook, I want to know what my meal plan will cost before I go to the store. I want to spot which of my saved recipes use ingredients that are on sale this week. And when I use the auto-fill planner, I want it to prioritise recipes built around what's cheap right now - not what's expensive out of season.

---

## Product considerations

- **Claude estimates ingredient costs, not real-time market prices.** For baseline pricing, Claude Haiku estimates a reasonable ingredient-level cost based on the ingredient name + quantity + unit (e.g. "1 lb chicken breast" -> $5.99). This is a smart guess, not a live price feed. Where real prices are available from flyer scraping, they override the estimate. Users can also override per-ingredient prices.
- **Flyer scraping is the primary data source, not a stretch goal.** Every Wednesday, a cron job crawls store flyer URLs, fetches PDFs, and runs Claude Sonnet (vision) to extract structured deals. This gives us live sale prices across 15+ Canadian stores with ~90% accuracy. Flipp, Reebee, and others have operated this model for years without legal issues — flyers are public marketing materials.
- **Automated and manual sources merge transparently.** The `sale_items` table tracks source ('automated' | 'manual' | 'flyer_import'). Downstream matching logic treats all sources equally. Users can add sale items for stores we don't crawl, or override automated picks.
- **No new vendor costs beyond existing Claude usage.** Flyer parsing uses Claude Sonnet (already used for Chef AI chat). Estimated ~$120-160/year for 15 stores × 52 weeks. Ingredient price estimation uses Claude Haiku (already used for recipe autofill). Both are within existing API spend.
- **Opt-in experience.** Users who don't care about cost or deals never see it. A settings toggle enables "Savings Mode".
- **The winning combination is flyer data + personalization.** Skrimp has flyers and 300 curated recipes. No cooking history, no skill tracking, no dietary adaptation, no Chef AI. Mise with flyer data has everything: live sale prices + your own recipes + full personalization + AI coaching. No competitor offers this combination.
- **Canadian-friendly defaults.** v1 ships with CAD defaults and Canadian supermarket pricing conventions. Users outside Canada set their currency + region for price estimation. Flyer scraping is Canada-only for v1 (Canadian stores listed in the pipeline config).
- **Maintenance surface is real but manageable.** Store URLs change 2-4 times per year. PDF rendering needs a headless browser (puppeteer). Some stores use HTML flyers (easier to scrape), some use PDFs (need render + vision). Budget ~1 hour/quarter for URL upkeep.

---

## Build sequence - ship in 4 vertical slices

---

### Slice 1 — Ingredient cost estimation & price database

**New DB tables:**

```sql
-- Ingredient price estimates (seed data, periodically refreshed by Claude)
create table if not exists ingredient_prices (
  id uuid primary key default gen_random_uuid(),
  ingredient_name text not null,          -- canonical ingredient name, lowercased
  unit text not null,                     -- 'lb', 'kg', 'piece', 'cup', 'tbsp', 'clove', 'can', 'bunch', 'oz', etc.
  estimated_cost decimal(6,2) not null,   -- CAD default
  category text,                          -- 'produce', 'meat', 'seafood', 'dairy', 'bakery', 'pantry', 'spices', 'frozen'
  last_estimated_at timestamptz default now(),
  unique (ingredient_name, unit)
);

-- User override for ingredient prices (personal knowledge of local pricing)
create table if not exists user_ingredient_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  ingredient_name text not null,
  unit text not null,
  user_cost decimal(6,2) not null,        -- user's known local price
  store_name text,                        -- optional: which store this price is for
  created_at timestamptz default now(),
  unique (user_id, ingredient_name, unit, coalesce(store_name, '__any__'))
);

-- Sale items (automated scraping or user-contributed)
create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  source text not null default 'automated'
    check (source in ('automated', 'manual', 'flyer_import')),
  ingredient_name text not null,
  unit text,
  sale_price decimal(6,2) not null,
  regular_price decimal(6,2),           -- extracted from flyer for savings comparison
  store_name text not null,
  sale_starts_at date default current_date,
  sale_ends_at date,
  flyer_page_url text,                  -- source URL of the flyer page
  flyer_image_url text,                 -- screenshot/PDF render of the deal
  is_active boolean default true,        -- soft-deactivate expired items
  created_at timestamptz default now()
);

create index if not exists idx_sale_items_active
  on sale_items (user_id, store_name, is_active)
  where is_active = true;

create index if not exists idx_sale_items_expiry
  on sale_items (sale_ends_at)
  where is_active = true;
```

**RLS policies:**

```sql
alter table ingredient_prices enable row level security;
create policy "ingredient_prices are public read" on ingredient_prices for select using (true);

alter table user_ingredient_prices enable row level security;
create policy "own user_ingredient_prices - select" on user_ingredient_prices for select using (auth.uid() = user_id);
create policy "own user_ingredient_prices - insert" on user_ingredient_prices for insert with check (auth.uid() = user_id);
create policy "own user_ingredient_prices - update" on user_ingredient_prices for update using (auth.uid() = user_id);
create policy "own user_ingredient_prices - delete" on user_ingredient_prices for delete using (auth.uid() = user_id);

alter table sale_items enable row level security;
create policy "own sale_items - select" on sale_items for select using (auth.uid() = user_id);
create policy "own sale_items - insert" on sale_items for insert with check (auth.uid() = user_id);
create policy "own sale_items - update" on sale_items for update using (auth.uid() = user_id);
create policy "own sale_items - delete" on sale_items for delete using (auth.uid() = user_id);
```

**New API routes:**

**`POST /api/ingredients/estimate-cost`** — Given a recipe_id (or a list of ingredients), returns estimated per-ingredient and total cost:

```ts
// Request body: { recipe_id: string } | { ingredients: Array<{ name, quantity, unit }> }
// Response: {
//   ingredients: Array<{ name, quantity, unit, estimated_cost, source: 'db'|'ai_estimate' }>,
//   total_estimated_cost: number,
//   currency: 'CAD'
// }
```

Lookup logic:
1. Check `user_ingredient_prices` for user overrides (prefer exact store match)
2. Check `ingredient_prices` for canonical DB estimate
3. If neither exists, call Claude Haiku to estimate and INSERT into `ingredient_prices` for future reuse
4. If `sale_items` has an active sale for this ingredient and the `sale_price` is lower, show both (strikethrough regular price, sale price in green)

**`PATCH /api/ingredients/user-price`** — User overrides an ingredient price for their profile:
- Body: `{ ingredient_name, unit, user_cost, store_name? }`
- Upserts into `user_ingredient_prices`

**`POST /api/sale-items`** — Add sale items:
- Body: `{ ingredient_name, unit, sale_price, store_name?, sale_ends_at? }`
- Or: `{ flyer_url: string }` — Claude parses the web page for sale items and returns structured data for user confirmation
- Single-item mode: inserts directly
- Flyer mode: returns parsed items, user confirms which to keep

**New components:**

| Component | Purpose |
|-----------|---------|
| `src/components/ingredient-cost-cell.tsx` | Displays a single ingredient with estimated cost, sale badge, and editable price |
| `src/components/sale-item-form.tsx` | Bottom sheet form: add a sale item manually or paste a flyer URL for AI parsing |
| `src/components/sale-item-list.tsx` | Card list of active sale items for the current week |
| `src/components/cost-badge.tsx` | Small chip showing "$X.XX" on recipe cards in the library |

**Acceptance:**
- Every recipe in the library shows an estimated total cost badge on its card
- Tapping the badge opens a breakdown of per-ingredient costs
- Ingredients not yet in the price DB are estimated by Claude on first request, then cached
- User can tap any ingredient to override its price
- Adding a sale item via manual form works immediately
- Adding a sale item via flyer URL shows parsed results for confirmation
- Existing recipes that haven't been costed get lazy-estimated on first library view or pre-warmed via a background cron job

**Files to create/modify:**

| File | Change |
|------|--------|
| `supabase/migrations/017_grocery_savings.sql` | New migration: `ingredient_prices`, `user_ingredient_prices`, `sale_items` tables + RLS + seed data |
| `src/types/database.ts` | Add Row/Insert types for new tables |
| `src/lib/db/ingredient-pricing.ts` | Core pricing logic: resolve best price for ingredient, look-up chain, cache |
| `src/app/api/ingredients/estimate-cost/route.ts` | New POST route for recipe cost estimation |
| `src/app/api/ingredients/user-price/route.ts` | New PATCH route for user price overrides |
| `src/app/api/sale-items/route.ts` | New POST route for sale items (manual + flyer parsing) |
| `src/lib/supabase/server.ts` | No changes — reuses existing client |
| `src/components/recipe-card.tsx` | Add cost badge |
| `src/components/recipe-detail.tsx` | Add ingredient cost breakdown section |
| `src/components/ingredient-cost-cell.tsx` | New component |
| `src/components/cost-badge.tsx` | New component |
| `src/components/sale-item-form.tsx` | New component |
| `src/components/sale-item-list.tsx` | New component |

---

### Slice 2 — Budget-aware meal planning

**User budget setting:**

Add a `weekly_budget` column to `profiles`:

```sql
alter table profiles add column if not exists weekly_budget decimal(7,2); -- null = disabled
alter table profiles add column if not exists savings_mode boolean default false;
```

**New components and changes to the planner:**

1. **Budget input** — on the planner page, a compact "Weekly budget" row above the grid:
   - Tappable chip showing "Budget: $X.XX" or "Set budget"
   - Tapping opens a small inline form or a bottom sheet with a number input + currency selector
   - Budget chip changes color: green (under budget), yellow (80-99% used), red (over budget)

2. **Cost aggregation on the planner** — a "Plan total" bar below the grid:
   - Shows: "Plan total: $34.50 / $75.00 budget"
   - Per-day cost breakdown when tapped: "Mon: $8.50 | Tue: $12.00 | Wed: $0 | ..."
   - Updates in real time as recipes are added/removed

3. **Budget-aware recipe picker** — when a budget is set and the user is near or over budget:
   - Pick up to 3 cheaper alternatives for the next slot
   - Recipes with total cost under $5 get a "$ Budget-friendly" badge
   - On the recipe picker bottom sheet, show a "Cost: $X.XX" label on each recipe row

4. **Budget warning on auto-fill** — Feature 08's auto-fill route receives the budget as context:
   - Claude Haiku prompt gains: `weekly_budget: $75.00`
   - Instruction: "Prefer recipes whose total estimated cost is under $20 for weekday meals. Keep the total cost of the entire plan under the weekly budget."
   - Return `{ slots: [...], estimated_total: 42.50 }` alongside the plan

**Acceptance:**
- Setting a weekly budget works and persists
- Planner shows cost total vs. budget in real time
- Auto-fill respects budget constraint (total < budget)
- Recipes with estimated cost under $5 are flagged "Budget-friendly"
- If the plan exceeds budget, the budget chip turns red with a warning

**Files to create/modify:**

| File | Change |
|------|--------|
| `supabase/migrations/017_grocery_savings.sql` | Add `weekly_budget`, `savings_mode` columns to profiles |
| `src/types/database.ts` | Update `Profile` type |
| `src/components/planner-view.tsx` | Add budget row, plan total bar, budget-aware recipe scores |
| `src/components/budget-input.tsx` | New component: inline budget setter |
| `src/components/plan-cost-summary.tsx` | New component: cost bar with per-day breakdown |
| `src/app/api/planner/auto-fill/route.ts` | Update prompt to include budget context, return `estimated_total` |
| `src/lib/db/planner.ts` | Add cost-based scoring factors to the recipe relevance function |

---

### Slice 3 — Sale-matched recipe discovery & "Cook what's on sale" mode

This is the core Skrimp-like feature: show the user which of their recipes are cheapest to make right now because key ingredients are on sale.

**Sale-matched badge on recipes:**

When a recipe's ingredients overlap with active `sale_items`:
- If 1+ ingredient matches: small green "On Sale" badge on the recipe card
- If 2+ key ingredients match (proteins or produce): "🔥 Sale match" badge
- If the majority of ingredients are on sale: "This week's steal" badge

The matching logic:

```ts
function getSaleMatchLevel(
  recipeId: string,
  activeSaleItems: SaleItem[],
  recipeIngredients: Ingredient[]
): SaleMatchLevel {
  const matchedItems = recipeIngredients.filter(ing =>
    activeSaleItems.some(sale =>
      normalizeIngredientName(ing.name) === normalizeIngredientName(sale.ingredient_name)
    )
  )

  if (matchedItems.length === 0) return 'none'
  
  // Count "key" ingredients (proteins, expensive produce)
  const keyMatches = matchedItems.filter(ing =>
    ['meat', 'seafood', 'produce'].includes(ing.category)
  ).length
  
  const totalKeyIngredients = recipeIngredients.filter(ing =>
    ['meat', 'seafood', 'produce'].includes(ing.category)
  ).length

  if (keyMatches >= totalKeyIngredients && totalKeyIngredients > 0) return 'steal'
  if (keyMatches >= 2) return 'hot'
  return 'on_sale'
}
```

**New "Sale Matches" section on Home:**

A new home dashboard card: **"This week's deals"** showing:
- Active sale items the user has entered (compact list, editable)
- A carousel of up to 6 recipes that are sale-matched, sorted by match level
- "Browse all sale-matched recipes" link (/recipes?sort=sale_match)

**Sale sort on Recipe Library:**

The existing recipe library gets a new sort option: "On Sale First" in the sort dropdown. When active:
- Recipes with "steal" match float to the top
- Then "hot" match
- Then "on_sale"
- Then all others
- Each recipe card shows the match badge

**"Cook what's on sale" auto-fill mode:**

Alternative auto-fill mode accessible from the planner:
- Button: "Auto-fill with sale items" (alongside or replacing the standard "Auto-fill week")
- Mode flag triggers Claude Haiku prompt: "Prioritise recipes that match active sale items. At least 70% of the week's meals should come from sale-matched recipes if possible."
- Prompt includes the user's active sale items list
- Fallback: if fewer than 5 sale-matched recipes exist, fill remaining slots with regular preference-based picks

**Sale item expiry awareness:**

- Sale items with `sale_ends_at` within 2 days show "Ending soon ⏰" badge
- Sale items past their end date are automatically excluded from matching (filter the query with `where sale_ends_at >= current_date or sale_ends_at is null`)
- A weekly cron job (or on-first-load check) cleans up expired sale items (marks them inactive, doesn't delete for history)

**Acceptance:**
- Active sale items appear on the home dashboard
- Recipes with matching ingredients get "On Sale" badges in the library
- "On Sale First" sort brings sale-matched recipes to the top
- "Auto-fill with sale items" prioritises sale-matched recipes
- Expired sale items disappear from matches automatically
- Sale items ending soon show a time-sensitive badge

**Files to create/modify:**

| File | Change |
|------|--------|
| `src/lib/db/sale-matching.ts` | New: `getSaleMatchLevel()`, `getSaleMatchedRecipes()` functions |
| `src/components/recipe-card.tsx` | Add sale match badge rendering |
| `src/app/page.tsx` | Add "This week's deals" section on the home dashboard |
| `src/components/weekly-deals-card.tsx` | New component: home dashboard card |
| `src/components/recipe-library.tsx` | Add "On Sale First" sort option |
| `src/components/planner-view.tsx` | Add "Auto-fill with sale items" button |
| `src/app/api/planner/auto-fill/route.ts` | Accept `sale_mode: boolean`, pass sale items to prompt |
| `src/lib/normalize-ingredient.ts` | Utility: normalize ingredient names for fuzzy matching |

---

### Slice 4 — Grocery list cost breakdown & flyer import flow

**Cost breakdown on the grocery list (`/planner/grocery`):**

The existing grocery list page gets a cost panel:

1. **Header bar** — compact cost summary:
   - "Estimated total: $42.50 (with sales: $37.20)"
   - If budget is set: "Budget: $75.00 — $37.80 remaining"
   - A small "Edit prices" pencil icon opens the in-line price editor

2. **Per-ingredient cost** — each row shows estimated cost:
   - "Chicken breast — 1 lb — $5.99"
   - If on sale: strikethrough $5.99 + green "$3.99 sale at No Frills"
   - User can tap the price to override (opens inline number input)

3. **Store subtotals** — if the user has items from different stores:
   - The list is grouped by store
   - Each store section shows a subtotal
   - "Split shop: $25.40 at No Frills + $14.80 at Walmart"

4. **Sale savings callout** — a green badge:
   - "Total savings this week: $5.30 from sale items"
   - Only shown if at least 1 sale item was matched

**Flyer import flow (power user):**

A user who finds a flyer online can paste the URL into the sale item form:

1. User taps "+" on the "This week's deals" card or on the planner
2. Selects "Import from flyer URL" tab
3. Pastes URL (e.g. `https://www.nofrills.ca/flyer`)
4. `POST /api/sale-items` with `{ flyer_url }` triggers a headless page load (Puppeteer or browserless) or web extraction via `web_extract`
5. Claude Haiku parses the extracted text for sale items (product names + prices + dates)
6. Returns structured data: `[{ ingredient_name: "Chicken Breast", unit: "lb", sale_price: 3.99, store_name: "No Frills" }, ...]`
7. User reviews in a confirmation list — taps ✓ or ✗ on each item
8. Confirmed items are saved to `sale_items`

Fallback for non-scrapable pages: user pastes the flyer text manually.

**Flyer import via image (stretch goal):**
If the user takes a screenshot of a flyer or saves a PDF:
- Upload the image to the app
- Claude Sonnet vision extracts sale items from the image
- Returns the same structured format

**Acceptance:**
- Grocery list shows estimated total cost
- Sale-matched items show strikethrough regular price + sale price
- Store grouping shows subtotals per store
- Sale savings callout shows total saved
- User can override any per-ingredient price
- Flyer URL import works and shows parsed items for confirmation
- Manual entry still works for users who don't want to paste URLs

**Files to create/modify:**

| File | Change |
|------|--------|
| `src/components/grocery-list-view.tsx` | Major update: add cost column, store grouping, sale badges, budget remaining |
| `src/components/grocery-cost-summary.tsx` | New component: header cost summary bar |
| `src/components/sale-item-form.tsx` | Update: add "Import from flyer URL" tab with AI parsing |
| `src/app/api/sale-items/route.ts` | Update: handle `{ flyer_url }` with web extraction + Claude parsing |
| `src/lib/anthropic.ts` | No changes — reuses `HAIKU` for text parsing, note `SONNET` for vision-based flyer parsing as stretch |
| `src/lib/db/ingredient-pricing.ts` | Add `getStoreSubtotals()` function |

---

### Slice 5 — Automated flyer scraping pipeline

A weekly cron job that autonomously crawls all supported grocery stores, extracts deals via Claude Sonnet vision, and upserts them into `sale_items`. This is what gives Mise live flyer data matching Skrimp's offering.

**Store catalogue (v1 — Canadian):**

| Store | Flyer type | URL pattern |
|-------|-----------|-------------|
| No Frills | HTML weekly flyer | `https://www.nofrills.ca/flyer` |
| Walmart | HTML weekly flyer | `https://www.walmart.ca/flyer` |
| Loblaws | HTML weekly flyer | `https://www.loblaws.ca/flyer` |
| Real Canadian Superstore | HTML weekly flyer | `https://www.realcanadiansuperstore.ca/flyer` |
| Zehrs | HTML weekly flyer | `https://www.zehrs.ca/flyer` |
| Food Basics | PDF | `https://www.foodbasics.ca/flyer` |
| Metro | HTML weekly flyer | `https://www.metro.ca/en/online-grocery/offers-flyer` |
| Sobeys | HTML weekly flyer | `https://www.sobeys.com/flyer` |
| FreshCo | HTML weekly flyer | `https://www.freshco.com/flyer` |
| Farm Boy | HTML | `https://www.farmboy.ca/flyer` |
| Longo's | PDF | `https://www.longos.com/flyer` |
| Your Independent Grocer | HTML | `https://www.yourindependentgrocer.ca/flyer` |
| Foodland | HTML | `https://www.foodland.ca/flyer` |

(V2 can extend to US stores — Publix, Kroger, Wegmans, etc.)

**Architecture:**

```
┌─────────────────┐     ┌────────────────┐     ┌──────────────────┐
│ Store URL list   │────>│ Headless fetch │────>│ Claude Sonnet     │
│ (config file)    │     │ (puppeteer)    │     │ vision parse      │
└─────────────────┘     └────────────────┘     └──────────────────┘
                                                      │
                                                      ▼
                                               ┌──────────────────┐
                                               │ Sale items        │
                                               │ upsert            │
                                               │ (deduplicate)     │
                                               └──────────────────┘
                                                      │
                                                      ▼
                                               ┌──────────────────┐
                                               │ Ingredient price  │
                                               │ baseline update   │
                                               │ (regular_price)   │
                                               └──────────────────┘
```

**Cron job: `POST /api/cron/scrape-flyers`**

Triggered by a Hermes cron on a weekly schedule (Wed 6 AM ET — Canadian stores drop new flyers Tuesday night / Wednesday morning).

```ts
// pseudocode for the pipeline
async function scrapeAllFlyers() {
  const stores = getStoreCatalogue() // config.json with URL + type + store_name

  for (const store of stores) {
    try {
      // 1. Fetch the flyer page
      const pageContent = await fetchFlyerPage(store.url, store.type) 
      // type 'html' → web_extract or puppeteer page.text()
      // type 'pdf' → puppeteer page.pdf() or fetch + convert to image

      // 2. Parse via Claude Sonnet vision
      const deals = await parseFlyerWithVision(pageContent, store.name)
      // Returns: Array<{ ingredient_name, unit, sale_price, regular_price?, 
      //                    sale_starts_at, sale_ends_at }>

      // 3. Upsert into sale_items
      for (const deal of deals) {
        await supabase.from('sale_items').upsert({
          user_id: SYSTEM_USER,      // system-owned, shared to all users
          source: 'automated',
          ingredient_name: normalizeIngredientName(deal.ingredient_name),
          unit: deal.unit,
          sale_price: deal.sale_price,
          regular_price: deal.regular_price,
          store_name: store.name,
          sale_starts_at: deal.sale_starts_at ?? new Date(),
          sale_ends_at: deal.sale_ends_at,
          flyer_page_url: store.url,
          is_active: true
        }, {
          onConflict: 'user_id, ingredient_name, store_name, sale_starts_at',
          ignoreDuplicates: false   // update if same item/deal exists
        })
      }

      // 4. Update ingredient price baselines from regular prices
      await updateBaselinePrices(deals, store.name)

      // 5. Deactivate expired items for this store
      await deactivateExpiredItems(store.name)

    } catch (err) {
      console.error(`Failed to scrape ${store.name}:`, err)
      // Don't abort — continue to next store
    }
  }
}
```

**Claude Sonnet prompt for flyer parsing:**

```
You are a grocery flyer parser. Extract all sale items from this flyer content.

For each deal, identify:
- The product name (e.g. "Chicken Breast", "Bell Peppers 3-pack")
- The most likely canonical ingredient name (e.g. "chicken breast", "bell pepper")
- The unit (e.g. "lb", "kg", "each", "pack", "bunch", "piece")
- The sale price (numeric only, e.g. 3.99)
- The regular price if visible (numeric, e.g. 6.99) — null if not shown
- Any date restrictions ("valid until Sunday")

Stores often use loss leaders (pricing below cost on key items like chicken, milk, eggs to
get people in the door). These are real deals — include them.

Ignore: store-brand promotions that are always available, multi-buy offers that require
buying 3+ items, and "spend $X get $Y" promotions (not ingredient-level deals).

Return ONLY valid JSON: { "deals": [{ "ingredient_name": string, "unit": string,
"sale_price": number, "regular_price": number | null, "sale_ends_at": string | null }] }

Focus on ingredients that people actually cook with — fresh produce, meat, seafood, dairy,
pantry staples. Skip prepared meals, cleaning products, and non-food items.
```

**System user architecture:**

Automated flyer data is stored under a **system user** (a dedicated `auth.users` row for the cron job). When serving data to end users, the matching layer queries:

```sql
select * from sale_items
where (user_id = auth.uid() or user_id = SYSTEM_USER_ID)
  and is_active = true
  and sale_ends_at >= current_date
```

This means every user benefits from the same automated flyer data without duplication. Manual entries are per-user and merge in the same query.

**Deduplication strategy:**

When the same ingredient appears on sale at the same store in consecutive weeks, the cron upserts on `(user_id, ingredient_name, store_name, sale_starts_at)`. The previous week's entry naturally expires via `sale_ends_at`. If the new flyer has the same item at the same price, the upsert refreshes the end date. No duplicates.

**Failure handling:**

- Each store scrape is independent — one store failure doesn't block others
- Claude parse failures are logged but don't crash the pipeline
- If the entire pipeline fails (network issue, API outage), the previous week's data remains active. Users see slightly stale flyer data rather than nothing.
- A Hermes notification fires on pipeline failure: "Flyer scrape failed for [stores]. Check logs."

**On-demand scrape (Admin/Maintenance):**

A `POST /api/admin/scrape-flyers?store=nofrills` route allows manual trigger for testing or recovering a single store. Auth-guarded with a service-role API key.

**Acceptance:**

- Cron runs Wed 6 AM ET and processes all 15+ stores
- Sale items appear in the database within 5 minutes per store
- Deduplication: same item from same store in consecutive weeks creates a new row with updated dates, not a duplicate
- Expired items: previous week's items are auto-deactivated by the cron's expiry step
- Failure isolation: one failing store doesn't block others
- System-user data is visible to all authenticated users via the composite query
- Manual user entries coexist with automated data without conflict
- A single-store re-scrape can be triggered via the admin endpoint

**Files to create/modify:**

| File | Change |
|------|--------|
| `scripts/scrape-flyers.ts` | New: the flyer pipeline script, runnable standalone or via API |
| `src/app/api/cron/scrape-flyers/route.ts` | New: API endpoint called by Hermes cron |
| `src/app/api/admin/scrape-flyers/route.ts` | New: admin endpoint for single-store re-scrape |
| `src/lib/db/flyer-config.ts` | New: store catalogue config (name, url, type, active flag) |
| `src/lib/flyer-parsers/html-flyer.ts` | New: HTML flyer fetch + page extraction |
| `src/lib/flyer-parsers/pdf-flyer.ts` | New: PDF flyer fetch + image render |
| `src/lib/anthropic.ts` | No changes — reuses `SONNET` constant |
| `supabase/migrations/017_grocery_savings.sql` | Add system user insert + indexes |
| `.hermes/cron/scrape-flyers.yaml` | New: Hermes cron job definition (Wed 6 AM ET) |

---

## Why this is 10x vs. Skrimp

| Dimension | Skrimp | PrepTable with this feature |
|-----------|--------|--------------------------------|
| Recipe library | 300 curated, can import premium | Your recipes + AI import + unlimited storage (free) |
| Meal planning | Sales-driven, no preference awareness | Sales-driven + preference-aware + skill-aware + diet-safe |
| AI quality | Unknown model | Claude Haiku for planning, Sonnet for Chef AI coaching |
| Existing data | No cooking history, no preferences | Full cooking history, skill profile, taste preferences |
| Habit loop | One-way (sale -> cook) | Two-way (sale -> cook -> log -> learn -> better suggestions) |
| Store data | 15+ flyers scraped (their moat) | 15+ flyers scraped + own recipe prices + user overrides |
| Budgeting | Not available | Full weekly budget tracking with per-recipe cost awareness |
| Price source | Real flyer prices | Real flyer prices + AI-estimated baseline + user-override |

Skrimp has flyers. Mise has flyers **plus** everything else: your own recipe library, cooking history, skill tracking, dietary adaptation, budget tracking, and Chef AI coaching. Skrimp is a flyer app with some recipes. Mise with this feature is a complete cooking OS that happens to know what's on sale.

---

## Open questions

1. **Should ingredient cost estimation happen eagerly (all recipes costed on page load) or lazily (costed on first view)?** Eager is better UX but means N Claude calls on load for a large library. Recommendation: lazy-estimate on recipe card render, with a background queue that pre-calculates the top 20 visible recipes first. Cache aggressively.

2. **How should currency work?** v1 ships with CAD defaults. Add `profiles.currency text default 'CAD'`. Claude's price estimation prompt should include the user's currency context. For ingredient_prices, store a base price in CAD and convert at render time.

3. **Should we show absolute costs or cost ranges?** Ranges ($5-7) are more honest for estimates. Singles ($5.99) look more confident. Recommendation: show singles for user-overridden or sale-item prices, show ranges for AI estimates. Accepted pattern from every grocery delivery app.

4. **System user vs. per-user data model for flyer items?** We need a single source of automated flyer data that all users query, while letting each user add their own sale items. The solution: store automated data under a dedicated "system" user ID. The query layer merges `(user_id = auth.uid() or user_id = SYSTEM_USER_ID)`. Simple, no RLS magic needed, and manual entries can override automated picks by having a per-user row with the same key (query picks the more specific match).

5. **Store selection — should the user pick preferred stores?** Yes. Add `profiles.preferred_stores text[] default '{}'` in Slice 1. When Claude estimates prices, it biases toward the user's stores. Sale items auto-tag their store. The grocery list groups by store.

---

## Acceptance criteria (all slices)

1. Every recipe in the library shows an estimated total cost badge
2. Tapping the cost badge shows per-ingredient cost breakdown
3. User can override any ingredient price
4. Adding a sale item manually works in < 10 seconds
5. Adding a sale item via flyer URL parses correctly and shows confirmation
6. Sale-matched recipes get badges in the library and on recipe cards
7. "On Sale First" sort promotes matched recipes
8. Weekly budget input works and persists
9. Planner shows cost total vs. budget
10. Auto-fill respects budget constraint
11. "Auto-fill with sale items" prioritises sale-matched recipes
12. Grocery list shows total cost, per-ingredient cost, and sale savings
13. Store grouping works when sale items have different stores
14. Expired sale items are excluded automatically
15. Flyer scraping cron runs weekly and processes all stores within 5 min each
16. Automated flyer data is visible to all authenticated users via system-user query
17. Manual and automated sale items coexist without conflict
18. Single-store re-scrape works via admin endpoint
19. Pipeline failure isolates per-store — one broken store doesn't block others
20. No new vendor costs (all Claude Haiku + existing Sonnet)
21. Settings toggle to enable/disable savings mode
22. All RLS policies in place for new tables
