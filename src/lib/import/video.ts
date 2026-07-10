/**
 * Video / social recipe import: URL classification and per-platform context
 * fetching for YouTube, TikTok and Instagram.
 *
 * Design constraints:
 *  - No third-party scraping services and no login-required endpoints — only
 *    anonymous public surfaces (YouTube watch page + its caption tracks,
 *    TikTok's documented oEmbed endpoint, OpenGraph meta tags).
 *  - Every path degrades gracefully: callers catch VideoImportError and fall
 *    back to the paste-text flow, which stays first-class.
 *
 * NOTE: imports here are relative (not `@/`) so the module can be executed
 * directly with `node` for integration testing.
 */

// Explicit .ts extension so plain `node` can run this module for integration
// testing (see scripts/test-video-import.mts); bundler resolution allows it.
import { fetchPage, getMeta, decodeEntities } from './html.ts'

export type VideoPlatform = 'youtube' | 'tiktok' | 'instagram'

export const PLATFORM_LABEL: Record<VideoPlatform, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
}

/** Everything we could gather about a video/social post, pre-AI. */
export interface VideoContext {
  platform: VideoPlatform
  /** Canonical URL to keep as the recipe's source_url */
  url: string
  title?: string
  author?: string
  /** Video description or post caption */
  description?: string
  /** Spoken transcript from closed captions (YouTube) */
  transcript?: string
  /** Thumbnail to use as the recipe cover image */
  imageUrl?: string
}

/** Import failure carrying a user-facing hint for the paste-text fallback. */
export class VideoImportError extends Error {
  hint: string
  constructor(message: string, hint: string) {
    super(message)
    this.name = 'VideoImportError'
    this.hint = hint
  }
}

// ── URL classification ────────────────────────────────────────────────────────

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^(www|m)\./, '')
}

/** Detect whether a URL belongs to a supported video/social platform. */
export function classifyVideoUrl(url: URL): VideoPlatform | null {
  const host = normalizeHost(url.hostname)
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube'
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok'
  if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') return 'instagram'
  return null
}

// ── YouTube ───────────────────────────────────────────────────────────────────

const YT_ID = /^[A-Za-z0-9_-]{8,20}$/

/** Extract the video id from watch/shorts/embed/live/youtu.be URL forms. */
export function getYouTubeVideoId(url: URL): string | null {
  const host = normalizeHost(url.hostname)
  if (host === 'youtu.be') {
    const id = url.pathname.split('/')[1] ?? ''
    return YT_ID.test(id) ? id : null
  }
  const v = url.searchParams.get('v')
  if (v && YT_ID.test(v)) return v
  const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{8,20})/)
  return m ? m[1] : null
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

// Consent cookies avoid the EU cookie-wall interstitial that hides the player data.
const YT_HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9',
  'Cookie': 'CONSENT=YES+cb; SOCS=CAI',
}

interface YtCaptionTrack {
  baseUrl?: string
  languageCode?: string
  /** 'asr' = auto-generated speech recognition */
  kind?: string
}

interface YtPlayerResponse {
  videoDetails?: {
    title?: string
    author?: string
    shortDescription?: string
    thumbnail?: { thumbnails?: Array<{ url?: string; width?: number }> }
  }
  captions?: {
    playerCaptionsTracklistRenderer?: { captionTracks?: YtCaptionTrack[] }
  }
}

/**
 * Find `marker…{…}` in a script blob and parse the balanced JSON object that
 * follows. Handles string literals/escapes, so nested braces are safe.
 */
function extractJsonAfterMarker(html: string, markers: string[]): unknown {
  for (const marker of markers) {
    const idx = html.indexOf(marker)
    if (idx === -1) continue
    const start = html.indexOf('{', idx + marker.length - 1)
    if (start === -1) continue
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < html.length; i++) {
      const ch = html[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
      } else if (ch === '"') {
        inString = true
      } else if (ch === '{') {
        depth++
      } else if (ch === '}') {
        depth--
        if (depth === 0) {
          try { return JSON.parse(html.slice(start, i + 1)) } catch { break }
        }
      }
    }
  }
  return null
}

