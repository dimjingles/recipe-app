'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Bookmark,
  Camera,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Heart,
  ImagePlus,
  Link2,
  Loader2,
  MessageCircle,
  PenLine,
  Search,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Shimmer } from '@/components/ui/shimmer'
import { useCacheInvalidation } from '@/lib/queries/hooks'
import { downscaleToDataUrl } from '@/lib/images/downscale'

type Platform = 'youtube' | 'tiktok' | 'instagram'
// 'ai' is the sheet's home: the dish-name box, with the other ways to add a
// recipe tucked behind "More options".
type View = 'ai' | 'platforms' | 'photo' | Platform
// The AI generator runs in two steps: name the dish, then pick the photo that
// looks right. The recipe is generated last, from the name + chosen image.
type AiStep = 'name' | 'image'

interface ImageResult {
  thumbnailUrl: string
  fullUrl: string
  sourceDomain: string
  title: string
}

const PLATFORMS: Array<{ key: Platform; label: string; appUrl: string; shareVerb: string }> = [
  { key: 'youtube', label: 'YouTube', appUrl: 'https://www.youtube.com', shareVerb: 'Share' },
  { key: 'tiktok', label: 'TikTok', appUrl: 'https://www.tiktok.com', shareVerb: 'Share' },
  { key: 'instagram', label: 'Instagram', appUrl: 'https://www.instagram.com', shareVerb: 'Send' },
]

// ── Brand icons (lucide has no TikTok / brand-colored marks) ─────────────────

function YouTubeIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1" y="4.5" width="22" height="15" rx="4" fill="#FF0000" />
      <path d="M10 8.75v6.5L15.8 12 10 8.75z" fill="white" />
    </svg>
  )
}

function TikTokIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="#010101" />
      <path
        d="M16.6 6.33a3.87 3.87 0 0 1-.9-2.53h-2.6v10.53a2.19 2.19 0 1 1-2.19-2.28c.23 0 .45.04.66.1V9.5a4.85 4.85 0 0 0-.66-.05 4.83 4.83 0 1 0 4.83 4.83V9.4a6.37 6.37 0 0 0 3.72 1.19V8a3.85 3.85 0 0 1-2.86-1.67z"
        fill="white"
      />
    </svg>
  )
}

function InstagramIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FD5949" />
          <stop offset="35%" stopColor="#D6249F" />
          <stop offset="100%" stopColor="#285AEB" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="url(#ig-grad)" />
      <rect x="6" y="6" width="12" height="12" rx="3.5" fill="none" stroke="white" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.7" fill="none" stroke="white" strokeWidth="1.6" />
      <circle cx="15.6" cy="8.4" r="0.9" fill="white" />
    </svg>
  )
}

