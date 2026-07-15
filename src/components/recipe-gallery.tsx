'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, X, Link2, Upload, Loader2, Search, Star } from 'lucide-react'
import { toast } from 'sonner'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { CameraIllustration } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Shimmer } from '@/components/ui/shimmer'

interface ImageResult {
  thumbnailUrl: string
  fullUrl: string
  sourceDomain: string
  title: string
}

interface Props {
  recipeId: string
  recipeName: string
  /** Gallery photos (controlled by the parent so the hero image can share state). */
  images: string[]
  onImagesChange: (images: string[]) => void
  /** The currently-selected display / hero image, if any. */
  heroUrl: string | null
  /** Promote a gallery photo to the display / hero image. */
  onSetHero: (url: string) => void
  readOnly?: boolean
}

export default function RecipeGallery({
  recipeId,
  recipeName,
  images,
  onImagesChange,
  heroUrl,
  onSetHero,
  readOnly = false,
}: Props) {
  const [showSheet, setShowSheet] = useState(false)
  const [tab, setTab] = useState<'url' | 'upload' | 'search'>('url')
  const [urlInput, setUrlInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState(recipeName)
  const [searchResults, setSearchResults] = useState<ImageResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchPage, setSearchPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
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
      onImagesChange(data.gallery_images)
      setUrlInput('')
      setShowSheet(false)
      toast.success('Photo added')
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Could not add photo')
    } finally {
      setAdding(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    setHasSearched(true)
    setSearchError('')
    setSearchPage(1)
    setHasMore(false)
    try {
      const res = await fetch(`/api/images/search?q=${encodeURIComponent(searchQuery)}&recipeId=${recipeId}&page=1`)
      const data = await res.json()
      setSearchResults(data.results || [])
      setHasMore(!!data.hasMore)
      if (data.error) setSearchError(data.error)
    } catch {
      setSearchResults([])
      setSearchError('Search unavailable')
    } finally {
      setIsSearching(false)
    }
  }

  // When the AI-generation flow lands here with `?addPhoto=search`, open the
  // photo picker on the Search tab and kick off a search (seeded from the
  // recipe name) so the new recipe can grab a hero image right away. Strip the
  // param afterwards so a refresh or back-navigation doesn't re-trigger it.
  useEffect(() => {
    if (readOnly) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('addPhoto') !== 'search') return
    setShowSheet(true)
    setTab('search')
    handleSearch()
    params.delete('addPhoto')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleViewMore = async () => {
    if (isLoadingMore) return
    const nextPage = searchPage + 1
    setIsLoadingMore(true)
    try {
      const res = await fetch(`/api/images/search?q=${encodeURIComponent(searchQuery)}&recipeId=${recipeId}&page=${nextPage}`)
      const data = await res.json()
      const more: ImageResult[] = data.results || []
      if (more.length) {
        setSearchResults(prev => {
          const seen = new Set(prev.map(r => r.fullUrl))
          return [...prev, ...more.filter(r => !seen.has(r.fullUrl))]
        })
        setSearchPage(nextPage)
      }
      setHasMore(!!data.hasMore)
    } catch {
      toast.error('Could not load more images')
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handlePickImage = async (result: ImageResult) => {
    await addUrl(result.fullUrl)
    setSearchResults([])
    setHasSearched(false)
    setSearchPage(1)
    setHasMore(false)
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const uploadRes = await fetch(`/api/recipes/${recipeId}/upload`, { method: 'POST', body: form })
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
      onImagesChange(data.gallery_images)
      toast.success('Photo removed')
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Could not remove photo')
    } finally {
      setDeleting(null)
    }
  }

  // Nothing to show for a read-only viewer with no photos.
  if (readOnly && images.length === 0) return null

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-bold text-foreground text-lg">Photos</h2>
          {!readOnly && (
            <button onClick={() => setShowSheet(true)} className="flex items-center gap-1 text-sm text-brand font-medium hover:text-brand/80 active:scale-[0.95] transition-all">
              <Plus className="w-4 h-4" /> Add
            </button>
          )}
        </div>

        {images.length === 0 ? (
          <button onClick={() => setShowSheet(true)} className="flex flex-col items-center gap-3 w-full justify-center border-2 border-dashed border-border rounded-2xl py-8 text-sm text-muted-foreground hover:border-brand hover:text-brand transition-colors active:scale-[0.99]">
            <CameraIllustration />
            <span>Add photos</span>
          </button>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {images.map((url) => {
              const isHero = url === heroUrl
              return (
                <div key={url} className="relative shrink-0">
                  <img
                    src={url}
                    alt=""
                    className={`w-32 h-24 rounded-xl object-cover cursor-pointer active:scale-[0.97] transition-all ${isHero ? 'ring-2 ring-brand ring-offset-2 ring-offset-background' : ''}`}
                    onClick={() => setLightbox(url)}
                  />
                  {isHero ? (
                    <span className="absolute bottom-1 left-1 bg-brand text-brand-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-current" /> Display
                    </span>
                  ) : !readOnly && (
                    <button
                      onClick={() => onSetHero(url)}
                      title="Set as display image"
                      className="absolute bottom-1 left-1 bg-black/50 hover:bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                    >
                      <Star className="w-3 h-3" />
                    </button>
                  )}
                  {!readOnly && (
                    <button onClick={() => deleteImage(url)} disabled={deleting === url} className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center transition-colors">
                      {deleting === url ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <BottomSheet open={showSheet} onClose={() => setShowSheet(false)} zIndex="elevated" maxHeight="85vh">
        <div className="px-6 pb-10">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-heading text-lg font-bold text-foreground">Add Photo</h3>
            <button onClick={() => setShowSheet(false)} className="text-muted-foreground hover:text-foreground active:scale-[0.95] transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-1 bg-muted rounded-xl p-1 mb-5">
            <button onClick={() => setTab('url')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'url' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              <Link2 className="w-3.5 h-3.5" /> URL
            </button>
            <button onClick={() => setTab('upload')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'upload' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              <Upload className="w-3.5 h-3.5" /> Upload
            </button>
            <button onClick={() => setTab('search')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'search' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              <Search className="w-3.5 h-3.5" /> Search
            </button>
          </div>

          {tab === 'url' && (
            <div className="space-y-3">
              <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://..." className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 bg-card" onKeyDown={e => { if (e.key === 'Enter') addUrl(urlInput) }} autoFocus />
              <button onClick={() => addUrl(urlInput)} disabled={!urlInput.trim() || adding} className="w-full bg-brand hover:bg-brand/90 disabled:opacity-50 text-brand-foreground rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : 'Add Photo'}
              </button>
            </div>
          )}

          {tab === 'upload' && (
            <div className="space-y-3">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full border-2 border-dashed border-border hover:border-brand rounded-xl py-8 flex flex-col items-center gap-2 text-muted-foreground hover:text-brand transition-colors disabled:opacity-50 active:scale-[0.99]">
                {uploading ? <><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm">Uploading…</span></> : <><Upload className="w-6 h-6" /><span className="text-sm font-medium">Tap to choose a photo</span><span className="text-xs">JPG, PNG, WebP - max 10 MB</span></>}
              </button>
            </div>
          )}

          {tab === 'search' && (
            <div>
              <div className="flex gap-2 mb-4">
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Search for images…" />
                <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </Button>
              </div>
              {isSearching && <div className="grid grid-cols-3 gap-2">{[1,2,3,4,5,6].map(i => <Shimmer key={i} className="aspect-square rounded-xl" />)}</div>}
              {searchError && <p className="text-sm text-muted-foreground text-center py-2">{searchError}</p>}
              {searchResults.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {searchResults.map(result => (
                      <button key={result.fullUrl} onClick={() => handlePickImage(result)} className="relative aspect-square rounded-xl overflow-hidden border border-border active:scale-[0.97] transition-all">
                        <img src={result.thumbnailUrl} alt={result.title} className="w-full h-full object-cover" loading="lazy" />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                          <span className="text-white text-[9px] truncate block">{result.sourceDomain}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {hasMore && (
                    <Button variant="outline" onClick={handleViewMore} disabled={isLoadingMore} className="w-full mt-3">
                      {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : 'View more'}
                    </Button>
                  )}
                </>
              )}
              {searchResults.length === 0 && !isSearching && hasSearched && !searchError && <p className="text-sm text-muted-foreground text-center py-6">No results. Try a different search.</p>}
            </div>
          )}
        </div>
      </BottomSheet>

      {lightbox && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white active:scale-[0.95] transition-all"><X className="w-6 h-6" /></button>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  )
}
