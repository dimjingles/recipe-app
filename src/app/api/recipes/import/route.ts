import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'
import { anthropic, HAIKU, LONG_CALL } from '@/lib/anthropic'
import { fetchPage, getMeta, mainContent, stripTags } from '@/lib/import/html'
import { validateUrl } from '@/lib/net'
import { CATEGORY_PROMPT_GUIDE, RECIPE_CATEGORY_VALUES } from '@/lib/recipe-categories'
import { RECIPE_TYPE_VALUES } from '@/lib/ai/classify-recipe-type'
import {
  classifyVideoUrl,
  fetchVideoContext,
  hasRecipeText,
  buildVideoContextText,
  videoExtractionPrompt,
  getYouTubeVideoId,
  youtubeThumbnailUrl,
  VideoImportError,
  PLATFORM_LABEL,
  type VideoPlatform,
} from '@/lib/import/video'
import type { ExtractedRecipe, ExtractedIngredient } from '@/types/database'

// ── JSON-LD extraction ────────────────────────────────────────────────────────

// "@type" may be a string or an array ("Recipe" alongside e.g. "NewsArticle").
function isRecipeNode(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== 'object') return false
  const t = (node as Record<string, unknown>)['@type']
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))
}

function findJsonLdRecipe(html: string): Record<string, unknown> | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1]) as unknown
      const candidates = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of candidates) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, unknown>
        if (isRecipeNode(obj)) return obj
        if (Array.isArray(obj['@graph'])) {
          const r = (obj['@graph'] as unknown[]).find(isRecipeNode)
          if (r) return r
        }
      }
    } catch { /* skip invalid JSON blocks */ }
  }
  return null
}

function parseDurationToMinutes(iso: unknown): number | undefined {
  if (!iso || typeof iso !== 'string') return undefined
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso)
  if (!m) return undefined
  const total = parseInt(m[1] || '0') * 60 + parseInt(m[2] || '0')
  return total > 0 ? total : undefined
}

function parseServingsValue(val: unknown): number | undefined {
  if (typeof val === 'number') return val > 0 ? val : undefined
  if (!val) return undefined
  const m = /\d+/.exec(String(val))
  return m ? parseInt(m[0]) : undefined
}

/**
 * Pull per-serving calories out of a schema.org NutritionInformation block.
 * `calories` is loosely typed in the wild — "350 calories", "350 kcal", 350.
 */
function parseCaloriesValue(nutrition: unknown): number | undefined {
  if (!nutrition || typeof nutrition !== 'object') return undefined
  const raw = (nutrition as Record<string, unknown>).calories
  if (typeof raw === 'number') return raw > 0 ? Math.round(raw) : undefined
  if (typeof raw !== 'string') return undefined
  // Strip thousands separators first — "1,250 calories" must not read as 1.
  const m = /\d+/.exec(raw.replace(/(\d),(?=\d{3}\b)/g, '$1'))
  if (!m) return undefined
  const n = parseInt(m[0])
  return n > 0 ? n : undefined
}

function extractImageUrl(image: unknown): string | undefined {
  if (!image) return undefined
  if (typeof image === 'string') return image
  if (Array.isArray(image)) {
    const first = image[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object')
      return (first as Record<string, unknown>).url as string | undefined
  }
  if (typeof image === 'object')
    return (image as Record<string, unknown>).url as string | undefined
  return undefined
}

function parseInstructions(raw: unknown): string {
  if (!raw) return ''
  if (typeof raw === 'string') return raw
  if (!Array.isArray(raw)) return ''
  // HowToStep lists, possibly grouped into HowToSections ("For the sauce"),
  // flattened into one numbered list. Sections used to contribute only their
  // name, dropping every step inside them.
  const steps: string[] = []
  const walk = (items: unknown[]) => {
    for (const step of items) {
      if (typeof step === 'string') { if (step.trim()) steps.push(step.trim()); continue }
      if (!step || typeof step !== 'object') continue
      const s = step as Record<string, unknown>
      if (Array.isArray(s.itemListElement)) { walk(s.itemListElement); continue }
      const text = s.text || s.name
      if (typeof text === 'string' && text.trim()) steps.push(text.trim())
    }
  }
  walk(raw)
  return steps.map((t, i) => `${i + 1}. ${t}`).join('\n')
}

// ── Claude helpers ────────────────────────────────────────────────────────────

const INGREDIENT_CATEGORIES = ['produce', 'dairy', 'meat', 'seafood', 'pantry', 'spices', 'bakery', 'frozen', 'other']

const INGREDIENT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    quantity: { type: 'string' },
    unit: { type: 'string' },
    category: { type: 'string', enum: INGREDIENT_CATEGORIES },
  },
  required: ['name', 'quantity', 'unit', 'category'],
  additionalProperties: false,
} as const

