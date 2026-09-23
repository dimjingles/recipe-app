import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { compressImage, PHOTO_MAX_EDGE } from '@/lib/images/compress'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Verify recipe belongs to user
    const { data: recipe } = await supabase
      .from('recipes')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (!recipe) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

    // Store a resized WebP rather than the raw camera file.
    const compressed = await compressImage(await file.arrayBuffer(), file.type, PHOTO_MAX_EDGE)
    const ext = compressed?.ext ?? (file.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('recipe-images')
      .upload(path, compressed?.data ?? file, {
        contentType: compressed?.contentType ?? file.type,
        upsert: false,
        cacheControl: '31536000', // paths are unique per upload, so cache for a year
      })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

    const { data: { publicUrl } } = supabase.storage.from('recipe-images').getPublicUrl(path)
    return NextResponse.json({ url: publicUrl })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
