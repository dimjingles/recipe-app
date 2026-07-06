# Plan to Eat Competitive Analysis
### PrepTable vs. Plan to Eat -- The Family Meal Planner

**Research date:** July 6, 2026
**Source analysis:** Google Play Store, plantoeat.com, App Store listing, blog reviews

---

## Executive Summary

1. **Plan to Eat is the meal planning specialist for families.** Founded in 2008 (pre-dating smartphones), trusted by 40,000+ families, with a 14-day no-card-required free trial. $5.95/mo or $49/yr.
2. **Its strength is the complete planning-to-shopping pipeline.** Drag-and-drop meal planner, auto-generated aisle-sorted grocery list, serving scaling, and recipe import from any URL all work together seamlessly. Users report 23% reduction in food costs and 47.5% less time planning.
3. **Its weakness is age and lack of AI.** The product is well-built but traditional. No AI recipe generation, no cooking history, no intelligent recommendations. It's a tool you use to plan, not a system that gets smarter.
4. **Plan to Eat is our most direct feature competitor.** We're both aiming for the same workflow (import -> plan -> shop -> cook), but they have a 16-year head start on execution. Our AI-native approach is the wedge.

---

## 1. Company & Product Overview

**Product:** Plan to Eat -- "Meal Planner, Recipe Organizer, and Automatic Grocery Lists"
**URL:** plantoeat.com
**Founded:** 2008 (web app first, mobile later)
**Company:** Plan to Eat, LLC (Loveland, CO)
**Platforms:** iOS, Android, Web
**Rating:** 4.7 stars, 3.32K reviews (Android)
**Downloads:** 100K+ (Android)
**Claimed users:** 40,000+ families
**Free trial:** 14 days, no credit card required

---

## 2. Feature Inventory

### Recipe Import & Organization
- **URL import** from any website (browser share sheet or share icon)
- **Manual entry** for handwritten/family recipes
- **Photo import** of physical recipes (recent addition -- works well per reviews)
- **Search** by title, ingredient, course, main ingredient, tags, rating
- **Categories and tags** for organization
- **Recipe ratings** (star system)

### Meal Planning
- **Drag-and-drop calendar** -- plan days, weeks, or months ahead
- **Scale servings** per recipe without editing the original
- **Reschedule recipes** easily
- **Plan leftovers** and track frozen meals
- **Save menu templates** for reuse
- **Leftover tagging** and schedule notes
- **Multi-week/month view**

### Grocery List
- **Auto-generated** from meal plan ingredients
- **Aisle-sorted** with customizable categories and store-specific lists
- **Extra items** can be added manually
- **Staples list** for frequently purchased items
- **Re-orderable categories**
- **Per-store lists** (different stores, different aisle orders)

### Sharing & Sync
- **Family sync** -- share recipes, meal plans, and shopping lists across devices
- **Friend sharing** -- connect and share recipes between accounts
- **Text/email sharing** of individual recipes
- **Cross-device** -- sign in on all mobile devices and web

### Cooking
- **Step-by-step cooking mode** ("Start Cooking" button)
- No voice guidance or built-in timers mentioned

### Nutrition
- **Nutrition & macro tracking** (confirmed on website -- listed as a feature)

### Import & Migration
- Import from other apps (Pinterest, web)
- Photo import from physical cookbooks

---

## 3. Pricing

| Tier | Price | Key Features |
|------|-------|-------------|
| Free trial | $0 (14 days, no card) | Full access for 14 days |
| Annual | $49/year ($4.08/mo billed annually) | Everything |
| Monthly | $5.95/mo | Everything |

---

## 4. Key Weaknesses (Our Opportunities)

### 1. No AI Features
Plan to Eat is a traditional tool -- it does what you tell it to, nothing more. No AI recipe generation, no ingredient substitution suggestions, no cook-frequency-based recommendations, no auto-fill planner.

**Opportunity:** AI-native features are our core differentiator. Recipe adaptation, smart recommendations, and AI auto-fill are things Plan to Eat can't do without a full rebuild.

### 2. No Cooking History or Habit Loop
Plan to Eat helps you plan and shop, but once you cook, the app has no idea. No "cooked it" button, no cook log, no streak tracking, no personalization based on what you actually make.

**Opportunity:** Our cooking log, Elo ranking, and habit features create retention P2E can't match. The app stays useful even after the meal plan is done.

### 3. No Recipe Ranking / Tier List
Star ratings are basic. No head-to-head comparison, no way to meaningfully compare recipes against each other.

**Opportunity:** Elo-based ranking is unique to PrepTable. No competitor does this.

### 4. No Household-Specific Sharing
"Family sync" shares everything between accounts -- not a model where two people share one recipe library but maintain separate preferences/rankings.

**Opportunity:** Our household sharing model (shared recipes, separate rankings per person) is a more nuanced and realistic model for couples.

### 5. Recipe Import is Basic URL + Manual
No social media import (TikTok, Instagram). No AI-powered parsing from screenshots or handwritten notes. The photo import is recent and still requires manual verification.

---

## 5. Head-to-Head Comparison

| Capability | Plan to Eat | PrepTable |
|------------|-------------|---------------|
| Recipe import - URL | Yes | Planned |
| Recipe import - social | No | Planned |
| Recipe import - photo | Yes (recent, requires verification) | No |
| AI recipe generation | No | Yes (Claude) |
| AI recommendations | No | Yes (cook-frequency-based) |
| Recipe ranking | Star ratings | Elo head-to-head |
| Cooking log / history | No | Yes |
| Meal planning | Yes (drag-and-drop, multi-week) | Yes (weekly) |
| Grocery list | Yes (aisle-sorted, store-specific) | Yes (smart consolidation) |
| Ingredient scaling | Yes | Planned |
| Nutrition tracking | Yes | No |
| Free trial | 14 days, no card | Free (no trial needed) |
| Pricing | $4.08/mo (annual) or $5.95/mo | Free (currently) |
| Family sharing | Yes (full sync) | Planned (household model) |
| Step-by-step cooking | Yes (basic) | Planned |
| Multi-week calendar | Yes | Planned (feature 08) |
| Saved menu templates | Yes | Planned (feature 08) |

---

## 6. Strategy Implications

**Plan to Eat is the feature benchmark for meal planning.** If we want to replace it, we need:
- Multi-week calendar (already in feature 08 spec)
- Menu templates (already in feature 08 spec)
- Store-specific grocery lists (smart consolidation is a head start)
- Serving scaling that propagates to the grocery list
- Nutrition tracking (gap to close)

**The AI wedge is real.** Plan to Eat has 16 years of iteration on the manual workflow. They can't easily add AI-native features without a rewrite. Every AI feature we ship that they don't have widens the gap.

**Pricing advantage is temporary.** We're free now, but the comparison will change when we introduce pricing. P2E's $49/yr is reasonable. Our premium tier needs to clearly deliver more value.

**The acquisition target:** The P2E user who's tired of manually planning every week even with the template system, who wishes the app would suggest what to cook, who wants to track what they actually made, and who wants smarter grocery features. Search term: "Plan to Eat alternative with AI."
