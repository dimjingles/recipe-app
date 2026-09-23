// ── SSRF protection ───────────────────────────────────────────────────────────
// Block requests to private/loopback/link-local IP ranges and localhost.
// This uses hostname-string analysis, which guards against the most common
// attack vectors. A hostname that resolves to a private IP through DNS is not
// caught here — acceptable risk tradeoff for a recipe app.

export function isBlockedHost(hostname: string): boolean {
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

export function validateUrl(raw: string): URL {
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

/** True if `raw` is an http(s) URL whose host passes the SSRF check. */
export function isFetchableUrl(raw: string): boolean {
  try {
    validateUrl(raw)
    return true
  } catch {
    return false
  }
}

/**
 * Read a response body into memory, giving up (and returning null) as soon as
 * it exceeds `maxBytes`. `res.arrayBuffer()` would buffer an arbitrarily large
 * (or endless) body before we got a chance to check its size.
 */
export async function readBodyCapped(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(res.headers.get('content-length'))
  if (declared > maxBytes) {
    res.body?.cancel().catch(() => {})
    return null
  }
  const reader = res.body?.getReader()
  if (!reader) return null

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxBytes) {
      reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }

  const buf = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { buf.set(c, off); off += c.length }
  return buf
}
