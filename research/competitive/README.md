# Competitive Research

This folder houses competitive analysis for apps in the recipe management, meal planning, and grocery savings space. Each document analyzes a competitor against PrepTable, identifying strengths to match, weaknesses to exploit, and strategic positioning.

---

## Competitors Covered

| # | Competitor | Category | Date Analyzed | Key Takeaway |
|---|-----------|----------|--------------|--------------|
| 1 | **ReciMe** | Social recipe import + organizer | Jul 3, 2026 | The 800-lb gorilla on social import. Weak on grocery, cooking depth, and household sharing. Our best wedge is recipe intelligence. |
| 2 | **Skrimp.ai** | Flyer-driven meal planning | Jul 6, 2026 | Sale-matched planning is a great feature. 90-curated-recipe ceiling means users outgrow it. Our cost-awareness feature (17) covers this without flyer scraping. |
| 3 | **COOKmate** | Veteran recipe manager | Jul 6, 2026 | 10+ years old, 200+ site import, dated UX, credit-based AI. The patient collector's choice. Not a direct threat. |
| 4 | **Plan to Eat** | Family meal planning specialist | Jul 6, 2026 | 16 years of iteration on planning-to-shopping pipeline. Our most direct workflow competitor. No AI features -- our wedge. |
| 5 | **KitchenPal** | Pantry-first kitchen manager | Jul 6, 2026 | Feature-dense but UX-heavy. Pantry tracking is its moat. Different niche -- waste-conscious household vs. engaged home cook. |
| 6 | **CookBook App** | AI-native recipe manager | Jul 6, 2026 | Closest feature competitor. Has social import, AI chef, voice cooking. Weak: aggressive paywall (20 recipe cap), no ranking, no household model. |
| 7 | **Flipp** | Flyer + deal aggregator | Jul 6, 2026 | Dominant flyer platform, 10M+ downloads. No recipe or meal planning features at all. Complementary, not competitive -- for now. |
| 8 | **Meez (meezenplace.app)** | Visual Cook Mode + import | Jul 6, 2026 | Closest product competitor. Paste-any-URL import, immersive Cook Mode with voice narration, Maestro (2 recipes). Early stage (49 recipes, 48 cooks). Name is suspiciously close to "PrepTable." |
| 9 | **Mise / RecipeMise (recipemise.com)** | AI sous chef + native mobile | Jul 6, 2026 | Most feature-complete competitor matching our vision. Native iOS + Android. AI recipe from photo, social import, voice cook mode, prep scheduling. Single developer, very early (50+ downloads). Third "mise" name collision. |

---

## Cross-Competitor Comparison Matrix

| Feature | PrepTable | ReciMe | Skrimp | COOKmate | Plan to Eat | KitchenPal | CookBook | Flipp | Meez | RecipeMise |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| URL recipe import | Planned | Yes | No | Yes | Yes | Premium | Yes | No | **Yes** | **Yes** |
| Social import (TikTok/IG) | Planned | Yes | No | TikTok only | No | No | Yes | No | No | **Yes*** |
| Photo-to-recipe AI | No | No | No | No | No | No | No | No | No | **Yes*** |
| AI recipe from description | Yes | No | No | Yes (credit) | No | No | Yes | No | No | **Yes*** |
| AI recommendations | Yes | No | No | No | No | No | No (trending only) | No | **Yes** | No |
| Recipe ranking (Elo) | Yes | No | No | No | Stars | No | Cook count | No | No | No |
| Cooking log / history | Yes | No | No | No | No | No | Last-cooked only | No | No | Basic |
| Meal planning | Yes | Yes | Yes | Yes (online) | Yes | Premium | Yes | No | No | **Yes** |
| Prep scheduling | No | No | No | No | No | No | No | No | No | **Yes** |
| Grocery list - consolidation | Yes | No | Yes | Yes | Yes | Yes | Yes | No | **Yes** | **Yes** |
| Grocery list - aisle sort | Yes | Unknown | Yes | Yes | Yes | Yes | Yes | No | Unknown | **Yes** |
| Cook Mode (step-by-step) | Planned | No | No | No | Basic | No | Yes | No | **Yes** | **Yes*** |
| Voice narration | Planned | No | No | No | No | No | **Yes** | No | **Yes** | **Yes*** |
| Voice commands (next/repeat) | No | No | No | No | No | No | No | No | No | **Yes*** |
| Smart scaling | Planned | No | No | Yes | Yes | No | **Yes** | No | No | **Yes*** |
| Recipe translation | No | No | No | No | No | No | No | No | No | **Yes*** |
| Sale-matched planning | Planned | No | Yes | No | No | No | No | **Yes** | No | No |
| Cost estimation | Planned | No | Yes (flyer) | No | No | No | No | **Yes** | No | No |
| Nutrition tracking | No | Plus | No | No | Yes | Yes | Yes | No | No | No |
| Pantry management | No | No | No | No | No | Yes | No | No | No | No |
| Household sharing | Planned | No | No | Partial | Full sync | Full sync | Cross-device sync | Basic | No | Basic |
| Native mobile app | No | **Yes** | No | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | No | **Yes** |
| Free tier generosity | Excellent | Poor | Good | Poor | Trial (14d) | Poor | Poor (20 recipe cap) | Excellent | Excellent | Good |

* = Premium/gated feature

---

## Strategic Themes

### Where We Win Today
- **Recipe ranking (Elo)** -- unique in the market. No competitor does this.
- **Cooking log / history** -- only PrepTable tracks what you actually cooked, with notes.
- **AI recommendations** -- cook-frequency-based recs are unique. No one else personalizes based on what you've actually made.
- **Free tier generosity** -- unlimited recipes, no caps vs. ReciMe's 5/week, CookBook's 20 total, COOKmate's 60.
- **Grocery consolidation** -- only PrepTable merges duplicate ingredients across recipes. ReciMe confirmed broken here.

### Where We Need to Close Gaps
1. **URL/social recipe import** -- the single biggest gap. Every competitor has some form of this. Without it, we can't be in the consideration set.
2. **Nutrition tracking** -- Plan to Eat, CookBook, and KitchenPal all have it. ReciMe has it gated behind Plus. It's becoming table stakes.
3. **Guided cooking mode** -- CookBook and Plan to Eat have it. Users expect it.
4. **Photo scanning** -- ReciMe, COOKmate, CookBook, and KitchenPal all offer it. It's a migration path from physical cookbooks.

### Our Unique Wedge
Most competitors are recipe *savers* or meal *planners* or kitchen *managers*. PrepTable is a recipe *intelligence* system -- it gets smarter the more you cook, helps you rank your collection, adapts recipes to your needs, and makes you a better cook over time. That narrative doesn't exist in any competitor's positioning.

---

## Related

- Feature spec for the grocery savings engine: `features/17-grocery-savings-engine.md`
- Feature spec for smart meal planning (multi-week calendar + templates): `features/08-smart-meal-planning.md`
- Feature spec for household sharing: `features/09-social-friends.md`