const PLATFORM_ICON: Record<Platform, (props: { className?: string }) => ReactNode> = {
  youtube: YouTubeIcon,
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

/** The recipe a sheet just created, for callers that track it (search Recents). */
export interface CreatedRecipe {
  id: string
  name: string
  cuisine: string | null
  image_url: string | null
}

interface AddRecipeSheetProps {
  open: boolean
  onClose: () => void
  /** Skip the name box: open on "Pick a photo" for this dish, search already running. */
  initialName?: string
  /** Called with the saved recipe just before the sheet navigates to it. */
  onCreated?: (recipe: CreatedRecipe) => void
}

// `initialName` is read once, on mount — a caller that changes it between
// launches remounts the sheet (`key`) so it opens on the photo step without
// flashing the name box or popping its keyboard.
export function AddRecipeSheet({ open, onClose, initialName, onCreated }: AddRecipeSheetProps) {
  const router = useRouter()
  const invalidate = useCacheInvalidation()
  const startName = initialName?.trim() ?? ''
  const [view, setView] = useState<View>('ai')
  const [showMore, setShowMore] = useState(false)
  const [link, setLink] = useState('')
  const [navigating, setNavigating] = useState(false)
  const [aiName, setAiName] = useState(startName)
  const [generating, setGenerating] = useState(false)
  const [aiStep, setAiStep] = useState<AiStep>(startName ? 'image' : 'name')
  const [searchQuery, setSearchQuery] = useState(startName)
  const [searchResults, setSearchResults] = useState<ImageResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [searchPage, setSearchPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  // "Add from photo" uses two file inputs: the camera (capture) and the library.
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)

  const close = () => {
    onClose()
    // Reset after the sheet unmounts so the next open starts fresh.
    setView('ai')
    setShowMore(false)
    setLink('')
    setNavigating(false)
    setAiName('')
    setGenerating(false)
    setAiStep('name')
    setSearchQuery('')
    setSearchResults([])
    setIsSearching(false)
    setHasSearched(false)
    setSearchError('')
    setSearchPage(1)
    setHasMore(false)
    setIsLoadingMore(false)
  }

  const go = (href: string) => {
    setNavigating(true)
    router.push(href)
    close()
  }

  // Search real-world photos of the dish. The user picks the version they want
  // before we generate, so the recipe can be written to match that image.
  const runImageSearch = async (query: string) => {
    const q = query.trim()
    if (!q) return
    setIsSearching(true)
    setHasSearched(true)
    setSearchError('')
    setSearchPage(1)
    setHasMore(false)
    try {
      const res = await fetch(`/api/images/search?q=${encodeURIComponent(q)}&page=1`)
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

  // Opened on the photo step for a named dish: start that search right away.
  useEffect(() => {
    if (startName) runImageSearch(startName)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- mount-only

  // Step 1 → 2: move from the name input to the photo picker, seeding the search
  // with the dish name.
  const goToImageStep = () => {
    const name = aiName.trim()
    if (!name) return
    setSearchQuery(name)
    setAiStep('image')
    runImageSearch(name)
  }

  const viewMoreImages = async () => {
    if (isLoadingMore) return
    const nextPage = searchPage + 1
    setIsLoadingMore(true)
    try {
      const res = await fetch(`/api/images/search?q=${encodeURIComponent(searchQuery)}&page=${nextPage}`)
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

  // Generate the full recipe from the name + chosen photo, save it, attach the
  // image as the hero, and drop the user on the finished recipe page. Passing an
  // `image` lets the generator look at the exact version the user picked so the
  // ingredients and steps match it; `null` (skip) generates name-only.
  const generateWithAi = async (image: ImageResult | null) => {
    const name = aiName.trim()
    if (!name || generating) return
    setGenerating(true)
    try {
      const lookupRes = await fetch('/api/recipes/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send both URLs — the route inlines the photo for the model, and the
        // full image can 403 where the search thumbnail won't.
        body: JSON.stringify({
          name,
          imageUrl: image?.fullUrl,
          thumbnailUrl: image?.thumbnailUrl,
        }),
      })
      const details = await lookupRes.json()
      if (details.error) throw new Error(details.error)

      const saveRes = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: details.description || undefined,
          cuisine: details.cuisine || undefined,
          recipe_type: details.recipe_type || undefined,
          categories: details.categories || undefined,
          cook_time_minutes: details.cook_time_minutes || undefined,
          servings: details.servings || 4,
          calories: details.calories || undefined,
          instructions: details.instructions || undefined,
          difficulty: details.difficulty || undefined,
          ingredients: details.ingredients || [],
          tags: [],
          // The save re-hosts the picked photo into our storage and attaches it
          // as the hero (best-effort) in the same request.
          hero_image_url: image?.fullUrl,
        }),
      })
      const saved = await saveRes.json()
      if (saved.error) throw new Error(saved.error)

      // The lookup route falls back to a name-only recipe when it can't download
      // the picked photo. Say so rather than presenting a generic recipe under a
      // photo the user chose — the recipe still saves and the photo still becomes
      // the hero, they just know the two weren't matched.
      if (image && details.photo_used === false) {
        toast(`Couldn't read that photo — this is a standard ${name} recipe.`)
      }

      onCreated?.({ id: saved.id, name: saved.name ?? name, cuisine: saved.cuisine ?? null, image_url: saved.image_url ?? null })
      invalidate.recipesChanged()
      // Keep the loading overlay up and navigate — do NOT close the sheet here.
      // Closing would reveal the recipe library underneath for a beat before the
      // new recipe page mounts. Navigating unmounts this whole page instead, so
      // the spinner stays on screen right up until the recipe view takes over.
      // If the user skipped the photo step, `addPhoto=search` tells the recipe
      // page to open the picker so they can still add a hero image.
      router.push(`/recipes/${saved.id}${image ? '' : '?addPhoto=search'}`)
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Could not generate recipe. Try again.')
      setGenerating(false)
    }
  }

  // "Add from photo": generate a whole recipe from a photo the user took or
  // uploaded. The model identifies the dish and writes the recipe to match what
  // it sees; the same photo is then stored as the recipe's hero image.
  const generateFromPhoto = async (file: File) => {
    if (generating) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image')
      return
    }
    setGenerating(true)
    try {
      // Downscale in the browser so the base64 fits Anthropic's size limit.
      const dataUrl = await downscaleToDataUrl(file)

      const genRes = await fetch('/api/recipes/from-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      const details = await genRes.json()
      if (details.error) throw new Error(details.error)
      if (!details.name) throw new Error('Could not recognize a dish in that photo')

      const saveRes = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: details.name,
          description: details.description || undefined,
          cuisine: details.cuisine || undefined,
          recipe_type: details.recipe_type || undefined,
          categories: details.categories || undefined,
          cook_time_minutes: details.cook_time_minutes || undefined,
          servings: details.servings || 4,
          calories: details.calories || undefined,
          instructions: details.instructions || undefined,
          difficulty: details.difficulty || undefined,
          ingredients: details.ingredients || [],
          tags: [],
        }),
      })
      const saved = await saveRes.json()
      if (saved.error) throw new Error(saved.error)

      // Store the user's own photo as the recipe's hero. Upload the downscaled
      // JPEG (already safely under the size limit) and attach it to the gallery,
      // where the first photo becomes the hero automatically. Best-effort: a
      // failed attach still lands the user on their finished recipe.
      try {
        const blob = await (await fetch(dataUrl)).blob()
        const form = new FormData()
        form.append('image', blob, 'photo.jpg')
        const uploadRes = await fetch(`/api/recipes/${saved.id}/upload`, { method: 'POST', body: form })
        const uploadData = await uploadRes.json()
        if (uploadData.url) {
          await fetch(`/api/recipes/${saved.id}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: uploadData.url }),
          })
        }
      } catch {}

      onCreated?.({ id: saved.id, name: saved.name ?? details.name, cuisine: saved.cuisine ?? null, image_url: saved.image_url ?? null })
      invalidate.recipesChanged()
      // Keep the loading overlay up and navigate (see generateWithAi for why we
      // don't close the sheet here).
      router.push(`/recipes/${saved.id}`)
    } catch (e: unknown) {
      toast.error((e as Error).message || 'Could not generate a recipe from that photo. Try again.')
      setGenerating(false)
    }
  }

  const header = (title: string, back?: () => void) => (
    <div className="relative mb-5 flex h-9 items-center justify-center">
      <button
        onClick={back ?? close}
        className="absolute left-0 grid h-9 w-9 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
        aria-label={back ? 'Back' : 'Close'}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h3 className="font-heading text-lg font-bold text-foreground">{title}</h3>
    </div>
  )

  const iconCircle = (Icon: typeof Camera) => (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-subtle text-brand">
      <Icon className="h-5 w-5" />
    </span>
  )

  const platform = PLATFORMS.find(p => p.key === view)

  return (
    <BottomSheet open={open} onClose={close} maxHeight="90vh">
      <div className="px-5 pb-8 pt-1">
        {/* ── View: platform picker ── */}
        {view === 'platforms' && (
          <>
            {header('Import from social media', () => setView('ai'))}
            <div className="space-y-3">
              {PLATFORMS.map(({ key, label }) => {
                const Icon = PLATFORM_ICON[key]
                return (
                  <button
                    key={key}
                    onClick={() => setView(key)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-card transition-all hover:border-brand/40 active:scale-[0.98]"
                  >
                    <Icon className="h-7 w-7 shrink-0" />
                    <span className="flex-1 text-base font-semibold text-foreground">{label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* ── Home view: Add a recipe (generate from a dish name) ── */}
        {view === 'ai' && (
          <>
            {header(
              aiStep === 'image' && !generating ? 'Pick a photo' : 'Add a recipe',
              !generating && aiStep === 'image' && !startName ? () => setAiStep('name') : undefined,
            )}

            {generating ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-subtle text-brand">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </span>
                <div>
                  <p className="font-heading text-base font-bold text-foreground">
                    Cooking up your recipe…
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Writing ingredients and steps to match your “{aiName.trim()}”.
                  </p>
                </div>
              </div>
            ) : aiStep === 'name' ? (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  Enter a dish name — we&apos;ll find the recipe
                </p>
                <div className="flex gap-2">
                  <Input
                    value={aiName}
                    onChange={e => setAiName(e.target.value)}
                    placeholder="e.g. Spaghetti Carbonara"
                    className="flex-1"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') goToImageStep() }}
                  />
                  <Button
                    onClick={goToImageStep}
                    disabled={!aiName.trim()}
                    className="shrink-0 bg-brand text-brand-foreground hover:bg-brand/90"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {/* The other ways to add a recipe, kept quiet so the name box leads. */}
                <button
                  onClick={() => setShowMore(v => !v)}
                  aria-expanded={showMore}
                  className="mx-auto mt-6 flex items-center gap-1 text-sm text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                >
                  More options
                  <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                </button>

                {showMore && (
                  <div className="mt-4 space-y-3">
                    {[
                      {
                        // Brand marks fit the same 44px slot as the icon circles so labels line up.
                        icon: (
                          <span className="flex w-11 shrink-0 justify-center -space-x-2">
                            <InstagramIcon className="h-5 w-5 drop-shadow-sm" />
                            <TikTokIcon className="h-5 w-5 drop-shadow-sm" />
                            <YouTubeIcon className="h-5 w-5 drop-shadow-sm" />
                          </span>
                        ),
                        label: 'Import from social media',
                        detail: 'YouTube, TikTok or Instagram videos',
                        onClick: () => setView('platforms'),
                      },
                      {
                        icon: iconCircle(Camera),
                        label: 'Add from photo',
                        detail: "Snap or upload a dish — we'll write the recipe for it",
                        onClick: () => setView('photo'),
                      },
                      {
                        icon: iconCircle(Link2),
                        label: 'Import from web',
                        detail: 'Paste a link to any recipe site',
                        onClick: () => go('/import'),
                        navigates: true,
                      },
                      {
                        icon: iconCircle(PenLine),
                        label: 'Write from scratch',
                        detail: 'Type in your own recipe',
                        onClick: () => go('/recipes/new'),
                        navigates: true,
                      },
                    ].map(({ icon, label, detail, onClick, navigates }) => (
                      <button
                        key={label}
                        onClick={onClick}
                        disabled={navigates && navigating}
                        className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-all hover:border-brand/40 active:scale-[0.98]"
                      >
                        {icon}
                        <span className="flex-1">
                          <span className="block font-heading text-base font-bold text-foreground">
                            {label}
                          </span>
                          <span className="block text-sm text-muted-foreground">{detail}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  Pick the photo that looks like the version you want — we&apos;ll build
                  the recipe from it.
                </p>
                <div className="mb-4 flex gap-2">
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') runImageSearch(searchQuery) }}
                    placeholder="Search for images…"
                    className="flex-1"
                  />
                  <Button
                    onClick={() => runImageSearch(searchQuery)}
                    disabled={isSearching || !searchQuery.trim()}
                    className="shrink-0 bg-brand text-brand-foreground hover:bg-brand/90"
                  >
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                {isSearching && (
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <Shimmer key={i} className="aspect-square rounded-xl" />
                    ))}
                  </div>
                )}

                {searchError && (
                  <p className="py-2 text-center text-sm text-muted-foreground">{searchError}</p>
                )}

                {searchResults.length > 0 && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {searchResults.map(result => (
                        <button
                          key={result.fullUrl}
                          onClick={() => generateWithAi(result)}
                          className="relative aspect-square overflow-hidden rounded-xl border border-border transition-all active:scale-[0.97]"
                        >
                          <img
                            src={result.thumbnailUrl}
                            alt={result.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                    {hasMore && (
                      <Button
                        variant="outline"
                        onClick={viewMoreImages}
                        disabled={isLoadingMore}
                        className="mt-3 w-full"
                      >
                        {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : 'View more'}
                      </Button>
                    )}
                  </>
                )}

                {searchResults.length === 0 && !isSearching && hasSearched && !searchError && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No results. Try a different search.
                  </p>
                )}

                <button
                  onClick={() => generateWithAi(null)}
                  className="mt-5 w-full text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Skip and generate without a photo
                </button>
              </>
            )}
          </>
        )}

        {/* ── View: add from photo ── */}
        {view === 'photo' && (
          <>
            {header('Add from photo', generating ? undefined : () => setView('ai'))}

            {/* Hidden inputs: one opens the camera on mobile, one the library. */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) generateFromPhoto(f)
              }}
            />
            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) generateFromPhoto(f)
              }}
            />

            {generating ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-subtle text-brand">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </span>
                <div>
                  <p className="font-heading text-base font-bold text-foreground">
                    Cooking up your recipe…
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Looking at your photo to write the ingredients and steps.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-4 text-sm text-muted-foreground">
                  Take a photo of a dish or upload one from your library, and
                  we&apos;ll create a recipe to match it.
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-all hover:border-brand/40 active:scale-[0.98]"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-subtle text-brand">
                      <Camera className="h-5 w-5" />
                    </span>
                    <span className="font-heading text-base font-bold text-foreground">
                      Take a photo
                    </span>
                  </button>
                  <button
                    onClick={() => libraryInputRef.current?.click()}
                    className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-all hover:border-brand/40 active:scale-[0.98]"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-subtle text-brand">
                      <ImagePlus className="h-5 w-5" />
                    </span>
                    <span className="font-heading text-base font-bold text-foreground">
                      Upload a photo
                    </span>
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── View 3: platform instructions + paste link ── */}
        {platform && (
          <>
            {header(`Import from ${platform.label}`, () => setView('platforms'))}

            {/* Mock post illustrating where the share button lives */}
            <div className="mx-auto mb-4 w-56 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="grid h-32 place-items-center bg-gradient-to-br from-brand-subtle to-sage-subtle">
                <span className="text-5xl">🍝</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  <MessageCircle className="h-4 w-4" />
                  <span className="relative grid h-8 w-8 place-items-center">
                    <span className="absolute inset-0 animate-pulse rounded-full bg-brand/15 ring-2 ring-brand" />
                    <Send className="relative h-4 w-4 text-brand" />
                  </span>
                </div>
                <Bookmark className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <ol className="mb-5 space-y-2 text-sm text-muted-foreground">
              {[
                `Open ${platform.label} and find a recipe video`,
                <>Tap <strong className="text-foreground">{platform.shareVerb}</strong> on the video</>,
                <>Choose <strong className="text-foreground">PrepTable</strong> — or copy the link and paste it below</>,
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-subtle text-[11px] font-bold text-brand">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <div className="mb-3 flex gap-2">
              <Input
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder={`Paste a ${platform.label} link…`}
                className="flex-1"
                onKeyDown={e => {
                  if (e.key === 'Enter' && /https?:\/\//i.test(link)) {
                    go(`/import?url=${encodeURIComponent(link.trim())}`)
                  }
                }}
              />
              <Button
                onClick={() => go(`/import?url=${encodeURIComponent(link.trim())}`)}
                disabled={!/https?:\/\//i.test(link) || navigating}
                className="shrink-0 bg-brand text-brand-foreground hover:bg-brand/90"
              >
                {navigating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import'}
              </Button>
            </div>

            <a
              href={platform.appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" />
              Open {platform.label} to find a recipe
            </a>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

