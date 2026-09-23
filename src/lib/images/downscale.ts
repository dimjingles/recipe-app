'use client'

// Phone photos are often 3–12 MB, but Anthropic's vision API rejects base64
// images over ~5 MB and gains nothing from resolution beyond ~1568px on the long
// edge. Downscaling in the browser before we send the photo to the AI keeps the
// request small and fast, and sidesteps opaque "image too large" AI errors.
const MAX_EDGE = 1568
const JPEG_QUALITY = 0.85

/**
 * Read an image File and return a downscaled JPEG data URL
 * (`data:image/jpeg;base64,…`) suitable for inlining to the model.
 *
 * Rejects if the file can't be decoded as an image.
 */
export async function downscaleToDataUrl(file: File): Promise<string> {
  const bitmapUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(bitmapUrl)
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
    const width = Math.max(1, Math.round(img.width * scale))
    const height = Math.max(1, Math.round(img.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not read the photo')
    ctx.drawImage(img, 0, 0, width, height)

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  } finally {
    URL.revokeObjectURL(bitmapUrl)
  }
}

/**
 * Downscale an image File for upload, returning a JPEG File no larger than
 * `maxEdge` on its long side. Phone photos (3–12 MB) would otherwise exceed the
 * serverless request-body limit (~4.5 MB on Vercel) and waste upload time; the
 * server re-encodes to WebP anyway. GIFs and undecodable files pass through.
 */
export async function downscaleForUpload(file: File, maxEdge = 1600): Promise<File> {
  if (file.type === 'image/gif') return file
  const bitmapUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(bitmapUrl)
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
    // Already small and compact: keep the original bytes.
    if (scale === 1 && file.size < 1024 * 1024) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(bitmapUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That file could not be read as an image'))
    img.src = src
  })
}