async function categorizeIngredients(raw: string[]): Promise<ExtractedIngredient[]> {
  if (raw.length === 0) return []
  const fallback = () => raw.map(name => ({ name, quantity: '', unit: '', category: 'other' }))
  const msg = await anthropic.messages.create({
    model: HAIKU,
    // Long ingredient lists (35+) truncated at 1024 and fell back to "other".
    max_tokens: 2048,
    // Schema-constrained output: always valid JSON, no regex scraping.
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: { ingredients: { type: 'array', items: INGREDIENT_SCHEMA } },
          required: ['ingredients'],
          additionalProperties: false,
        },
      },
    },
    messages: [{
      role: 'user',
      content: `Parse these recipe ingredients into structured form, one entry per line below, in order. Use "" for a missing quantity or unit.

${raw.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
    }],
  }, LONG_CALL)

  const c = msg.content[0]
  if (msg.stop_reason !== 'end_turn' || c?.type !== 'text') return fallback()
  const { ingredients } = JSON.parse(c.text) as { ingredients: ExtractedIngredient[] }
  return ingredients.length ? ingredients : fallback()
}

// Shared by the text, HTML-fallback and video extractors. Unknown values come
// back as "" / 0 (mapped to undefined below) rather than nulls.
const RECIPE_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean', description: 'false when the input contains no actual recipe' },
    name: { type: 'string' },
    description: { type: 'string' },
    cuisine: { type: 'string' },
    recipe_type: { type: 'string', enum: [...RECIPE_TYPE_VALUES] },
    categories: { type: 'array', items: { type: 'string', enum: [...RECIPE_CATEGORY_VALUES] } },
    cook_time_minutes: { type: 'integer' },
    servings: { type: 'integer' },
    calories: { type: 'integer' },
    instructions: { type: 'string' },
    ingredients: { type: 'array', items: INGREDIENT_SCHEMA },
  },
  required: [
    'found', 'name', 'description', 'cuisine', 'recipe_type', 'categories',
    'cook_time_minutes', 'servings', 'calories', 'instructions', 'ingredients',
  ],
  additionalProperties: false,
} as const

const EXTRACTION_OUTPUT_NOTE = `

Output notes: set "found" to false if there is no actual recipe. Use "" for unknown text fields and 0 for unknown numbers. recipe_type is the course (appetizer, main, dessert, drink).
${CATEGORY_PROMPT_GUIDE}`

/**
 * Run a recipe-extraction prompt through Haiku with a schema-constrained reply
 * (a malformed free-form reply used to waste the call). Also returns course and
 * categories, so saving the recipe needs no separate classifier call.
 */
async function runRecipeExtraction(prompt: string, sourceUrl?: string): Promise<ExtractedRecipe> {
  const msg = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 4096,
    output_config: { format: { type: 'json_schema', schema: RECIPE_EXTRACTION_SCHEMA } },
    messages: [{ role: 'user', content: prompt + EXTRACTION_OUTPUT_NOTE }],
  }, LONG_CALL)

  const c = msg.content[0]
  if (msg.stop_reason !== 'end_turn' || c?.type !== 'text') throw new Error('Unexpected AI response')
  const d = JSON.parse(c.text) as {
    found: boolean; name: string; description: string; cuisine: string; recipe_type: string
    categories: string[]; cook_time_minutes: number; servings: number; calories: number
    instructions: string; ingredients: ExtractedIngredient[]
  }
  if (!d.found) throw new Error('no recipe found')
  return {
    name: d.name || 'Untitled Recipe',
    description: d.description || undefined,
    cuisine: d.cuisine || undefined,
    recipe_type: d.recipe_type || undefined,
    categories: d.categories,
    cook_time_minutes: d.cook_time_minutes || undefined,
    servings: d.servings || undefined,
    calories: d.calories || undefined,
    instructions: d.instructions || undefined,
    ingredients: d.ingredients,
    source_url: sourceUrl,
  }
}

function textExtractionPrompt(text: string): string {
  return `Extract a recipe from the following text. Return ONLY valid JSON (no markdown, no explanation).

${text.slice(0, 8000)}

Return this exact structure:
{
  "name": "recipe name",
  "description": "brief 1-2 sentence description",
  "cuisine": "cuisine type or null",
  "cook_time_minutes": 30,
  "servings": 4,
  "calories": 450,
  "instructions": "full step-by-step instructions as a single string",
  "ingredients": [
    { "name": "ingredient name", "quantity": "amount", "unit": "unit of measure", "category": "produce|dairy|meat|seafood|pantry|spices|bakery|frozen|other" }
  ]
}

If you cannot find a clear recipe in the text, return: { "error": "no recipe found" }
Category must be one of: produce, dairy, meat, seafood, pantry, spices, bakery, frozen, other.
calories is the per-serving calorie count — use the figure stated in the text if there is one, otherwise estimate it from the ingredients and quantities.`
}

async function extractFromText(text: string, sourceUrl?: string): Promise<ExtractedRecipe> {
  return runRecipeExtraction(textExtractionPrompt(text), sourceUrl)
}

// ── Gallery image extraction ──────────────────────────────────────────────────

function normalizeForDedup(url: string): string {
  try {
    const u = new URL(url)
    u.pathname = u.pathname.replace(/-\d+x\d+(\.[a-zA-Z]+)$/, '$1')
    return u.origin + u.pathname
  } catch { return url }
}

function extractGalleryImages(
  ld: Record<string, unknown> | null,
  coverUrl: string | undefined,
): string[] {
  const seenNorm = new Set<string>(coverUrl ? [normalizeForDedup(coverUrl)] : [])
  const result: string[] = []

  function tryAdd(raw: unknown) {
    if (!raw || typeof raw !== 'string') return
    const norm = normalizeForDedup(raw)
    if (seenNorm.has(norm)) return
    seenNorm.add(norm)
    result.push(raw)
  }

  if (ld) {
    // image array variants
    const imgs = Array.isArray(ld.image) ? ld.image : ld.image ? [ld.image] : []
    for (const img of imgs) {
      if (typeof img === 'string') tryAdd(img)
      else if (img && typeof img === 'object') tryAdd((img as Record<string, unknown>).url)
    }

    // step images
    if (Array.isArray(ld.recipeInstructions)) {
      for (const step of ld.recipeInstructions as unknown[]) {
        if (!step || typeof step !== 'object') continue
        const s = step as Record<string, unknown>
        if (s.image) {
          if (typeof s.image === 'string') tryAdd(s.image)
          else if (typeof s.image === 'object') tryAdd((s.image as Record<string, unknown>).url)
        }
      }
    }
  }

  return result.slice(0, 4)
}

// ── Video / social import ─────────────────────────────────────────────────────

function noRecipeHint(platform: VideoPlatform): string {
  const where =
    platform === 'youtube' ? "the video's description or captions" : "this post's caption"
  return `We read the ${PLATFORM_LABEL[platform]} post but couldn't find a full recipe in ${where}. Paste the recipe text (or the caption) below and we'll extract it from there.`
}

async function importFromVideo(platform: VideoPlatform, url: URL): Promise<NextResponse> {
  let contextText: string
  let sourceUrl: string
  let imageUrl: string | undefined

  try {
    const ctx = await fetchVideoContext(platform, url)
    if (!hasRecipeText(ctx)) {
      return NextResponse.json({ needsText: true, hint: noRecipeHint(platform) })
    }
    contextText = buildVideoContextText(ctx)
    sourceUrl = ctx.url
    imageUrl = ctx.imageUrl
  } catch (err: unknown) {
    console.error(`[import] ${platform} context fetch failed:`, (err as Error).message)
    const hint = err instanceof VideoImportError
      ? err.hint
      : `We couldn't load that ${PLATFORM_LABEL[platform]} link. Copy the caption or recipe text and paste it below.`
    return NextResponse.json({ needsText: true, hint })
  }

  try {
    const recipe = await runRecipeExtraction(videoExtractionPrompt(contextText), sourceUrl)
    if (imageUrl && !recipe.image_url) recipe.image_url = imageUrl
    return NextResponse.json({ ...recipe, gallery_images: [] })
  } catch (err: unknown) {
    console.error(`[import] ${platform} extraction failed:`, (err as Error).message)
    return NextResponse.json({ needsText: true, hint: noRecipeHint(platform) })
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    // Require auth — prevents this endpoint being used as an open HTTP proxy
  const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { url?: string; text?: string }
    const { url, text } = body

    // ── Path 1: plain text (captions, pasted recipe content) ──────────────────
    if (text?.trim()) {
      // A url sent alongside text is provenance only (the paste-text fallback
      // keeps the link the user originally tried) — it is never fetched.
      let sourceUrl: string | undefined
      let thumb: string | undefined
      if (url?.trim()) {
        try {
          const parsed = validateUrl(url.trim())
          sourceUrl = parsed.href
          const videoId = classifyVideoUrl(parsed) === 'youtube' ? getYouTubeVideoId(parsed) : null
          if (videoId) thumb = youtubeThumbnailUrl(videoId)
        } catch { /* ignore bad provenance URLs */ }
      }
      const recipe = await extractFromText(text.trim(), sourceUrl)
      if (thumb && !recipe.image_url) recipe.image_url = thumb
      return NextResponse.json(recipe)
    }

    // ── Path 2: URL ────────────────────────────────────────────────────────────
    if (!url?.trim()) {
      return NextResponse.json({ error: 'Provide a url or recipe text' }, { status: 400 })
    }

    let parsed: URL
    try {
      parsed = validateUrl(url.trim())
    } catch (e: unknown) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 })
    }

    // ── 2a: video/social platforms (YouTube, TikTok, Instagram) ───────────────
    const platform = classifyVideoUrl(parsed)
    if (platform) {
      return importFromVideo(platform, parsed)
    }

    // Fetch the page HTML
    let html: string
    try {
      html = await fetchPage(parsed.href)
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error('[import] fetchPage failed:', parsed.href, msg)
      return NextResponse.json({
        needsText: true,
        hint: "We couldn't load that page. Copy the recipe text and paste it below.",
        ...(process.env.NODE_ENV === 'development' && { _debug: msg }),
      })
    }

    // ── 2b: JSON-LD structured data (most recipe blogs) ───────────────────────
    const ld = findJsonLdRecipe(html)
    if (ld) {
      const rawIngredients = Array.isArray(ld.recipeIngredient)
        ? (ld.recipeIngredient as string[])
        : []
      let ingredients: ExtractedIngredient[]
      try {
        ingredients = await categorizeIngredients(rawIngredients)
      } catch (aiErr: unknown) {
        console.error('[import] categorizeIngredients failed, using raw:', (aiErr as Error).message)
        ingredients = rawIngredients.map(name => ({ name, quantity: '', unit: '', category: 'other' as const }))
      }
      const cookTime =
        parseDurationToMinutes(ld.cookTime) ??
        parseDurationToMinutes(ld.totalTime)

      const recipe: ExtractedRecipe = {
        name: (ld.name as string) || 'Untitled Recipe',
        description: ld.description as string | undefined,
        cuisine: Array.isArray(ld.recipeCuisine) ? (ld.recipeCuisine as string[])[0] : ld.recipeCuisine as string | undefined,
        cook_time_minutes: cookTime,
        servings: parseServingsValue(ld.recipeYield),
        calories: parseCaloriesValue(ld.nutrition),
        instructions: parseInstructions(ld.recipeInstructions),
        ingredients,
        image_url: extractImageUrl(ld.image),
        source_url: parsed.href,
      }
      const gallery = extractGalleryImages(ld, recipe.image_url)
      return NextResponse.json({ ...recipe, gallery_images: gallery })
    }

    // ── 2c: Claude fallback (non-JSON-LD sites) ────────────────────────────────
    const ogTitle = getMeta(html, 'og:title')
    const ogDesc = getMeta(html, 'og:description')
    const ogImage = getMeta(html, 'og:image')
    const bodyText = stripTags(mainContent(html)).slice(0, 6000)

    if (!bodyText && !ogTitle && !ogDesc) {
      return NextResponse.json({
        needsText: true,
        hint: "We couldn't read that page — it may require a login. Copy the recipe text and paste it below.",
      })
    }

    const contextText = [
      ogTitle ? `Title: ${ogTitle}` : '',
      ogDesc ? `Description: ${ogDesc}` : '',
      bodyText,
    ].filter(Boolean).join('\n\n')

    try {
      const recipe = await extractFromText(contextText, parsed.href)
      if (ogImage && !recipe.image_url) recipe.image_url = ogImage
      const gallery = extractGalleryImages(null, recipe.image_url)
      return NextResponse.json({ ...recipe, gallery_images: gallery })
    } catch {
      return NextResponse.json({
        needsText: true,
        hint: "No recipe was found at that URL. Copy the recipe text or caption and paste it below.",
      })
    }
  } catch (error: unknown) {
    console.error('Import recipe error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to import recipe' },
      { status: 500 },
    )
  }
}
