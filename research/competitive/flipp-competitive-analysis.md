# Flipp Competitive Analysis
### PrepTable vs. Flipp -- The Flyer and Deal Aggregator

**Research date:** July 6, 2026
**Source analysis:** flipp.com, Google Play Store, Apple App Store

---

## Executive Summary

1. **Flipp is the dominant flyer aggregation platform** in Canada. 10M+ Android downloads, 831K iOS ratings (4.7 stars), Editors' Choice on both platforms. Toronto-based company. Owned the space for a decade.
2. **Flipp is a shopping tool, not a cooking tool.** Its core job is helping you find deals across 2000+ stores, compare prices, clip coupons to loyalty cards (PC Optimum, Triangle Rewards, Air Miles), and build a shopping list. It has zero recipe functionality -- no recipe library, no meal planning, no cooking features.
3. **The overlap with PrepTable is the shopping list + deal awareness.** Flipp's shopping list can surface deals on items you add. PrepTable's planned grocery savings engine (feature 17) can estimate costs and accept user-contributed sale items. Flipp has the live deal data; we'd be smart to not compete there.
4. **Flipp is complementary, not competitive.** A user could use both apps: Flipp to find what's on sale and build a shopping list, PrepTable to manage recipes, plan meals, and build a smarter grocery pipeline. The risk is that Flipp adds recipe features (they own the shopping list + deal discovery combo already).

---

## 1. Company & Product Overview

**Product:** Flipp -- "Flyers, Shopping List, Weekly Ads"
**URL:** flipp.com
**Company:** Flipp Operations Inc. (Toronto, ON -- 3250 Bloor St W)
**Platforms:** iOS (4.7 stars, 831K ratings), Android (4.8 stars, 423K reviews), iPad, web
**Downloads:** 10M+ Android, massive iOS install base
**Rating:** 4.8 (Google Play Editors' Choice), 4.7 (Apple Editors' Choice)
**Updated:** June 25, 2026

---

## 2. Feature Inventory

### Flyer Aggregation (Core)
- Browse weekly digital flyers from **2000+ retailers**
- Featured Canadian grocers: Walmart, No Frills, Loblaws, Real Canadian Superstore, Metro, Sobeys, FreshCo, Food Basics, Save-On-Foods, Fortinos, Giant Tiger
- US grocers: Walmart, Target, Albertsons, Safeway, Publix, Kroger
- Beyond groceries: Canadian Tire, Home Depot, Lowe's, Best Buy, Petco/Petsmart, Shoppers Drug Mart, Rexall, Costco
- Category browsing (grocery, pharmacy, electronics, pets, home & garden, general merchandise)
- Postal-code-based local flyer discovery

### Search & Price Comparison
- Search any item to see which stores have it on sale
- Compare prices across multiple stores
- Price-match support (clip deals for price matching at participating stores)

### Shopping List
- Create digital shopping lists
- Add ("clip") deals from flyers directly to the list
- Add custom items
- Auto-matches list items to current deals
- Share and combine lists with friends (real-time sync -- though reviews note this was recently broken/removed)
- Arrow-to-compare: tap any list item to compare prices at different stores

### Coupons & Loyalty
- Clip digital coupons that sync to loyalty cards
- **Loyalty card wallet**: PC Optimum, Triangle Rewards, Air Miles -- store all reward cards in one place
- Manage loyalty rewards in-app

### Watch Lists & Notifications
- Create Watch Lists for items you're tracking
- Get notified when deals drop on watched items
- "Notifications Hell" per reviews -- hard to fine-tune

### Other
- Browse by store category
- Explore page to discover new local stores
- No recipe features, no meal planning, no cooking tools

---

## 3. Pricing

| Tier | Price | Key Features |
|------|-------|-------------|
| Free | $0 | Everything -- all flyers, price comparison, shopping list, coupons, loyalty wallet |

Flipp is entirely free, ad-supported. No premium tier. No subscription.

---

## 4. Key Weaknesses (Our Opportunities)

