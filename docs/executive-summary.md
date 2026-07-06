# Mise en Place — Executive Summary

---

## North Star

> **Every week, our users cook more meals at home than they would have without us.**

**Metric:** home-cooked meals per active user per week.

**The decision rule:** every feature we build is tested against one question — *does this get someone to cook one more meal at home this week?* Money saved, time saved, skill growth, and less food waste are all downstream of this single behaviour. If a feature doesn't move this number, it's a distraction.

---

## Why this exists

**The problem.** Most recipe apps are graveyards. People save 100 recipes and cook 5. The "what's for dinner?" decision repeats every single day. Planning is a chore. The grocery list is built manually. Takeout wins by default — not because people want it to, but because cooking at home has too much friction.

**The insight.** The value isn't in *storing* recipes. It's in closing the loop:

```
discover → plan → shop → cook → log → improve → discover again
```

Every phase needs to be connected, frictionless, and smart. No existing app does this. ReciMe comes closest but their planning and grocery features are afterthoughts — and their users are saying so publicly.

**The pitch:**
> *ReciMe saves your recipes. Mise en Place helps you actually cook them — with your partner, on budget, adapted to your diet.*

---

## Core benefits

How Mise en Place improves the lives of people who use it:

**You actually cook what you plan.**
The planner, auto-generated grocery list, cooking log, and habit loop all close the gap between "I want to make this" and "I made this." Planning a week takes minutes. The grocery list writes itself. The loop closes instead of breaking down at "what should we have tonight?"

**You spend less money on food.**
Every home-cooked meal replaces a takeout order. The grocery list means you buy exactly what you need for the week — no over-shopping, no duplicate ingredients, no forgotten items. Coming: per-recipe and per-week cost estimates so the savings are visible, not just implied.

**You spend less time deciding — and planning is actually easy.**
Plan a full week of meals in minutes with AI recommendations. The grocery list generates automatically from your plan. No cross-referencing recipes, no manually building a list, no mid-week "I forgot to defrost something" scramble.

**You get better at cooking without thinking about it.**
The skill system and Chef AI weave technique learning into the recipes you're already making. Every time you cook, you're nudged toward something just beyond your current level. Over time your skill tree fills in — growth happens as a side effect of cooking, not as a separate project.

**Cooking feels less like a chore.**
No daily decision fatigue. Never stuck mid-recipe. A personal ranked list of your best dishes means you always have an answer to "what should I make this week?" The app meets you in the kitchen, not just the planning stage.

**Your recipes are actually yours.**
Import from any URL, any video, any caption, any handwritten card. Everything lives in one consistent, searchable place. You're not dependent on a website staying up, a social algorithm resurfacing it, or a $9.99/month subscription to access your own collection.

---

## Core features

What the app does today:

| Feature | What it does |
|---------|-------------|
| **Recipe management** | Save recipes manually, import from any URL or video, paste text, or let AI autofill from just a dish name. AI can write instructions and infer difficulty. |
| **Recipe library** | All your recipes in one place. Search, filter by cuisine, meal type, tag, or cookbook. AI surfaces recommendations based on your collection. |
| **Cookbooks** | Group recipes into named collections (e.g. "Date Night", "Weeknight Easy"). |
| **Weekly meal planner** | Assign recipes to days Mon–Sun. Persists week-over-week. |
| **Grocery list** | Auto-generated from the week's plan. Ingredients aggregated across all recipes, grouped by category, check-off as you shop, shareable. |
| **Chef AI** | Streaming cooking coach inside each recipe. Walks you through step by step, answers questions, nudges you toward techniques you're ready to learn. |
| **Skills** | Curated technique catalogue with a gamified skill tree. Mastery state tracked per user; technique badges on recipe pages. |
| **Recipe ranking** | After cooking, rank recipes head-to-head in a binary-search tournament. Builds your personal top list over time. |
| **Cooking log** | Log every cook with optional notes. History visible on each recipe. |
| **PWA / mobile** | Installable on iOS and Android. Android Web Share Target — share any recipe URL from another app and it imports automatically. |

---

## Where we're headed

The roadmap ladders directly up to the north star. Everything planned is designed to close the loop tighter, reduce friction in the plan→cook cycle, or give users a reason to open the app more often:

- **AI Recipe Adaptation** — transform any recipe for your diet, pantry, or household size in one tap
- **Grocery Pipeline 2.0** — real-time sync, smart dedup, customisable categories, pantry deductions, cost estimates
- **Household Sharing** — partner sees the same plan, same grocery list, in real time
- **Multi-Week Calendar + Saved Templates** — plan ahead, reuse your best weeks
- **Guided Cook Mode** — full-screen step-by-step with built-in timers and voice control
- **Video Import** — TikTok, Instagram, YouTube; same one-tap flow as URL import
- **Habit Feedback Loop** — streaks, weekly cook rates, AI that learns what you actually cook

Full specs and build order: [FEATURES.md — Roadmap](../FEATURES.md#roadmap)