/** Prefer manual English captions, then auto English, then any manual, then any. */
function pickCaptionTrack(tracks: YtCaptionTrack[]): YtCaptionTrack | undefined {
  const withUrl = tracks.filter(t => t.baseUrl)
  const en = withUrl.filter(t => t.languageCode?.toLowerCase().startsWith('en'))
  return (
    en.find(t => t.kind !== 'asr') ??
    en[0] ??
    withUrl.find(t => t.kind !== 'asr') ??
    withUrl[0]
  )
}

/** Fetch a caption track and flatten it to plain text. */
async function fetchYouTubeTranscript(
  baseUrl: string,
  headers: Record<string, string>,
): Promise<string | undefined> {
  try {
    // Override (not append) fmt — InnerTube baseUrls already carry fmt=srv3.
    let captionUrl: string
    try {
      const u = new URL(baseUrl)
      u.searchParams.set('fmt', 'json3')
      captionUrl = u.href
    } catch {
      captionUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}fmt=json3`
    }
    const raw = await fetchPage(captionUrl, { maxBytes: 2_000_000, headers })

    // json3 format: { events: [{ segs: [{ utf8 }] }] }
    try {
      const data = JSON.parse(raw) as { events?: Array<{ segs?: Array<{ utf8?: string }> }> }
      if (Array.isArray(data.events)) {
        const text = data.events
          .flatMap(e => e.segs?.map(s => s.utf8 ?? '') ?? [])
          .join('')
          .replace(/\s+/g, ' ')
          .trim()
        return text || undefined
      }
    } catch { /* not JSON — fall through to XML */ }

    // Timedtext XML — legacy <text start…>…</text> or srv3 <p t…>…</p>
    const matches = [...raw.matchAll(/<(?:text|p)[^>]*>([\s\S]*?)<\/(?:text|p)>/g)]
    const text = matches
      .map(m => decodeEntities(m[1].replace(/<[^>]+>/g, ' ')))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    return text || undefined
  } catch {
    return undefined
  }
}

const ANDROID_UA = 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip'

/**
 * Fetch the player response through the InnerTube API (keyless) with the
 * ANDROID client. Its caption baseUrls are not gated behind the web player's
 * proof-of-origin token, which makes web-page caption URLs return empty 200s.
 */
async function fetchInnerTubePlayer(videoId: string): Promise<YtPlayerResponse | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      signal: controller.signal,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'User-Agent': ANDROID_UA },
      body: JSON.stringify({
        context: {
          client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, hl: 'en' },
        },
        videoId,
      }),
    })
    if (!res.ok) return null
    return await res.json() as YtPlayerResponse
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// YouTube serves this boilerplate as the page description when a video has none.
const YT_GENERIC_DESCRIPTION = /^enjoy the videos and music/i

async function fetchYouTubeContext(videoId: string): Promise<VideoContext> {
  const canonical = `https://www.youtube.com/watch?v=${videoId}`

  let html = ''
  try {
    html = await fetchPage(`${canonical}&hl=en`, { maxBytes: 3_000_000, headers: YT_HEADERS })
  } catch { /* fall through to InnerTube/oEmbed */ }

  const player = html
    ? (extractJsonAfterMarker(html, [
        'var ytInitialPlayerResponse = ',
        'ytInitialPlayerResponse = ',
      ]) as YtPlayerResponse | null)
    : null

  let innertube: YtPlayerResponse | null | undefined // undefined = not yet fetched
  const getInnertube = async () => {
    if (innertube === undefined) innertube = await fetchInnerTubePlayer(videoId)
    return innertube
  }

  // ── Transcript: web player captions first, then InnerTube ANDROID ──
  let transcript: string | undefined
  const webTracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  const webTrack = webTracks?.length ? pickCaptionTrack(webTracks) : undefined
  if (webTrack?.baseUrl) transcript = await fetchYouTubeTranscript(webTrack.baseUrl, YT_HEADERS)
  if (!transcript) {
    const itTracks = (await getInnertube())?.captions?.playerCaptionsTracklistRenderer?.captionTracks
    const itTrack = itTracks?.length ? pickCaptionTrack(itTracks) : undefined
    if (itTrack?.baseUrl) {
      transcript = await fetchYouTubeTranscript(itTrack.baseUrl, { 'User-Agent': ANDROID_UA })
    }
  }

  // ── Details: web player, filling gaps from InnerTube ──
  let details = player?.videoDetails
  if (!details?.title || !details?.shortDescription) {
    details = { ...(await getInnertube())?.videoDetails, ...pruneEmpty(details) }
  }

  let title = details?.title
  let author = details?.author
  let description = details?.shortDescription || undefined
  const thumbs = details?.thumbnail?.thumbnails
  const imageUrl = thumbs?.[thumbs.length - 1]?.url ?? youtubeThumbnailUrl(videoId)

  // ── Last-resort meta/oEmbed fallbacks ──
  if (!description && html) {
    const og = getMeta(html, 'og:description')
    if (og && !YT_GENERIC_DESCRIPTION.test(og)) description = og
  }
  if (!title) {
    try {
      const raw = await fetchPage(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`,
        { maxBytes: 100_000 },
      )
      const d = JSON.parse(raw) as { title?: string; author_name?: string }
      title = d.title ?? title
      author = author ?? d.author_name
    } catch { /* ignore */ }
  }

  if (!title && !description && !transcript) {
    throw new VideoImportError(
      `YouTube video ${videoId} unreadable`,
      "We couldn't read that YouTube video. Open its description, copy the recipe, and paste it below.",
    )
  }

  return { platform: 'youtube', url: canonical, title, author, description, transcript, imageUrl }
}

/** Drop empty-string/undefined fields so spreads don't clobber real values. */
function pruneEmpty<T extends object>(obj: T | undefined): Partial<T> {
  if (!obj) return {}
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ''),
  ) as Partial<T>
}

// ── TikTok ────────────────────────────────────────────────────────────────────

async function fetchTikTokContext(url: URL): Promise<VideoContext> {
  const target = url.href

  // 1) Documented public oEmbed endpoint — returns the caption as `title`.
  try {
    const raw = await fetchPage(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`,
      { maxBytes: 200_000 },
    )
    const d = JSON.parse(raw) as { title?: string; author_name?: string; thumbnail_url?: string }
    if (d.title || d.thumbnail_url) {
      return {
        platform: 'tiktok',
        url: target,
        author: d.author_name,
        description: d.title,
        imageUrl: d.thumbnail_url,
      }
    }
  } catch { /* fall through */ }

  // 2) OpenGraph tags on the video page (also resolves vm.tiktok.com short links).
  try {
    const html = await fetchPage(target, { maxBytes: 2_000_000 })
    const ogDesc = getMeta(html, 'og:description')
    const ogTitle = getMeta(html, 'og:title')
    const ogImage = getMeta(html, 'og:image')
    if (ogDesc || ogTitle) {
      return {
        platform: 'tiktok',
        url: target,
        title: ogTitle || undefined,
        description: ogDesc || undefined,
        imageUrl: ogImage || undefined,
      }
    }
  } catch { /* fall through */ }

  throw new VideoImportError(
    `TikTok post unreadable: ${target}`,
    "TikTok wouldn't share this video's details. In the TikTok app, copy the caption (tap the caption → Copy), then paste it below.",
  )
}

// ── Instagram ─────────────────────────────────────────────────────────────────

async function fetchInstagramContext(url: URL): Promise<VideoContext> {
  // Strip share-tracking params; keep just the post path.
  const clean = `${url.origin}${url.pathname}`

  try {
    const html = await fetchPage(clean, { maxBytes: 2_000_000 })
    const ogTitle = getMeta(html, 'og:title')
    const ogDesc = getMeta(html, 'og:description')
    const ogImage = getMeta(html, 'og:image')

    // A login wall serves generic tags ("Instagram") with no caption.
    const meaningful = (ogTitle + ogDesc).replace(/instagram/gi, '').trim().length >= 30
    if (meaningful) {
      return {
        platform: 'instagram',
        url: clean,
        title: ogTitle || undefined,
        description: ogDesc || undefined,
        imageUrl: ogImage || undefined,
      }
    }
  } catch { /* fall through */ }

  throw new VideoImportError(
    `Instagram post unreadable: ${clean}`,
    'Instagram doesn\'t let apps read captions directly. In the Instagram app, copy the caption (tap "…" on the post → Copy), then paste it below.',
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Gather title/caption/transcript/thumbnail for a supported video URL. */
export async function fetchVideoContext(platform: VideoPlatform, url: URL): Promise<VideoContext> {
  if (platform === 'youtube') {
    const id = getYouTubeVideoId(url)
    if (!id) {
      throw new VideoImportError(
        `Not a YouTube video URL: ${url.href}`,
        "That YouTube link doesn't point to a video. Paste the recipe text below instead.",
      )
    }
    return fetchYouTubeContext(id)
  }
  if (platform === 'tiktok') return fetchTikTokContext(url)
  return fetchInstagramContext(url)
}

/** Whether we gathered enough text for extraction to be worth attempting. */
export function hasRecipeText(ctx: VideoContext): boolean {
  const total =
    (ctx.title?.length ?? 0) + (ctx.description?.length ?? 0) + (ctx.transcript?.length ?? 0)
  return total >= 40
}

/** Flatten a VideoContext into the labeled text block given to the model. */
export function buildVideoContextText(ctx: VideoContext): string {
  const parts = [`Source: ${PLATFORM_LABEL[ctx.platform]} video/post`]
  if (ctx.title) parts.push(`Title: ${ctx.title.slice(0, 300)}`)
  if (ctx.author) parts.push(`Creator: ${ctx.author.slice(0, 100)}`)
  if (ctx.description) parts.push(`Description / caption:\n${ctx.description.slice(0, 5000)}`)
  if (ctx.transcript) parts.push(`Spoken transcript (from the video's captions):\n${ctx.transcript.slice(0, 14000)}`)
  return parts.join('\n\n')
}

/**
 * Extraction prompt for video/social content. Returns the same JSON shape as
 * the plain-text import prompt so the response stays ExtractedRecipe-compatible.
 */
export function videoExtractionPrompt(contextText: string): string {
  return `Extract a cooking recipe from this social/video post. Below are the post's metadata, caption/description, and possibly the spoken transcript from its captions. Return ONLY valid JSON (no markdown, no explanation).

${contextText}

Return this exact structure:
{
  "name": "recipe name",
  "description": "brief 1-2 sentence description",
  "cuisine": "cuisine type or null",
  "cook_time_minutes": 30,
  "servings": 4,
  "instructions": "full step-by-step instructions as a single string, one numbered step per line",
  "ingredients": [
    { "name": "ingredient name", "quantity": "amount", "unit": "unit of measure", "category": "produce|dairy|meat|seafood|pantry|spices|bakery|frozen|other" }
  ]
}

Rules:
- Prefer the written caption/description when it contains the full recipe; use the spoken transcript to fill gaps (quantities, times, technique details).
- The transcript is spoken language — rewrite it as clear, concise written steps and fix obvious speech-to-text errors in food terms.
- Only include ingredients that are actually mentioned. If a quantity isn't stated, use "" for quantity and unit.
- Use null for cook_time_minutes, servings, or cuisine if they are never stated or clearly implied.
- If the post contains no actual recipe (no ingredients AND no method), return: { "error": "no recipe found" }
- Category must be one of: produce, dairy, meat, seafood, pantry, spices, bakery, frozen, other.`
}
