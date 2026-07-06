# Skrimp.ai Competitive Analysis
### PrepTable vs. Skrimp.ai -- The Grocery Savings Angle

**Research date:** July 6, 2026
**Source analysis:** skrimp.ai website, pricing page, Google Play store listing, UW news article, Facebook page

---

## Executive Summary

1. **Skrimp.ai is a flyer-first meal planner** -- its core value prop is building a weekly meal plan around what's on sale at grocery stores. Users save 20%+ on groceries by planning meals around discounts.
2. **It's small but growing.** Founded in early 2026 by a University of Waterloo student (Henrietta van Niekerk), picked up by CTV, Rogers TV, and UWaterloo News. Free tier with paid Premium at $4.99/mo.
3. **The flyer aggregation is the moat.** Skrimp scrapes 15+ Canadian grocery store flyers (No Frills, Walmart, Loblaws, Metro, Sobeys, etc.) to surface deals. Data like this takes real work to maintain.
4. **Our angle shouldn't be matching their flyer data.** Instead, we can deliver 80% of the value with zero flyer-scraping via Claude ingredient cost estimation + user-contributed sale items. This is already spec'd in `features/17-grocery-savings-engine.md`.
5. **Skrimp's weakness is recipe depth.** At launch they had ~90 curated recipes (free) and ~300+ (premium). No personal recipe library, no import from social, no cooking history. Users eventually outgrow it.

---

## 1. Company & Product Overview

**Product:** Skrimp.ai -- "Save more on every grocery run"
**URL:** skrimp.ai
**Tagline:** "Compare flyers, plan meals, and auto-add items to your cart across 15+ Canadian stores"
**Founder:** Henrietta van Niekerk (UWaterloo GBDA student, Enterprise Co-op)
**Launch:** Early 2026
**Press:** CTV, Rogers TV, UWaterloo News

### Platforms
- Chrome Extension (primary entry point -- "Add to Chrome - It's Free")
- Web app (Next.js)
- No native mobile app confirmed

### Scale
- No user numbers publicly available
- Members "typically save 20%+ on weekly groceries" (self-reported)

---

## 2. Feature Inventory

### Core: Flyer-Driven Meal Planning
- Scrapes weekly flyers from 15+ Canadian grocery chains
- Matches sale items to recipes in its curated library
- "Meal plan in 5 minutes" -- meals matched to local sales
- Auto-adds items to a shopping cart via Chrome extension
- Aisle-sorted, printable grocery lists

### Recipe Library (Curated, Not Personal)
- Free: 90+ curated recipes
- Premium: 300+ curated recipes
- Premium: "Import favourite recipes" -- one-way import from somewhere, limited

### Premium Features ($4.99/mo)
- Import favourite recipes
- 300+ curated recipes
- Manage dietary preferences
- Find your best store (which store has the best deals for you)
- Real deal flyer alerts
- Browse local flyers

### Missing vs. PrepTable
| Feature | Skrimp.ai | PrepTable |
|---------|-----------|---------------|
| Personal recipe library | No (curated only) | Yes |
| Social media import | No | Yes (planned URL import) |
| Cooking log / history | No | Yes |
| Recipe ranking | No | Yes (Elo system) |
| AI recipe generation | No | Yes (Claude) |
| Household sharing | No | Planned |
| Cost estimation | Flyer-based (live prices) | AI-estimated (Claude) |
| Meal planning | Yes (sale-driven) | Yes (weekly planner) |
| Grocery list | Yes (aisle-sorted) | Yes (smart consolidation) |

---

## 3. Pricing

| Tier | Price | Key Features |
|------|-------|-------------|
| Free | $0 | Meal plan in 5 min, sale-matched meals, aisle-sorted lists, 90 recipes |
| Premium | $4.99/mo | Recipe import, 300+ recipes, dietary prefs, best store finder, flyer alerts |

---

## 4. Key Weaknesses (Our Opportunities)

### 1. No Personal Recipe Library
Users can't save their own recipes. The 90/300 curated recipes are a ceiling. Once you've cooked through them, you leave.

**Opportunity:** PrepTable already has a full personal recipe library. The grocery savings feature is a complement, not the whole product.

### 2. Flyer Scraping Is Expensive to Maintain
15+ store flyers change weekly. If a store changes its flyer format or blocks scraping, it breaks. The Chrome extension dependency means users must be on desktop.

**Opportunity:** Our Claude-based cost estimation + user-contributed sale items approach (feature 17) requires zero scraping infrastructure. It works on mobile, scales globally, and improves with user contributions.

### 3. No Cooking Habit Loop
Skrimp helps you plan and save money, but doesn't track what you actually cooked, log your history, or build a personalized experience over time.

**Opportunity:** PrepTable's cooking log, streak tracking, and cook-frequency-based AI recs create retention that Skrimp can't match.

### 4. Curated Recipes Only
No import from TikTok, Instagram, websites, or cookbooks. The recipe library is pre-set and limited.

**Opportunity:** PrepTable's AI import and generation pipeline means users bring their own recipes, not a preselected catalog.

### 5. Chrome Extension Gate
Primary entry point is a Chrome extension. No native mobile app. This limits reach, especially for the primary meal-planning use case (which is mobile).

---

## 5. Head-to-Head Comparison

| Capability | Skrimp.ai | PrepTable |
|------------|-----------|---------------|
| Sale-matched meal planning | Yes (flyer-scraped) | Planned (Claude cost est.) |
| Grocery list with aisle sort | Yes | Yes (smart consolidation) |
| Personal recipe library | No | Yes |
| Recipe import (URL/social) | Limited (premium) | Planned |
| AI recipe generation | No | Yes (Claude) |
| Cooking history / log | No | Yes |
| Recipe ranking | No | Yes (Elo) |
| Household sharing | No | Planned |
| Dietary preferences | Yes (premium) | No (planned) |
| Nutrition tracking | No | No |
| Guided cooking mode | No | Planned (feature 09 context) |
| Native mobile app | No (Chrome ext only) | PWA (installable) |
| Flyer alerts | Yes (premium) | No (different approach) |

---

## 6. Strategy Implications

**Don't compete on flyer data.** Building a flyer-scraping engine for 15+ Canadian stores is a full-time job. Skrimp is a year ahead and it's the entire product.

**Compete on recipe depth and habit retention.** The user who outgrows Skrimp's 90/300 curated recipes is our ideal acquisition target. They already care about saving money -- we show them how much each recipe costs, what's on sale (via user input), and help them actually cook from their personal library.

**Feature 17 is the right approach.** The spec in `features/17-grocery-savings-engine.md` delivers cost-aware meal planning without the flyer-scraping overhead. Ship it and Skrimp's value prop becomes a feature, not a competitor.

**The acquisition channel:** When Skrimp users search "Skrimp alternatives" or "grocery savings app with my own recipes" -- that's our organic search moment.
