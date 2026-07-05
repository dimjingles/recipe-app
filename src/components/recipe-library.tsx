'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RecipeWithIngredients } from '@/types/database'
import { Plus, Search, Clock, X, Globe, Link2, Loader2, PenLine, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import { RecipeCard } from '@/components/recipe-card'
import { EmptyState, RecipeBookIllustration } from '@/components/ui/empty-state'
import { Shimmer } from '@/components/ui/shimmer'

const RECIPE_TYPES = [
  { value: 'appetizer', label: 'Appetizer', emoji: '🥗' },
  { value: 'main', label: 'Main', emoji: '🍽️' },
  { value: 'dessert', label: 'Dessert', emoji: '🍰' },
  { value: 'drink', label: 'Drink', emoji: '🍹' },
]

interface OnlineResult {
  name: string
  cuisine: string
  cook_time_minutes: number
  description: string
}

export default function RecipeLibrary({ initialRecipes }: { initialRecipes: RecipeWithIngredients[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [onlineResults, setOnlineResults] = useState<OnlineResult[]>([])
  const [loadingOnline, setLoadingOnline] = useState(false)
  const [pendingSearch, setPendingSearch] = useState(false)
  const [addingRecipe, setAddingRecipe] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<'type' | 'cuisine' | null>(null)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (!search.trim()) {
      setOnlineResults([])
      setPendingSearch(false)
      return
    }
    setPendingSearch(true)
    searchDebounce.current = setTimeout(async () => {
      setPendingSearch(false)
      setLoadingOnline(true)
      try {
        const res = await fetch('/api/recipes/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: search }),
        })
        const data = await res.json()
        setOnlineResults(data.results || [])
      } catch {
        setOnlineResults([])
      } finally {
        setLoadingOnline(false)
      }
    }, 600)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [search])

  const addOnlineRecipe = async (result: OnlineResult) => {
    setAddingRecipe(result.name)
    try {
      const lookupRes = await fetch('/api/recipes/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: result.name }),
      })
      const details = await lookupRes.json()
      if (details.error) throw new Error(details.error)

      const saveRes = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: result.name,
          description: details.description || result.description,
          cuisine: details.cuisine || result.cuisine,
          cook_time_minutes: details.cook_time_minutes || result.cook_time_minutes,
          servings: details.servings || 4,
          ingredients: details.ingredients || [],
          tags: [],
        }),
      })
      const saved = await saveRes.json()
      if (saved.error) throw new Error(saved.error)

      toast.success(`${result.name} added to your library!`)
      router.push(`/recipes/${saved.id}`)
    } catch (e: any) {
      toast.error(e.message || 'Could not add recipe')
    } finally {
      setAddingRecipe(null)
    }
  }

  // Unique cuisines from the user's own recipes
  const cuisines = Array.from(
    new Set(initialRecipes.map(r => r.cuisine?.toLowerCase()).filter(Boolean) as string[])
  )

  const uniqueTags = Array.from(
    new Set(initialRecipes.flatMap(r => r.tags || []))
  ).sort()

  const filtered = initialRecipes.filter(r => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.cuisine?.toLowerCase().includes(search.toLowerCase()) ||
      r.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchesCuisine = !selectedCuisine || r.cuisine?.toLowerCase() === selectedCuisine
    const matchesType = !selectedType || r.recipe_type?.toLowerCase() === selectedType
    const matchesTag = !selectedTag || (r.tags || []).includes(selectedTag)
    return matchesSearch && matchesCuisine && matchesType && matchesTag
  })

  /* ── Chip style helpers ─────────────────────────────────────────── */
  // "All" chip: quiet neutral state (it means "no filter"). Selected filter: solid brand.
  const allChipClass = (isNullSelected: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.95] ${
      isNullSelected
        ? 'bg-muted text-muted-foreground border border-border'     // clear/none state — quiet
        : 'bg-card border border-border text-foreground hover:border-brand'
    }`

  const filterChipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.95] ${
      active
        ? 'bg-brand text-brand-foreground'
        : 'bg-card border border-border text-foreground hover:border-brand'
    }`

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading text-2xl font-bold text-foreground">Recipes</h1>
        <div className="relative">
          <button
            onClick={() => setAddMenuOpen(o => !o)}
            className="bg-brand text-brand-foreground rounded-full p-2.5 hover:bg-brand/90 active:scale-[0.95] transition-all shadow-md"
          >
            <Plus className="w-5 h-5" />
          </button>
          {addMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAddMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-20 bg-card rounded-2xl shadow-lg border border-border overflow-hidden w-44">
                <Link
                  href="/import"
                  onClick={() => setAddMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-brand-subtle hover:text-brand"
                >
                  <Link2 className="w-4 h-4 text-brand" /> Import recipe
                </Link>
                <div className="h-px bg-border" />
                <Link
                  href="/recipes/new"
                  onClick={() => setAddMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-brand-subtle hover:text-brand"
                >
                  <PenLine className="w-4 h-4 text-brand" /> Write recipe
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search recipes..."
          className="pl-9 bg-card"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Filter dropdowns */}
      <div className="flex gap-2 mb-4">
        {/* Type dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors active:scale-[0.95] ${
              selectedType
                ? 'bg-brand text-brand-foreground border-transparent'
                : 'bg-card border-border text-foreground hover:border-brand'
            }`}
          >
            {selectedType
              ? <>{RECIPE_TYPES.find(t => t.value === selectedType)?.emoji} {RECIPE_TYPES.find(t => t.value === selectedType)?.label}</>
              : 'Type'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openDropdown === 'type' ? 'rotate-180' : ''}`} />
          </button>
          {openDropdown === 'type' && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute left-0 top-full mt-1.5 z-20 bg-card rounded-2xl shadow-lg border border-border overflow-hidden min-w-[152px]">
                <button
                  onClick={() => { setSelectedType(null); setOpenDropdown(null) }}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${!selectedType ? 'text-brand bg-brand-subtle' : 'text-foreground hover:bg-muted'}`}
                >
                  All types
                </button>
                {RECIPE_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => { setSelectedType(t.value); setOpenDropdown(null) }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedType === t.value ? 'text-brand bg-brand-subtle font-medium' : 'text-foreground hover:bg-muted'}`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Cuisine dropdown */}
        {cuisines.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'cuisine' ? null : 'cuisine')}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors active:scale-[0.95] ${
                selectedCuisine
                  ? 'bg-brand text-brand-foreground border-transparent'
                  : 'bg-card border-border text-foreground hover:border-brand'
              }`}
            >
              {selectedCuisine
                ? <><span>{getCuisineEmoji(selectedCuisine)}</span> <span className="capitalize">{selectedCuisine}</span></>
                : 'Cuisine'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openDropdown === 'cuisine' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'cuisine' && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                <div className="absolute left-0 top-full mt-1.5 z-20 bg-card rounded-2xl shadow-lg border border-border overflow-hidden min-w-[160px]">
                  <button
                    onClick={() => { setSelectedCuisine(null); setOpenDropdown(null) }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${!selectedCuisine ? 'text-brand bg-brand-subtle' : 'text-foreground hover:bg-muted'}`}
                  >
                    All cuisines
                  </button>
                  {cuisines.map(cuisine => (
                    <button
                      key={cuisine}
                      onClick={() => { setSelectedCuisine(cuisine); setOpenDropdown(null) }}
                      className={`w-full text-left px-4 py-2.5 text-sm capitalize transition-colors ${selectedCuisine === cuisine ? 'text-brand bg-brand-subtle font-medium' : 'text-foreground hover:bg-muted'}`}
                    >
                      {getCuisineEmoji(cuisine)} {cuisine}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tag filter chips */}
      {uniqueTags.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground font-medium mb-1.5 uppercase tracking-wide">Tags</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
            <button
              onClick={() => setSelectedTag(null)}
              className={allChipClass(selectedTag === null)}
            >
              All
            </button>
            {uniqueTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`${filterChipClass(selectedTag === tag)} whitespace-nowrap`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}


      {/* Recipe list */}
      {filtered.length === 0 && !search ? (
        <EmptyState
          illustration={<RecipeBookIllustration />}
          title="No recipes yet"
          description="Add your first one to get started!"
          action={
            <Link
              href="/recipes/new"
              className="inline-flex items-center gap-2 bg-brand text-brand-foreground rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-brand/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add recipe
            </Link>
          }
        />
      ) : (() => {
        const ranked = filtered.filter(r => r.rank !== null && r.rank !== undefined)
        const bookmarked = filtered.filter(r => r.rank === null || r.rank === undefined)
        return (
          <div className="pb-24 space-y-6">
            {filtered.length > 0 && (
              <>
                {/* Ranked recipes — horizontal list with stagger */}
                {ranked.length > 0 && (
                  <div className="space-y-2">
                    {ranked.map((recipe, i) => (
                      <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        variant="list"
                        onClick={() => router.push(`/recipes/${recipe.id}`)}
                        className="animate-fade-in-up"
                        style={{ animationDelay: `${i * 40}ms` }}
                        action={
                          recipe.cook_time_minutes ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5 shrink-0">
                              <Clock className="w-3 h-3" /> {recipe.cook_time_minutes}m
                            </span>
                          ) : undefined
                        }
                      />
                    ))}
                  </div>
                )}

                {/* Bookmarked recipes — grid */}
                {bookmarked.length > 0 && (
                  <div>
                    {ranked.length > 0 && (
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bookmarked</span>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {bookmarked.map((recipe, i) => (
                        <RecipeCard
                          key={recipe.id}
                          recipe={recipe}
                          variant="grid"
                          onClick={() => router.push(`/recipes/${recipe.id}`)}
                          className="animate-fade-in-up"
                          style={{ animationDelay: `${(ranked.length + i) * 40}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Online search results */}
            {search && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Online
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {pendingSearch || loadingOnline ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-card rounded-2xl border border-border px-4 py-3 space-y-2">
                        <Shimmer className="h-4 w-3/4" />
                        <Shimmer className="h-3 w-full" />
                      </div>
                    ))}
                  </div>
                ) : onlineResults.length > 0 ? (
                  <div className="space-y-2">
                    {onlineResults.map((result, i) => {
                      const isAdding = addingRecipe === result.name
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 bg-card rounded-2xl border border-border shadow-sm px-4 py-3"
                        >
                          <span className="text-2xl shrink-0">{getCuisineEmoji(result.cuisine)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground text-sm truncate">{result.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {result.cuisine && (
                                <span className="text-xs text-muted-foreground capitalize">{result.cuisine}</span>
                              )}
                              {result.cook_time_minutes > 0 && (
                                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" /> {result.cook_time_minutes}m
                                </span>
                              )}
                            </div>
                            {result.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{result.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => addOnlineRecipe(result)}
                            disabled={!!addingRecipe}
                            className="shrink-0 bg-brand text-brand-foreground rounded-xl px-3 py-1.5 text-xs font-medium hover:bg-brand/90 active:scale-[0.95] transition-all disabled:opacity-50 flex items-center gap-1"
                          >
                            {isAdding ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                            {isAdding ? 'Adding...' : 'Add'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  !pendingSearch && !loadingOnline && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      No results found for &quot;{search}&quot;
                    </p>
                  )
                )}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
