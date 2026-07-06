# Mise en Place style guide

This guide translates the reference screenshots into a practical visual system for the recipe app. The target feel is: warm, premium, mobile-native, food-forward, and calm. Think OpenTable's content density and restaurant photography, combined with Cal AI's soft surfaces, oversized rounded cards, and friendly progress patterns.

## Design direction

### Product personality

- **Prepared, not precious:** clear structure and strong hierarchy, but never sterile.
- **Food-first:** photos and recipe names lead. Metadata supports the decision, not the other way around.
- **Soft utility:** daily planning, grocery lists, and cooking history should feel easy to come back to.
- **Tasteful energy:** use color for actions, progress, and status. Keep the base interface quiet.

### Inspiration split

| Source | Keep | Avoid |
| --- | --- | --- |
| OpenTable | Dense restaurant cards, bottom tabs, search/filter chips, strong red action states, list and card variants, photo-led discovery | Too many competing red CTAs on one screen, heavy marketplace feel |
| Cal AI | Soft gradient background, pill navigation, oversized rounded cards, progress rings, generous spacing, subtle shadows | Fitness-specific iconography, oversized metric UI where recipe context needs content |
| Yelp | Photo collections, simple profile/actions grid, clear list sections, social proof patterns | Harsh black/red contrast as the default app personality |

## Core visual principles

1. **One dominant action per screen**
   - Primary action uses the brand color.
   - Secondary actions use outline or subtle fills.
   - Avoid multiple filled buttons fighting for attention.

2. **Cards are the main surface**
   - Recipes, plans, grocery groups, cooking logs, and recommendations should all resolve to cards or card-like rows.
   - Use large radius and a very light border. Shadows should suggest lift, not decoration.

3. **Photos create warmth**
   - Use real food photos wherever possible.
   - If no photo exists, use a quiet illustrated or gradient placeholder rather than loud emoji blocks.

4. **Navigation should feel app-native**
   - Mobile bottom navigation stays persistent.
   - Active state should be clear through color, weight, and a soft selected background or dot.
   - Floating add button is appropriate, but should not overpower the bottom nav.

5. **Whitespace is part of the interface**
   - Top screens should breathe like Cal AI.
   - Content sections can become denser like OpenTable once the user is browsing lists.

## Color system

The existing app already has a warm orange brand. Keep that as the recipe app's owner-operated cooking identity, then add restrained support colors from the references.

### Primary palette

| Role | Token | Suggested value | Usage |
| --- | --- | --- | --- |
| Background | `--background` | `oklch(0.987 0.004 75)` | Main page background, warm cream |
| Surface | `--card` | `oklch(1 0 0)` | Cards, sheets, nav |
| Text primary | `--foreground` | `oklch(0.145 0 0)` | Headings, high-priority labels |
| Text secondary | `--muted-foreground` | `oklch(0.500 0 0)` | Metadata, descriptions, inactive labels |
| Border | `--border` | `oklch(0.920 0.004 75)` | Card borders, dividers, inputs |
| Brand | `--brand` | `oklch(0.702 0.183 46.6)` | Primary actions, active nav, progress highlights |
| Brand subtle | `--brand-subtle` | `oklch(0.967 0.030 68)` | Selected chips, empty states, highlighted panels |

### Accent palette

| Role | Suggested value | Usage |
| --- | --- | --- |
| Tomato red | `oklch(0.610 0.210 25)` | Urgent/destructive actions, missed plan warnings, high-signal badges only |
| Sage | `oklch(0.540 0.085 158)` | Ingredients, grocery, fresh/healthy cues |
| Amber | `oklch(0.750 0.120 72)` | Cooking history, streaks, warm success states |
| Blue-teal | `oklch(0.700 0.115 210)` | AI, profile, calm informational badges |
| Soft lavender | `oklch(0.965 0.018 300)` | Premium panels, empty states, gentle background gradients |

### Rules

- Use brand orange as the default CTA color, not OpenTable red.
- Use red sparingly for alerts, destructive actions, ratings, or marketplace-style emphasis.
- Use sage for groceries and ingredients so the app does not become all orange.
- Use amber for cooking activity, history, achievements, or recently cooked recipes.
- Keep page backgrounds warm and quiet. Avoid pure gray app backgrounds unless in disabled placeholders.

## Typography

The screenshots lean toward large, heavy, rounded sans-serif typography. The app can use the current sans stack, but the sizing and weight should become more deliberate.