### 1. Zero Recipe or Meal Planning Features
Flipp is purely a deal-finding and shopping list tool. There's no recipe library, no meal planner, no cooking features at all. You can find deals on "ground beef" but you can't plan what to make with it.

**Opportunity:** This is the biggest gap. Flipp helps you save money at the store but doesn't help you decide what to cook. PrepTable starts where Flipp ends -- you plan your meals, then see what it'll cost.

### 2. Shopping List is Basic
The list is a simple line-item tracker. No smart consolidation, no automatic grouping by ingredient categories, no per-store aisle optimization. Reviews complain about sync issues and lost features.

**Opportunity:** PrepTable's smart grocery consolidation (unit-normalizing, deduping, categorizing) is much more sophisticated. Flipp's list is a notepad with deal overlays.

### 3. Notification Spam
Reviews consistently call out "Notifications Hell" -- you either disable all notifications or get bombarded. No granular control.

**Opportunity:** Clean, intentional notification design is an advantage in any comparison.

### 4. No Personalization Beyond Watch Lists
Flipp doesn't learn your preferences, dietary restrictions, or cooking habits. The app is the same for every user.

**Opportunity:** Our cook-frequency-based AI recs and personal recipe ranking are entirely outside Flipp's capabilities.

### 5. Feature Regressions
Multiple reviews mention features that were removed (sync between household members, ability to see own lists properly). This suggests a product team that's cutting features rather than building them out.

---

## 5. Head-to-Head Comparison

| Capability | Flipp | PrepTable |
|------------|-------|---------------|
| Flyer aggregation | Yes (2000+ stores, core feature) | No |
| Real-time price comparison | Yes | No |
| Deal alerts / watch lists | Yes | No |
| Loyalty card wallet | Yes (PC Optimum, Triangle, Air Miles) | No |
| Digital coupons | Yes (clip-to-card) | No |
| Shopping list | Yes (basic, deal-matched) | Yes (smart consolidation) |
| Shared shopping lists | Yes (was broken, may be fixed) | Planned |
| Recipe library | No | Yes |
| Meal planning | No | Yes |
| AI recipe generation | No | Yes (Claude) |
| AI recommendations | No | Yes (cook-frequency-based) |
| Recipe ranking | No | Yes (Elo system) |
| Cooking log / history | No | Yes |
| Grocery savings engine | Live prices + flyers | Planned (Claude est. + user input) |
| Nutrition tracking | No | No |
| Guided cooking mode | No | Planned |

---

## 6. Strategy Implications

**Flipp is not a direct competitor.** It's a flyer browser with a shopping list bolted on. PrepTable is a cooking system. The overlap is only on the shopping list, and even there we're serving different primary jobs.

**The real risk:** Flipp could add recipe features. They have the deal data, the shopping list, and 10M+ downloads. If they add meal planning and recipe import, they'd be a serious threat. But it would be a major pivot -- Flipp is a shopping/logistics company, not a cooking company.

**Our relationship to Flipp:**
- **Complementary:** A user can browse Flipp for deals, then plan meals in PrepTable using what's on sale. They don't compete on the same workflow step.
- **Feature 17 bridges the gap:** Our grocery savings engine (Claude cost estimation + user-contributed sale items) gives us a lightweight version of Flipp's deal awareness without needing flyer infrastructure. A user who wants real-time flyer data keeps using Flipp. A user who wants "roughly, what will this cost and what's cheap this week?" gets it in PrepTable.

**What to watch:**
- If Flipp launches a "meal ideas from what's on sale" feature, that's a shot across the bow.
- If Flipp acquires or partners with a recipe app (ReciMe, CookBook), that's a threat vector.
- If Flipp adds a simple meal planner (just a calendar + shopping list link), it becomes more competitive. But recipe management is a fundamentally harder problem than flyer browsing.

**Verdict:** Flipp belongs in the competitive landscape because they own the deal-discovery space that our feature 17 touches. But they're not competing for the same user. The Flipp user needs a recipe app. We should be that app.
