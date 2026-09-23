import sharp from 'sharp'
import { isFetchableUrl, readBodyCapped } from '@/lib/net'

// Anthropic rejects base64 images larger than ~5MB, and base64 inflates bytes
// by ~33%, so anything over INLINE_MAX_BYTES is shrunk before inlining. Large
// originals used to be discarded in favour of the low-res search thumbnail.
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024
const INLINE_MAX_BYTES = 3.5 * 1024 * 1024
// Opus's native vision resolution — no detail is lost below this.
const VISION_MAX_EDGE = 2576
const FETCH_TIMEOUT_MS = 10_000

// Some hosts 403 non-browser fetches, so present as a normal browser.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

// Media types Anthropic's vision API accepts for base64 image blocks.
export type AnthropicImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
const ANTHROPIC_IMAGE_TYPES = new Set<string>(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export type FetchedImage = { mediaType: AnthropicImageMediaType; base64: string }

/**
 * Download a remote image and return it as base64 so it can be sent inline to
 * the model.
 *
 * Search-picked photos are third-party hotlinks that Anthropic's servers often
 * can't fetch (hotlink protection 403s, timeouts), which would leave the model
 * generating blind. Fetching the bytes ourselves — as a browser would — and
 * inlining them as base64 is far more reliable than handing the model a URL.
 * Returns null on any failure so the caller can fall back to name-only.
 */
export async function fetchImageAsBase64(url: string): Promise<FetchedImage | null> {
  if (!isFetchableUrl(url)) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'image/*' },
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    })
    if (!res.ok) return null

    let contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (contentType === 'image/jpg') contentType = 'image/jpeg'
    if (!ANTHROPIC_IMAGE_TYPES.has(contentType)) return null

    const bytes = await readBodyCapped(res, MAX_DOWNLOAD_BYTES)
    if (!bytes || bytes.byteLength === 0) return null

    if (bytes.byteLength > INLINE_MAX_BYTES) {
      const shrunk = await sharp(bytes, { failOn: 'none' })
        .rotate()
        .resize({ width: VISION_MAX_EDGE, height: VISION_MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
      if (shrunk.byteLength > INLINE_MAX_BYTES) return null
      return { mediaType: 'image/jpeg', base64: shrunk.toString('base64') }
    }

    return { mediaType: contentType as AnthropicImageMediaType, base64: Buffer.from(bytes).toString('base64') }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Return the first URL (in preference order) that downloads as a usable image.
 * All candidates download in parallel, so a failing full-size image doesn't make
 * the thumbnail wait out its timeout behind it.
 */
export async function fetchFirstImageAsBase64(
  ...urls: Array<string | undefined | null>
): Promise<FetchedImage | null> {
  const attempts = urls.filter((u): u is string => !!u).map(fetchImageAsBase64)
  for (const attempt of attempts) {
    const image = await attempt
    if (image) return image
  }
  return null
}
