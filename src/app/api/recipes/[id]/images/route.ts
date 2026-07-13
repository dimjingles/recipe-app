import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'

// POST body: { url: string } — append to gallery_images
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { url } = await request.json() as { url?: string }
  if (!url?.trim()) return NextResponse.json({ error: 'url required' }, { status: 400 })

  const { data: recipe } = await supabase
    .from('recipes')
    .select('gallery_images')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const current: string[] = recipe.gallery_images ?? []
  if (current.includes(url)) return NextResponse.json({ gallery_images: current })

  const updated = [...current, url]
  const { error } = await supabase
    .from('recipes')
    .update({ gallery_images: updated })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ gallery_images: updated })
}

// DELETE body: { url: string } — remove from gallery_images
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { url } = await request.json() as { url?: string }
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  const { data: recipe } = await supabase
    .from('recipes')
    .select('gallery_images')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = (recipe.gallery_images ?? []).filter((u: string) => u !== url)
  const { error } = await supabase
    .from('recipes')
    .update({ gallery_images: updated })
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ gallery_images: updated })
}
