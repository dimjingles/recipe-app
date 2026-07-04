# Cal AI Onboarding — Reference Screenshots

Captured: 2026-07-03  
Source: Cal AI — Calorie Tracker (Android, Google Play)

53 screenshots of the full Cal AI onboarding flow, from the splash screen through the
subscription paywall and into the main app. Used as design/conversion reference for the
Mise en Place onboarding feature.

## What's in here

The flow in screenshot order:
1. Splash — "Calorie tracking made easy" + Get Started / Sign in
2. Questionnaire steps (sex → workouts/week → referral source → value-prop graph → height → weight ruler → birthday → trainer? → goal → diet → aspirations → potential graph → thank you interstitial → notifications permission → add burned calories → rollover calories → social proof → referral code → commit / tap-and-hold → plan generation)
3. Account creation (Google OAuth / Skip)
4. Paywall — 3-day free trial timeline + annual vs monthly pricing
5. Subscription confirmation
6. Main app — home (calorie ring + daily log), scanner tips, groups, profile

## Key UX patterns to replicate

- **Giant bold headers** — `text-3xl/4xl font-bold`, no preamble
- **Thin progress bar** — single dark line that grows left-to-right, sits next to the back-chevron circle
- **Option cards** — large rounded cards with leading icon, label, optional sub-label, and radio indicator on the right; thick border + filled radio when selected
- **Pinned pill CTA** — full-width rounded-full "Continue" button stuck to the bottom, grayed out until a selection is made
- **Value-prop interstitials** — mid-flow static screens with a chart/graphic to build trust without requiring input
- **"Thank you for trusting us"** — social warmth interstitial (high-five illustration)
- **Commitment ritual** — tap-and-hold button with circular progress ring → dark bg + confetti + "Committed 🤝"
- **Social proof** — ratings + avatar stack + testimonials before the paywall
- **Trial timeline** — vertical connector showing Today → In 2 Days (reminder) → In 3 Days (billing starts), always with "No Payment Due Now" checkmark

## What we adapted vs. copied

For Mise en Place (recipe/meal planner) we kept the UX structure but swapped:
- Sex / height / weight / birthday / trainer questions → household size / cook frequency / diet / cuisines / skill level
- Calorie goal questions → cooking goals (eat healthier, save time, save money, etc.)
- Paywall/trial → skipped (personal app, no billing)
- Weight-loss graphs → "home-cooked vs takeout" and "your cooking potential" graphs
