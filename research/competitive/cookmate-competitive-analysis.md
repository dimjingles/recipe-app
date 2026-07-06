# COOKmate Competitive Analysis
### PrepTable vs. COOKmate -- The Veteran Recipe Manager

**Research date:** July 6, 2026
**Source analysis:** Google Play Store, cookmate.online, cookmate.io

---

## Executive Summary

1. **COOKmate is a veteran recipe manager** (formerly My CookBook) with 10+ years of development history. 4.7 stars from 45K+ reviews, 1M+ downloads. It's the Paprika alternative for Android-first users.
2. **Its strength is import breadth.** Supports 200+ recipe websites, TikTok import, bookmarklet, file import (MMF, MXP, FDX, RK formats), photo scanning, and ChatGPT-powered recipe generation.
3. **Its weakness is age.** The UI looks dated. Features feel bolted on rather than integrated. The free tier is limited to 60 recipes. The credit-based AI system (50 free credits/mo) feels gamified in a way that frustrates power users.
4. **COOKmate is a collection tool, not a cooking system.** Like ReciMe, it helps you save recipes but doesn't help you cook them -- no cooking log, no habit loop, no cook-history-based AI.

---

## 1. Company & Product Overview

**Product:** COOKmate (formerly My CookBook) -- "My recipe organizer"
**URL:** cookmate.online
**Developer:** Maadinfo Services (Grasse, France)
**Platforms:** Android, iOS, Web, Amazon Appstore, Huawei AppGallery, Alexa, Wear OS
**Rating:** 4.7 stars, 45.7K reviews
**Downloads:** 1M+ on Google Play
**Updated:** May 7, 2026

---

## 2. Feature Inventory

### Recipe Import
- **200+ supported websites** (with a site request/vote system)
- **TikTok import** (requires COOKmate Online account -- added in v5.3.3, May 2026)
- **Bookmarklet** for browser-based import
- **Photo scan** of cookbooks and magazines
- **File import**: Meal Master (.mmf), MasterCook (.mxp), LivingCookBook (.fdx), Rezkonv (.rk)
- **AI import** for unsupported sites (credit-based)
- **ChatGPT recipe generator** (1 credit per recipe)
- **OpenAI image generation** for recipe photos (10 credits per image)

### Recipe Organization
- Categories and tags
- Custom themes and font sizes
- Search engine for finding new recipes from supported sites
- Cookbook-sharing with friends (COOKmate Online)

### Meal Planning & Shopping
- Meal planner (requires COOKmate Online account)
- Shopping list generation from recipes
- Ingredient scaling

### Smart Features
- **Wear OS support** -- recipes on your watch with quick-access tile
- **Voice assistant:** Alexa and Google Assistant integration
- **Speech-to-text** recipe reading
- **Cross-device sync** via Dropbox (free) or cloud (premium)
- **Photo scanning** of physical recipes

---

## 3. Pricing

| Tier | Price | Key Limits |
|------|-------|------------|
| Free (local only) | $0 | Unlimited local recipes, no cloud sync |
| Basic Online | $0 | 60 recipes, 1 shopping list, 50 credits/mo, ads |
| Premium Online | 6 EUR/quarter or 20 EUR/year ($6.50/$22 USD) | Unlimited recipes, unlimited lists, 500 credits/mo, no ads |

Credits used for: ChatGPT recipe gen (1 credit), AI import (1 credit), photo scan (1 credit/area), image gen (10 credits)

---

## 4. Key Weaknesses (Our Opportunities)

### 1. Dated UI / UX
The app has been around for a decade and it shows. Features are functional but feel patched together. No modern design language.

**Opportunity:** PrepTable's clean, modern PWA design is a differentiator. Skip the learning curve of a 10-year-old app.

### 2. No Cooking Habit Loop
No cooking log, no history, no "cooked it" button, no streak tracking. COOKmate is a recipe filing cabinet.

**Opportunity:** Cooking log, Elo ranking, and cook-frequency AI recs are features COOKmate doesn't have and would be hard to retrofit into an older codebase.

### 3. Credit System Creates Friction
50 free credits/month for AI features means users ration their usage. Every ChatGPT recipe gen, AI import, or scan costs a credit. Power users hit the wall.

**Opportunity:** PrepTable ships Claude AI features with no credit system -- unlimited AI recipe generation, instruction writing, and recommendations.

### 4. No Household / Partner Sharing
The "friends" feature shares individual recipes, not a shared household library or joint meal plan. Couples who cook together can't share a unified experience.

**Opportunity:** Our planned household sharing (feature 09) is a direct differentiator.

### 5. Limited Free Cloud Tier
60 recipes is a low ceiling. Users either manage locally (no sync) or pay. Most serious cooks will hit 60 recipes quickly.

---

## 5. Head-to-Head Comparison

| Capability | COOKmate | PrepTable |
|------------|----------|---------------|
| Recipe import - websites | Yes (200+ sites) | Planned (URL import) |
| Recipe import - TikTok | Yes (new, May 2026) | Planned |
| Recipe import - photo | Yes (credit-based) | No |
| Recipe import - file formats | Yes (MMF, MXP, FDX, RK) | No |
| AI recipe generation | Yes (ChatGPT, credit-based) | Yes (Claude, unlimited) |
| AI recipe recommendations | No | Yes (cook-frequency based) |
| Recipe ranking | No | Yes (Elo system) |
| Cooking log / history | No | Yes |
| Meal planning | Yes (requires Online account) | Yes |
| Grocery list | Yes | Yes (smart consolidation) |
| Ingredient scaling | Yes | Planned |
| Nutrition tracking | No | No |
| Household sharing | No | Planned |
| Guided cooking mode | No (speech read-aloud only) | Planned |
| Wear OS support | Yes | No |
| Voice assistant | Alexa, Google Assistant | No |
| Cross-device sync | Dropbox / Cloud | Planned |
| Pricing | Free local, ~$22/yr premium | Free (currently) |

---

## 6. Strategy Implications

**COOKmate is not a direct threat.** Its audience is the patient recipe collector who doesn't mind an older UI and is willing to navigate a credit system. That user isn't switching for flashy features.

**The acquisition target:** The COOKmate user who's frustrated by the credit wall, limited free tier, lack of cooking history, or outdated design. When they search for a modern alternative, PrepTable should be there.

**What to copy:**
- The 200+ site import is aspirational. Even 20 high-quality import sources would be a strong start.
- Wear OS support is a nice touch but low priority for now.
- File format import (Paprika export, MMF) is important for migration -- users switching to PrepTable need to bring their recipes with them.