### Type scale

| Style | Mobile class target | Usage |
| --- | --- | --- |
| Display | `text-4xl font-bold tracking-tight` | Home greeting, major screen title when spacious |
| H1 | `text-3xl font-bold tracking-tight` | Page titles like Recipes, Planner, Grocery |
| H2 | `text-2xl font-bold tracking-tight` | Section headers, card hero titles |
| H3 | `text-xl font-semibold` | Recipe names, card titles |
| Body large | `text-lg leading-snug` | Important descriptions, onboarding copy |
| Body | `text-base leading-relaxed` | Normal text |
| Body small | `text-sm leading-normal` | Metadata, helper copy |
| Caption | `text-xs font-medium` | Pills, labels, compact metadata |

### Weight rules

- Page titles: 700 to 800.
- Recipe titles: 650 to 700.
- Metadata: 400 to 500.
- Button labels: 600 to 700.
- Avoid all-caps except small navigation actions like `VIEW ALL` or `CREATE`, and use it sparingly.

## Layout and spacing

### Mobile page shell

Use this as the default mobile layout:

```tsx
<div className="max-w-lg mx-auto px-5 pt-8 pb-24">
  {/* page content */}
</div>
```

### Spacing scale

| Space | Use |
| --- | --- |
| `4px` | Icon/text micro gaps |
| `8px` | Tight row gaps, chip internals |
| `12px` | Card internal small gaps |
| `16px` | Default card padding for compact cards |
| `20px` | Default page horizontal padding |
| `24px` | Section gaps |
| `32px` | Major screen rhythm |
| `40px+` | Hero breathing room |

### Section rhythm

- Top header to first control: 16 to 24px.
- Header to first hero card: 32 to 40px when the screen is dashboard-like.
- Section title to carousel/list: 16px.
- Between cards in a list: 12 to 16px.
- Between major sections: 32 to 40px.

## Surfaces, radius, and shadows

### Radius scale

| Token | Use |
| --- | --- |
| `rounded-xl` | Buttons, chips, compact inputs |
| `rounded-2xl` | Recipe cards, list cards, image cards |
| `rounded-3xl` | Hero cards, bottom sheets, profile cards |
| `rounded-full` | Avatars, pills, floating actions, progress rings |

### Shadows

Use three levels only:

```css
--shadow-card: 0 4px 14px rgb(15 23 42 / 0.08);
--shadow-card-hover: 0 10px 24px rgb(15 23 42 / 0.12);
--shadow-float: 0 16px 36px rgb(15 23 42 / 0.18);
```

Rules:

- Cards get `border border-border shadow-sm` by default.
- Elevated cards like hero panels and floating nav get stronger shadows.
- Avoid thick borders plus heavy shadows together.

## Navigation

### Bottom navigation

Use a hybrid of OpenTable and Cal AI:

- Persistent bottom nav on mobile.
- White rounded pill container when visually appropriate.
- Active item gets:
  - brand text/icon color
  - soft circular or pill background
  - optional small dot for secondary confirmation
- Inactive items use muted gray.
- Center/floating add action remains a dark or brand circular button depending on screen context.

Recommended nav items:

1. Home
2. Recipes
3. Cookbooks or Skills
4. Planner
5. Grocery

If keeping the current center add button, make it visually intentional:

```tsx
<span className="h-14 w-14 rounded-full bg-foreground text-background shadow-float flex items-center justify-center">
  <Plus className="h-7 w-7" />
</span>
```

Use brand fill instead when the surrounding UI is dark or photo-heavy.

### Top navigation

- Large page title left aligned.
- Optional circular icon action on the right.
- Do not crowd the top bar. One or two actions maximum.

## Buttons and controls

### Primary button

Use for the main screen action.

```tsx
className="rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground shadow-sm active:scale-[0.97] transition-all"
```

### Dark primary button

Use for high-confidence actions in soft gradient or premium panels.

```tsx
className="rounded-full bg-foreground px-6 py-3 text-background font-bold shadow-sm active:scale-[0.97] transition-all"
```

### Outline button

Use for secondary actions like `View full list`, `Reserve`, `Join`, `Create cookbook`.

```tsx
className="rounded-xl border border-border bg-card px-5 py-3 font-semibold text-foreground active:scale-[0.98] transition-all"
```

### Pills and chips

