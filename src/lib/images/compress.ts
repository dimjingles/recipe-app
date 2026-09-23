import sharp from 'sharp'

/** Long edge for recipe photos: sharp on a phone's hero, a fraction of a raw camera file. */
export const PHOTO_MAX_EDGE = 1600
/** Avatars render at ≤ 128 CSS px; 256 covers 2x screens. */
export const AVATAR_MAX_EDGE = 256

export type CompressedImage = { data: Buffer; contentType: 'image/webp'; ext: 'webp' }

/**
 * Resize (never enlarge) and re-encode an uploaded or re-hosted image as WebP.
 * Phone photos arrive as 3–12 MB originals and were stored and served as-is —
 * to a 44px feed thumbnail as much as to the hero. Returns null for GIFs (keep
 * animation) or anything sharp can't decode, so the caller stores the original.
 */
export async function compressImage(
  input: Uint8Array | ArrayBuffer,
  contentType: string,
  maxEdge: number = PHOTO_MAX_EDGE,
): Promise<CompressedImage | null> {
  if (contentType === 'image/gif') return null
  try {
    const data = await sharp(input instanceof ArrayBuffer ? Buffer.from(input) : input, { failOn: 'none' })
      .rotate() // bake in EXIF orientation before the metadata is dropped
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
    return { data, contentType: 'image/webp', ext: 'webp' }
  } catch (error) {
    console.error('compressImage failed, storing original:', error)
    return null
  }
}
