import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { compressImage, AVATAR_MAX_EDGE } from '@/lib/images/compress'

// Uploads an avatar to the public `recipe-images` bucket under the user's own
// folder (matches the bucket's insert policy: first path segment = auth.uid()).
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 })

    // Store a resized WebP rather than the raw camera file.
    const compressed = await compressImage(await file.arrayBuffer(), file.type, AVATAR_MAX_EDGE)
    const ext = compressed?.ext ?? (file.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path = `${user.id}/avatar-${crypto.randomUUID()}.${ext}`

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
