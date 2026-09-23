import { NextResponse } from 'next/server'
import { getTechniques } from '@/lib/db/techniques'

// The technique catalogue — static reference data, public-read under RLS and
// identical for every user, so browsers may cache it.
export async function GET() {
  try {
    return NextResponse.json(await getTechniques(), {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
