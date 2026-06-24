# 🍽️ Mise en Place — Recipe & Meal Planner

A mobile-first web app to track your home recipes, plan weekly meals, and generate smart grocery lists. Built with Next.js 16, Supabase, and Claude AI.

---

## Features

- **Recipe Library** — Add recipes by name; AI auto-fills ingredients, quantities, cuisine & cook time
- **Cooking History** — Log every time you cook a recipe with ratings and notes
- **Weekly Meal Planner** — Assign recipes to days of the week, navigate weeks
- **Grocery List** — Auto-generated from your weekly plan, grouped by category (produce/dairy/meat/etc), checkable as you shop, shareable via Web Share API
- **AI Recommendations** — Get 5 new recipe ideas based on your cooking history
- **PWA** — Installable on Android (Add to Home Screen in Chrome)
- **Magic Link Auth** — No password needed; sign in with email link

---

## Deploy in 15 minutes

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your: **Project URL**, **anon key**, **service_role key**
3. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
4. Go to **Authentication → URL Configuration** → set Site URL to your Vercel URL (you'll get this in step 3, or use `http://localhost:3000` for now)

### 2. Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key

### 3. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/dimjingles/recipe-app)

Or manually:
```bash
npm i -g vercel
vercel
```

Set these environment variables in Vercel:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

### 4. Update Supabase auth redirect URL

After you have your Vercel URL:
- Supabase → Authentication → URL Configuration
- Add `https://your-app.vercel.app/**` to **Redirect URLs**

### 5. Install on Android

Open the app in Chrome → three-dot menu → **Add to Home Screen**. Done! Full PWA experience.

---

## Local development

```bash
# Clone and install
git clone https://github.com/dimjingles/recipe-app
cd recipe-app
npm install

# Set up environment
cp .env.local.example .env.local
# Fill in your Supabase and Anthropic credentials

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Tech Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database + Auth | Supabase (Postgres + magic link) |
| AI | Anthropic Claude API |
| Styling | Tailwind CSS + shadcn/ui |
| Hosting | Vercel |

---

## App Structure

```
src/
├── app/
│   ├── page.tsx                    # Dashboard / home
│   ├── login/page.tsx              # Magic link login
│   ├── recipes/
│   │   ├── page.tsx                # Recipe library
│   │   ├── new/page.tsx            # Add recipe (AI ingredient lookup)
│   │   └── [id]/
│   │       ├── page.tsx            # Recipe detail
│   │       └── edit/page.tsx       # Edit recipe
│   ├── planner/
│   │   ├── page.tsx                # Weekly meal planner
│   │   └── grocery/page.tsx        # Grocery list
│   └── api/
│       ├── recipes/
│       │   ├── route.ts            # Create recipe
│       │   ├── [id]/route.ts       # Update/delete recipe
│       │   ├── [id]/log/route.ts   # Log cooking session
│       │   ├── lookup/route.ts     # AI ingredient lookup
│       │   └── recommend/route.ts  # AI recommendations
│       └── planner/
│           ├── slots/route.ts      # Add/remove plan slots
│           ├── week/route.ts       # Get week plan
│           └── grocery/route.ts    # Generate grocery list
├── components/
│   ├── bottom-nav.tsx              # Mobile navigation
│   ├── recipe-library.tsx          # Recipe grid + search
│   ├── recipe-detail.tsx           # Recipe detail view
│   ├── edit-recipe-form.tsx        # Edit recipe form
│   ├── planner-view.tsx            # Weekly planner UI
│   └── grocery-list.tsx            # Grocery list UI
└── lib/
    ├── supabase/                   # Supabase client helpers
    └── db/                         # Database query functions
```

---

## Future ideas

- Recipe photo uploads (Supabase Storage)
- Share recipes with Emily
- Serving size scaling on grocery list
- Nutrition info via AI
- React Native / Android native app (same Supabase backend)
