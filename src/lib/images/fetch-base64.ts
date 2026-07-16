// Anthropic rejects base64 images larger than ~5MB, and base64 inflates bytes
// by ~33%, so cap the raw download well under that. Oversized full images fall
// through to the smaller search thumbnail (see fetchFirstImageAsBase64).
const MAX_BYTES = 3.5 * 1024 * 1024
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
  if (!/^https?:\/\//i.test(url)) return null

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

    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null

    return { mediaType: contentType as AnthropicImageMediaType, base64: buffer.toString('base64') }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Try each URL in order, returning the first that downloads as a usable image. */
export async function fetchFirstImageAsBase64(
  ...urls: Array<string | undefined | null>
): Promise<FetchedImage | null> {
  for (const url of urls) {
    if (!url) continue
    const image = await fetchImageAsBase64(url)
    if (image) return image
  }
  return null
}
