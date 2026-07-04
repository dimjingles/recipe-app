'use client'

import { useState, useRef } from 'react'
import { Plus, X, Link2, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  recipeId: string
  initialImages: string[]
}

export default function RecipeGallery({ recipeId, initialImages }: Props) {
  const [images, setImages] = useState<string[]>(initialImages)
  const [showSheet, setShowSheet] = useState(false)
  const [tab, setTab] = useState<'url' | 'upload'>('url')
  const [urlInput, setUrlInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const addUrl = async (url: string) => {
    if (!url.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/recipes/${recipeId}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setImages(data.gallery_images)
      setUrlInput('')
      setShowSheet(false)
      toast.success('Photo added')
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Could not add photo')
    } finally {
      setAdding(false)
    }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const uploadRes = await fetch(`/api/recipes/${recipeId}/upload`, {
        method: 'POST',
        body: form,
      })
      const uploadData = await uploadRes.json()
      if (uploadData.error) throw new Error(uploadData.error)
      await addUrl(uploadData.url)
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const deleteImage = async (url: string) => {
    setDeleting(url)
    try {
      const res = await fetch(`/api/recipes/${recipeId}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setImages(data.gallery_images)
      toast.success('Photo removed')
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Could not remove photo')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900 text-lg">Photos</h2>
          <button
            onClick={() => setShowSheet(true)}
            className="flex items-center gap-1 text-sm text-orange-500 font-medium hover:text-orange-600"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {images.length === 0 ? (
          <button
            onClick={() => setShowSheet(true)}
            className="flex items-center gap-2 w-full justify-center border-2 border-dashed border-gray-200 rounded-2xl py-6 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-400 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add photos
          </button>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {images.map((url) => (
              <div key={url} className="relative shrink-0">
                <img
                  src={url}
                  alt=""
                  className="w-32 h-24 rounded-xl object-cover cursor-pointer"
                  onClick={() => setLightbox(url)}
                />
                <button
                  onClick={() => deleteImage(url)}
                  disabled={deleting === url}
                  className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                >
                  {deleting === url
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <X className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add photo sheet */}
      {showSheet && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={() => setShowSheet(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-10 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Add Photo</h3>
              <button onClick={() => setShowSheet(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
              <button
                onClick={() => setTab('url')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                <Link2 className="w-3.5 h-3.5" /> Paste URL
              </button>
              <button
                onClick={() => setTab('upload')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              >
                <Upload className="w-3.5 h-3.5" /> Upload
              </button>
            </div>

            {tab === 'url' ? (
              <div className="space-y-3">
                <input
                  type="url"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  onKeyDown={e => { if (e.key === 'Enter') addUrl(urlInput) }}
                  autoFocus
                />
                <button
                  onClick={() => addUrl(urlInput)}
                  disabled={!urlInput.trim() || adding}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : 'Add Photo'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-gray-200 hover:border-orange-300 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:text-orange-400 transition-colors disabled:opacity-50"
                >
                  {uploading
                    ? <><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm">Uploading…</span></>
                    : <><Upload className="w-6 h-6" /><span className="text-sm font-medium">Tap to choose a photo</span><span className="text-xs">JPG, PNG, WebP — max 10 MB</span></>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
