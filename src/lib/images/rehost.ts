import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

// Images we've already stored live under this path in the `recipe-images`
// bucket's public URLs — those are stable and must not be re-hosted again.
const STORAGE_MARKER = '/storage/v1/object/public/recipe-images/'
const MAX_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 10_000

// Some hosts 403 non-browser fetches, so present as a normal browser.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

/** True if the URL already points at our own `recipe-images` storage bucket. */
export function isOwnStorageUrl(url: string): boolean {
  return url.includes(STORAGE_MARKER)
}

/**
 * Download a remote image and store it in the `recipe-images` bucket, returning
 * a stable public URL.
 *
 * Search picks and pasted URLs are third-party hotlinks that often 403 (hotlink
 * protection) or expire, so re-hosting them once means the recipe's hero and
 * gallery keep working. Returns null on any failure — the caller falls back to
 * the original URL, so this is strictly best-effort.
 */
export async function rehostImage(
  supabase: SupabaseServerClient,
  userId: string,
  remoteUrl: string,
): Promise<string | null> {
  if (!/^https?:\/\//i.test(remoteUrl)) return null
  if (isOwnStorageUrl(remoteUrl)) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(remoteUrl, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'image/*' },
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    })
    if (!res.ok) return null

    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    if (!contentType.startsWith('image/')) return null

    const buffer = new Uint8Array(await res.arrayBuffer())
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null

    const ext = EXT_BY_TYPE[contentType] ?? 'jpg'
    const path = `${userId}/${crypto.randomUUID()}.${ext}`

    const { error } = await supabase.storage
      .from('recipe-images')
      .upload(path, buffer, { contentType, upsert: false })
    if (error) return null

    const { data } = supabase.storage.from('recipe-images').getPublicUrl(path)
    return data.publicUrl || null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
