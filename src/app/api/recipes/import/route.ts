import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, HAIKU } from '@/lib/anthropic'
import type { ExtractedRecipe, ExtractedIngredient } from '@/types/database'

// ── SSRF protection ───────────────────────────────────────────────────────────
// Block requests to private/loopback/link-local IP ranges and localhost.
// This uses hostname-string analysis, which guards against the most common
// attack vectors. A hostname that resolves to a private IP through DNS is not
// caught here — acceptable risk tradeoff for a recipe app.

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (ipv4) {
    const [a, b] = [parseInt(ipv4[1]), parseInt(ipv4[2])]
    if (a === 127) return true                         // loopback 127.0.0.0/8
    if (a === 10) return true                          // RFC 1918 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true   // RFC 1918 172.16.0.0/12
    if (a === 192 && b === 168) return true            // RFC 1918 192.168.0.0/16
    if (a === 169 && b === 254) return true            // link-local / AWS metadata
    if (a === 0) return true                           // this-network 0.0.0.0/8
  }

  if (h === '::1' || h === '[::1]') return true       // IPv6 loopback
  return false
}

function validateUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Invalid URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported')
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error('URL not allowed')
  }
  return url
}

// ── HTML fetch ────────────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 500 * 1024 // 500 KB

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        const remaining = MAX_BODY_BYTES - total
        if (value.length >= remaining) {
          chunks.push(value.slice(0, remaining))
          total += remaining
          reader.cancel()
          break
        }
        chunks.push(value)
        total += value.length
      }
    }

    const buf = new Uint8Array(total)
    let off = 0
    for (const c of chunks) { buf.set(c, off); off += c.length }
    return new TextDecoder('utf-8', { fatal: false }).decode(buf)
  } finally {
    clearTimeout(timer)
  }
}

// ── JSON-LD extraction ────────────────────────────────────────────────────────

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
        if (obj['@type'] === 'Recipe') return obj
        if (Array.isArray(obj['@graph'])) {
          const r = (obj['@graph'] as unknown[]).find(
            (g): g is Record<string, unknown> =>
              typeof g === 'object' && g !== null &&
              (g as Record<string, unknown>)['@type'] === 'Recipe',
          )
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
  if (Array.isArray(raw)) {
    return raw
      .map((step, i) => {
        if (typeof step === 'string') return `${i + 1}. ${step}`
        if (step && typeof step === 'object') {
          const s = step as Record<string, unknown>
          return `${i + 1}. ${s.text || s.name || ''}`
        }
        return ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

// ── Meta-tag helpers ──────────────────────────────────────────────────────────

function getMeta(html: string, prop: string): string {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // property/name can appear before or after content; handle single & double quotes
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"'<>]+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+(?:property|name)=["']${esc}["']`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m) return m[1].trim()
  }
  return ''
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Claude helpers ────────────────────────────────────────────────────────────

async function categorizeIngredients(raw: string[]): Promise<ExtractedIngredient[]> {
  if (raw.length === 0) return []
  const msg = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Parse these recipe ingredients into structured form. Return ONLY a valid JSON array (no markdown, no explanation):

${raw.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Use this exact structure:
[
  { "name": "ingredient name", "quantity": "amount or empty string", "unit": "unit or empty string", "category": "produce|dairy|meat|seafood|pantry|spices|bakery|frozen|other" }
]

Category must be one of: produce, dairy, meat, seafood, pantry, spices, bakery, frozen, other.`,
    }],
  })

  const c = msg.content[0]
  if (c.type !== 'text') return raw.map(name => ({ name, quantity: '', unit: '', category: 'other' }))
  const arrMatch = c.text.match(/\[[\s\S]*\]/)
  if (!arrMatch) return raw.map(name => ({ name, quantity: '', unit: '', category: 'other' }))
  try {
    return JSON.parse(arrMatch[0]) as ExtractedIngredient[]
  } catch {
    return raw.map(name => ({ name, quantity: '', unit: '', category: 'other' }))
  }
}

async function extractFromText(text: string, sourceUrl?: string): Promise<ExtractedRecipe> {
  const msg = await anthropic.messages.create({
    model: HAIKU,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Extract a recipe from the following text. Return ONLY valid JSON (no markdown, no explanation).

${text.slice(0, 8000)}

Return this exact structure:
{
  "name": "recipe name",
  "description": "brief 1-2 sentence description",
  "cuisine": "cuisine type or null",
  "cook_time_minutes": 30,
  "servings": 4,
  "instructions": "full step-by-step instructions as a single string",
  "ingredients": [
    { "name": "ingredient name", "quantity": "amount", "unit": "unit of measure", "category": "produce|dairy|meat|seafood|pantry|spices|bakery|frozen|other" }
  ]
}

If you cannot find a clear recipe in the text, return: { "error": "no recipe found" }
Category must be one of: produce, dairy, meat, seafood, pantry, spices, bakery, frozen, other.`,
    }],
  })

  const c = msg.content[0]
  if (c.type !== 'text') throw new Error('Unexpected AI response')
  const jsonMatch = c.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse AI response')
  const data = JSON.parse(jsonMatch[0]) as { error?: string } & Partial<ExtractedRecipe>
  if (data.error) throw new Error(data.error)
  return { ...data, ingredients: data.ingredients ?? [], name: data.name ?? 'Untitled Recipe', source_url: sourceUrl }
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

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Require auth — prevents this endpoint being used as an open HTTP proxy
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as { url?: string; text?: string }
    const { url, text } = body

    // ── Path 1: plain text (captions, pasted recipe content) ──────────────────
    if (text?.trim()) {
      const recipe = await extractFromText(text.trim())
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

    // Fetch the page HTML
    let html: string
    try {
      html = await fetchHtml(parsed.href)
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error('[import] fetchHtml failed:', parsed.href, msg)
      return NextResponse.json({
        needsText: true,
        hint: "We couldn't load that page. Copy the recipe text and paste it below.",
        ...(process.env.NODE_ENV === 'development' && { _debug: msg }),
      })
    }

    // ── 2a: JSON-LD structured data (most recipe blogs) ───────────────────────
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
        instructions: parseInstructions(ld.recipeInstructions),
        ingredients,
        image_url: extractImageUrl(ld.image),
        source_url: parsed.href,
      }
      const gallery = extractGalleryImages(ld, recipe.image_url)
      return NextResponse.json({ ...recipe, gallery_images: gallery })
    }

    // ── 2b: Claude fallback (YouTube, social media, non-JSON-LD sites) ─────────
    const ogTitle = getMeta(html, 'og:title')
    const ogDesc = getMeta(html, 'og:description')
    const ogImage = getMeta(html, 'og:image')
    const bodyText = stripTags(html).slice(0, 6000)

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