Use for filters, dates, meal types, cuisine, and dietary tags.

```tsx
className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm"
```

Selected:

```tsx
className="rounded-full bg-brand-subtle px-4 py-2 text-sm font-semibold text-brand ring-1 ring-brand/25"
```

Disabled:

```tsx
className="rounded-full border border-border bg-muted/60 px-4 py-2 text-sm font-medium text-muted-foreground opacity-70"
```

## Cards and reusable components

### Recipe discovery card

Use for browse, recommendations, and search results. Borrow from OpenTable's card density with Cal AI's radius and softness.

Structure:

- Top image, 4:3 or square.
- Optional save/bookmark in the upper or lower right.
- Recipe title in bold.
- Metadata row: cuisine, cook time, rating, tags.
- CTA row if relevant: `Cook tonight`, `Add to plan`, `Add to grocery list`.

Class direction:

```tsx
<Link className="overflow-hidden rounded-3xl border border-border bg-card shadow-card active:scale-[0.98] transition-all">
  <div className="aspect-[4/3] bg-muted">
    {/* image */}
  </div>
  <div className="space-y-2 p-4">
    {/* content */}
  </div>
</Link>
```

### Compact recipe row

Use for grocery sources, planner slots, cooking history, ranked lists, and search bottom sheets.

Structure:

- 72 to 88px image thumbnail.
- Title and two metadata lines.
- Right-side action icon or status.
- Divider only between rows, not around every element.

### Hero dashboard card

Use for home dashboard summary: `Tonight`, `This week`, `Cooked recently`, or `Grocery ready`.

- Large rounded card.
- Strong metric or title on left.
- Illustration, image, or circular progress on right.
- One clear CTA.

### Progress ring card

Borrow from Cal AI for cooking progress, weekly plan completion, pantry usage, or skill growth.

Use for:

- `4 of 7 dinners planned`
- `12 recipes cooked this month`
- `Grocery list 68% checked`
- `Italian skill level`

Keep rings quiet: light gray track, brand/sage/amber progress.

### Collection card

Borrow from Yelp collections.

Use for cookbooks and saved recipe groups:

- Image collage or cover image.
- Large title.
- Short description or count.
- Small badge for recipe count.

### Settings list card

Borrow from Cal AI profile/settings screens.

- One rounded white card containing multiple rows.
- Icon left, label center, optional value/chevron right.
- Dividers inset after the icon column.
- Section labels in muted text above the card.

## Images and placeholders

### Food photography

- Prefer bright, natural food photos with warm tones.
- Use `object-cover` and consistent aspect ratios.
- Avoid stretching, letterboxing, or mixed crop logic inside one carousel.
- Use subtle dark gradients only when text sits on images.

### Placeholder strategy

Priority:

1. Recipe image uploaded by user.
2. AI or sourced image if available and safe to display.
3. Cuisine-colored soft gradient with small food icon.
4. Minimal line illustration.

Avoid giant emoji placeholders as the long-term style. They are useful during build, but make the product feel toy-like.

## Lists, tabs, and filters

### Tabs

Borrow from OpenTable ranked lists:

- Text tabs on a clean background.
- Active tab uses brand color and underline.
- Inactive tabs use foreground, not faint gray, so they remain tappable.

```tsx
className="border-b border-border"
```

Active indicator:

```tsx
className="border-b-2 border-brand text-brand font-semibold"
```

### Filters

- Horizontal scroll chips for category, cuisine, dietary needs, time, and skill level.
- Keep search prominent and full-width on recipe browse screens.
- Use icon + text chips sparingly. Too many icons become visual noise.

### Ranked lists

Use for:

- Most cooked recipes
- Fastest weeknight dinners
- Highest rated recipes
- Recipes to cook soon

Pattern:

- Small square thumbnail with rank overlay.
- Recipe details in the middle.
- Save or add action on the right.

## Feedback and states

### Loading

- Use shimmer skeletons with warm brand subtle highlight.
- Skeletons should match final card shapes.

### Empty states

- Use a soft card with a simple illustration.
- Keep copy direct.
- Always include the next action.

Example:

```txt
No recipes yet
Add your first recipe and Mise en Place will help fill in the details.
[Add recipe]
```

### Success

- Toasts can remain simple.
- For bigger wins, use soft green or amber panels.
- Avoid confetti unless it marks a real milestone.

### Error

