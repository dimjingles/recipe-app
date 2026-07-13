import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase/server'

type ImageResult = {
  thumbnailUrl: string
  fullUrl: string
  sourceDomain: string
  title: string
}

const CACHE_TTL_MS = 10 * 60 * 1000
const PAGE_SIZE = 9
// One upstream call fetches a batch that's cached, so paging through results
// ("View more") is served from memory with no extra API calls or credits.
const FETCH_SIZE = 45

type CacheEntry = { expiresAt: number; results: ImageResult[]; provider: string }
const cache = new Map<string, CacheEntry>()

function hostnameOf(...urls: string[]): string {
  for (const u of urls) {
    try {
      const host = new URL(u).hostname.replace(/^www\./, '')
      if (host) return host
    } catch {}
  }
  return 'source'
}

// Provider: Serper.dev — real Google Images results (needs SERPER_API_KEY).
// Docs: https://serper.dev/playground (POST https://google.serper.dev/images)
async function searchSerper(q: string, apiKey: string, limit: number): Promise<ImageResult[]> {
  const res = await fetch('https://google.serper.dev/images', {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q, num: limit, gl: 'us', hl: 'en' }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Serper search failed: ${res.status}`)
  const data = await res.json()
  return (data.images || []).slice(0, limit).map((item: any) => {
    const fullUrl = item.imageUrl || ''
    return {
      thumbnailUrl: item.thumbnailUrl || fullUrl,
      fullUrl,
      sourceDomain: (item.domain || '').replace(/^www\./, '') || hostnameOf(item.link || '', fullUrl),
      title: item.title || q,
    }
  }).filter((r: ImageResult) => r.fullUrl && r.thumbnailUrl)
}

// Fetch one batch from Serper. Returns null if the key is missing or the call fails.
async function fetchBatch(q: string): Promise<CacheEntry | null> {
  const serperKey = process.env.SERPER_API_KEY
  if (!serperKey) {
    console.error('Image search error: SERPER_API_KEY is not set')
    return null
  }

  try {
    const results = await searchSerper(q, serperKey, FETCH_SIZE)
    return { expiresAt: Date.now() + CACHE_TTL_MS, results, provider: 'serper' }
  } catch (error) {
    console.error('Serper image search failed:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 100)
  if (!q) return NextResponse.json({ error: 'Missing search query' }, { status: 400 })

  const pageParam = parseInt(request.nextUrl.searchParams.get('page') || '1', 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.min(pageParam, 20) : 1

  // The whole batch is cached once per query; each page is a slice of it.
  const key = q.toLowerCase()
  let entry = cache.get(key)
  if (!entry || entry.expiresAt <= Date.now()) {
    const fresh = await fetchBatch(q)
    if (!fresh) return NextResponse.json({ results: [], hasMore: false, error: 'Search unavailable' })
    cache.set(key, fresh)
    entry = fresh
  }

  const start = (page - 1) * PAGE_SIZE
  const results = entry.results.slice(start, start + PAGE_SIZE)
  const hasMore = start + PAGE_SIZE < entry.results.length
  return NextResponse.json({ results, provider: entry.provider, page, hasMore })
}
