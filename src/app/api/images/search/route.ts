import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ImageResult = {
  thumbnailUrl: string
  fullUrl: string
  sourceDomain: string
  title: string
}

const CACHE_TTL_MS = 10 * 60 * 1000
const cache = new Map<string, { expiresAt: number; results: ImageResult[] }>()

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 100)
  if (!q) return NextResponse.json({ error: 'Missing search query' }, { status: 400 })

  const key = q.toLowerCase()
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return NextResponse.json({ results: cached.results })

  const apiKey = process.env.GOOGLE_CSE_API_KEY
  const cx = process.env.GOOGLE_CSE_ID
  if (!apiKey || !cx) {
    return NextResponse.json({ results: [], error: 'Image search is not configured' })
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('cx', cx)
    url.searchParams.set('q', q)
    url.searchParams.set('searchType', 'image')
    url.searchParams.set('num', '9')
    url.searchParams.set('safe', 'active')
    url.searchParams.set('imgType', 'photo')
    url.searchParams.set('imgSize', 'medium')

    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`Google CSE failed: ${res.status}`)
    const data = await res.json()
    const results: ImageResult[] = (data.items || []).map((item: any) => {
      const fullUrl = item.link || ''
      let sourceDomain = 'source'
      try { sourceDomain = new URL(item.image?.contextLink || fullUrl).hostname.replace(/^www\./, '') } catch {}
      return {
        thumbnailUrl: item.image?.thumbnailLink || fullUrl,
        fullUrl,
        sourceDomain,
        title: item.title || q,
      }
    }).filter((r: ImageResult) => r.fullUrl && r.thumbnailUrl)

    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, results })
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Image search error:', error)
    return NextResponse.json({ results: [], error: 'Search unavailable' })
  }
}