- Use red only for actual errors or destructive states.
- Pair with plain action copy: `Try again`, `Remove`, `Cancel plan`.

## Motion

Use motion to confirm actions, not entertain.

- Tap: `active:scale-[0.97]` for cards, `active:scale-[0.95]` for buttons.
- Cards: fade in up by 8px.
- Sheets: slide from bottom with backdrop fade.
- Respect reduced motion, already present in `globals.css`.

## Screen-specific guidance

### Home

Use the Cal AI dashboard structure:

- Spacious greeting or app title.
- Two filter/date pills: current week and meal focus.
- One hero card for tonight or weekly planning.
- Horizontal carousel for recommended recipes.
- Section for recently cooked or recently added.

### Recipes

Use OpenTable search and discovery patterns:

- Full-width search bar near the top.
- Horizontal filter chips.
- Mix of horizontal carousels and compact lists.
- Recipe cards should be photo-led.

### Recipe detail

Use a premium food card feel:

- Large hero image.
- Floating actions: save, share, add to plan.
- Metadata chips below title.
- Ingredients and instructions in rounded cards.
- Sticky bottom action for `Cook this` or `Add to plan`.

### Planner

Use the calendar/date chip language from Cal AI:

- Week strip at top.
- Selected day gets a pill or tall rounded highlight.
- Meal slots are cards.
- Empty slot CTA should be obvious but not loud.

### Grocery list

Use the settings/list card pattern:

- Grouped cards by grocery category.
- Inset dividers.
- Checkable rows with large hit targets.
- Sticky share/export action.

### Cookbooks

Use Yelp collections:

- Featured cookbook carousel with collage cards.
- My cookbooks grid.
- Create card as a muted tile with plus icon.

### Profile/settings

Use Cal AI settings:

- Large profile card.
- Grouped list cards.
- Section labels in muted text.
- Keep destructive account actions separated at the bottom.

## Implementation notes for this repo

Current tokens in `src/app/globals.css` already match most of this direction. Recommended next changes:

1. **Add shadow utility classes** for `shadow-card`, `shadow-card-hover`, and `shadow-float`.
2. **Increase default mobile page padding** from `px-4` to `px-5` on top-level screens.
3. **Move primary card radius toward `rounded-3xl`** for hero and dashboard surfaces.
4. **Use photo-first cards** in recipe lists wherever `image_url` exists.
5. **Make bottom nav feel more intentional** with a pill container or stronger active background, not only a dot.
6. **Reduce emoji reliance** in placeholders over time.
7. **Add collection-style cookbook cards** using collage/image covers and recipe-count badges.

## Tailwind class recipes

### Page shell

```tsx
<div className="min-h-dvh bg-background pb-24">
  <main className="mx-auto max-w-lg px-5 pt-8">
    {children}
  </main>
</div>
```

### Section header

```tsx
<div className="mb-4 flex items-end justify-between gap-4">
  <h2 className="text-2xl font-bold tracking-tight text-foreground">Book for dinner tonight</h2>
  <Link className="text-sm font-bold uppercase tracking-wide text-brand">View all</Link>
</div>
```

### Soft card

```tsx
<div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
  {children}
</div>
```

### Photo card

```tsx
<article className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-all active:scale-[0.98]">
  <div className="aspect-[4/3] bg-muted">
    <img className="h-full w-full object-cover" />
  </div>
  <div className="space-y-2 p-4">
    {children}
  </div>
</article>
```

### Floating bottom nav shell

```tsx
<nav className="fixed inset-x-0 bottom-4 z-40 mx-auto max-w-lg px-5">
  <div className="rounded-full border border-border bg-card/95 p-2 shadow-float backdrop-blur">
    {children}
  </div>
</nav>
```

### Progress ring shell

```tsx
<div className="grid place-items-center rounded-full bg-muted p-3">
  <div className="grid h-24 w-24 place-items-center rounded-full bg-card ring-[12px] ring-border">
    <Icon className="h-6 w-6 text-brand" />
  </div>
</div>
```

## QA checklist for new UI

Before shipping a screen:

- Does the screen have one obvious next action?
- Are photos or food context doing enough of the emotional work?
- Are cards using consistent radius, spacing, and shadows?
- Is red reserved for alerts, ratings, or special emphasis?
- Does the bottom nav clearly show the active tab?
- Are empty and loading states shaped like the final content?
- Does it still work one-handed on mobile?
