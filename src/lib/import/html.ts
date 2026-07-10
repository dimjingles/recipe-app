/**
 * Shared HTML-fetching and parsing helpers for the recipe import pipeline.
 *
 * NOTE: this module intentionally has no `@/` imports so it can be executed
 * directly with `node` (which doesn't resolve tsconfig path aliases) for
 * integration testing of the import pipeline.
 */

const DEFAULT_HEADERS: Record<string, string> = {
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
}

export interface FetchPageOptions {
  /** Stop reading the body after this many bytes. Default 500 KB. */
  maxBytes?: number
  /** Abort the request after this long. Default 15 s. */
  timeoutMs?: number
  /** Extra headers merged over the browser-like defaults. */
  headers?: Record<string, string>
}

/** Fetch a page as text with a size cap and timeout, sending browser-like headers. */
export async function fetchPage(url: string, opts: FetchPageOptions = {}): Promise<string> {
  const { maxBytes = 500 * 1024, timeoutMs = 15000, headers } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { ...DEFAULT_HEADERS, ...headers },
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
        const remaining = maxBytes - total
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

/** Decode the HTML entities that commonly appear in meta-tag content. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeFromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeFromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function safeFromCodePoint(code: number): string {
  try { return String.fromCodePoint(code) } catch { return '' }
}

/**
 * Read a `<meta property|name="…" content="…">` value (either attribute order,
 * either quote style). Returns the entity-decoded, trimmed content or ''.
 */
export function getMeta(html: string, prop: string): string {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]*?content="([^"]*)"`, 'i'),
    new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]*?content='([^']*)'`, 'i'),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]*?(?:property|name)=["']${esc}["']`, 'i'),
    new RegExp(`<meta[^>]+content='([^']*)'[^>]*?(?:property|name)=["']${esc}["']`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m) return decodeEntities(m[1]).trim()
  }
  return ''
}

/** Strip scripts, styles and tags, collapse whitespace, decode entities. */
export function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}
