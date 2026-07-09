# BUG-004: Image Search Returns 403 — Google CSE Access Not Provisioned

**File:** `src/app/api/images/search/route.ts`

**Severity:** Medium
**Status:** Resolved (2026-07-08) — Google CSE abandoned; image search now uses Serper.dev
(real Google Images) with Openverse as a keyless fallback. See Resolution.

## Resolution (2026-07-08)

**Google CSE was abandoned after exhausting every fix.** We confirmed, one by one, that the
setup was textbook-correct and it *still* returned 403:

- **API key** — ruled out. A fresh, correctly-scoped key (restricted to Custom Search API,
  no application restriction) created in the right project returned the identical error.
- **API enablement** — ruled out. Custom Search API showed as enabled in project
  `recipe-app-501404` and was receiving requests (4 requests / 100% errors in metrics).
- **Billing** — ruled out. The project's billing account was a paid, active account.
- Despite all of the above, `/customsearch/v1` kept returning **403
  `"This project does not have the access to Custom Search JSON API"`** — a *project-level*
  access error (no `details[]`, `reason: forbidden`), i.e. a Google provisioning quirk we
  cannot clear from our side.
- The `/customsearch/v1/siterestrict` endpoint this bug originally recommended is
  **legacy / allowlist-only** and will always 403 for a newly created engine — a dead end.

**New architecture** in `src/app/api/images/search/route.ts` (two providers, tried in order):

1. **Serper.dev (primary)** — `POST https://google.serper.dev/images`, real Google Images
   results. Requires `SERPER_API_KEY` in `.env.local`. Free tier ~2,500 queries. Returns
   professional food-site photography (delish, recipetineats, foodnetwork, epicurious, …).
2. **Openverse (fallback)** — `https://api.openverse.org/v1/images/`, free & **keyless**
   Creative-Commons / public-domain search. Runs when Serper is unconfigured, errors, or
   returns nothing — so search can never regress to "Image search is not configured".

- Both providers map to the unchanged `{ thumbnailUrl, fullUrl, sourceDomain, title }`
  shape, so `recipe-gallery.tsx` needed no changes. The route also returns a `provider`
  field (`"serper"` | `"openverse"`) for debugging.
- Graceful degradation preserved: if both providers fail, the route returns
  `{ results: [], error: 'Search unavailable' }`.
- The `GOOGLE_CSE_API_KEY` / `GOOGLE_CSE_ID` env vars are now unused (kept in `.env.local`,
  commented, in case Google CSE is ever revisited).

Everything below is retained for historical context.

---


## Description

The image search feature is fully wired up but non-functional. Searching for a recipe
image shows "Search unavailable" in the Add Photo dialog. The Google Custom Search
API returns a 403 with `"This project does not have the access to Custom Search JSON API"`.

## What the user sees

> Add Photo → Search tab → type query → press Search → "Search unavailable"

## Root Cause

Two compounding issues:

**1. "Search entire web" deprecated by Google.**
The Programmable Search Engine (PSE) was created expecting to toggle "Search the entire
web" on — but Google has deprecated this feature for new engines. Without it, the CSE
is site-restricted. The regular `/customsearch/v1` endpoint treats site-restricted engines
differently and the free-tier access model changes.

**2. New Google Cloud project not yet provisioned.**
The `recipe-app-501404` Google Cloud project was created on 2026-07-05 and billing was
added the same day. New projects with freshly-added billing can take up to 24 hours for
Google's backend to fully activate Custom Search API access. Until provisioning completes,
all API calls return 403 regardless of key or CSE configuration.

## Current state of the setup

- API key: `REDACTED_GOOGLE_CSE_API_KEY` (in `.env.local`)
- CSE ID: `REDACTED_GOOGLE_CSE_ID` (in `.env.local`)
- Custom Search API: enabled in `recipe-app-501404`
- Billing: active
- CSE sites: 50 top food/recipe sites added (see list below)
- "Search entire web": deprecated, cannot be enabled on new engines

## What needs to change when revisiting

### 1. Switch to the site-restricted endpoint

The API route currently calls `/customsearch/v1`. Since the CSE is site-restricted,
switch to `/customsearch/v1/siterestrict` — this endpoint is **free and unlimited**
(no 100/day quota cap) and is the correct endpoint for site-restricted engines.

In `src/app/api/images/search/route.ts`, change:

```ts
// Before
const url = new URL('https://www.googleapis.com/customsearch/v1')

// After
const url = new URL('https://www.googleapis.com/customsearch/v1/siterestrict')
```

### 2. Wait for provisioning, then retest

Once 24 hours have passed since project creation, run:

```bash
curl "https://www.googleapis.com/customsearch/v1/siterestrict?key=REDACTED_GOOGLE_CSE_API_KEY&cx=REDACTED_GOOGLE_CSE_ID&q=pasta&searchType=image&num=1"
```

If it returns results (not 403), the fix is live. Apply the endpoint change above and
the feature is complete.

## CSE sites configured (50 food/recipe sites)

```
www.bonappetit.com/*
www.epicurious.com/*
www.food52.com/*
www.foodandwine.com/*
www.seriouseats.com/*
cooking.nytimes.com/*
www.foodnetwork.com/*
www.allrecipes.com/*
www.tasteofhome.com/*
www.thespruceats.com/*
www.myrecipes.com/*
www.americastestkitchen.com/*
www.eatingwell.com/*
www.delish.com/*
www.tasty.co/*
www.halfbakedharvest.com/*
www.pinchofyum.com/*
www.minimalistbaker.com/*
www.smittenkitchen.com/*
www.cookieandkate.com/*
www.loveandlemons.com/*
www.101cookbooks.com/*
www.sallysbakingaddiction.com/*
www.thekitchn.com/*
www.simplyrecipes.com/*
www.recipetineats.com/*
www.natashaskitchen.com/*
www.skinnytaste.com/*
www.damndelicious.net/*
www.joythebaker.com/*
www.gimmesomeoven.com/*
www.onceuponachef.com/*
www.foodiecrush.com/*
www.greenkitchenstories.com/*
www.thefirstmess.com/*
www.bbcgoodfood.com/*
www.taste.com.au/*
www.tastingtable.com/*
www.thepioneerwoman.com/*
www.foodgawker.com/*
www.justonecookbook.com/*
www.kingarthurbaking.com/*
www.davidlebovitz.com/*
www.wholesomeyum.com/*
www.bojongourmet.com/*
www.adventuresincooking.com/*
www.drizzleanddip.com/*
www.budgetbytes.com/*
www.downshiftology.com/*
www.ambitiouskitchen.com/*
```

## Acceptance criteria

- [ ] `curl` test against `/customsearch/v1/siterestrict` returns image results (not 403)
- [ ] API route updated to use `/customsearch/v1/siterestrict` endpoint
- [ ] Searching for a recipe name in the Add Photo dialog returns image thumbnails
- [ ] Selecting an image sets it as the recipe photo
