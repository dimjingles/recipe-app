'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RecipeWithIngredients } from '@/types/database'
import { Plus, Search, Sparkles, Clock, X, Globe, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const CUISINE_EMOJI: Record<string, string> = {
  italian: '🍝', japanese: '🍜', chinese: '🥢', mexican: '🌮', indian: '🍛',
  thai: '🌶️', french: '🥐', american: '🍔', mediterranean: '🫒', korean: '🍱',
  vietnamese: '🍲', greek: '🥗', spanish: '🥘', middle_eastern: '🧆',
}

function getCuisineEmoji(cuisine: string | null) {
  if (!cuisine) return '🍽️'
  return CUISINE_EMOJI[cuisine.toLowerCase()] ?? '🍽️'
}

interface Recommendation {
  name: string
  cuisine: string
  description: string
  why: string
  cook_time_minutes: number
}

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
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [showRecs, setShowRecs] = useState(false)
  const [onlineResults, setOnlineResults] = useState<OnlineResult[]>([])
  const [loadingOnline, setLoadingOnline] = useState(false)
  const [pendingSearch, setPendingSearch] = useState(false)
  const [addingRecipe, setAddingRecipe] = useState<string | null>(null)
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

  // Unique cuisines from the user's own recipes, in order of first appearance
  const cuisines = Array.from(
    new Set(initialRecipes.map(r => r.cuisine?.toLowerCase()).filter(Boolean) as string[])
  )

  const filtered = initialRecipes.filter(r => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.cuisine?.toLowerCase().includes(search.toLowerCase()) ||
      r.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchesCuisine = !selectedCuisine || r.cuisine?.toLowerCase() === selectedCuisine
    return matchesSearch && matchesCuisine
  })

  const getRecommendations = async () => {
    setLoadingRecs(true)
    setShowRecs(true)
    try {
      const res = await fetch('/api/recipes/recommend', { method: 'POST' })
      const data = await res.json()
      if (data.recommendations) {
        setRecommendations(data.recommendations)
      }
    } catch {
      toast.error('Could not get recommendations')
      setShowRecs(false)
    } finally {
      setLoadingRecs(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
        <Link
          href="/recipes/new"
          className="bg-orange-500 text-white rounded-full p-2.5 hover:bg-orange-600 active:scale-95 transition-all shadow-md"
        >
          <Plus className="w-5 h-5" />
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search recipes..."
          className="pl-9 bg-white"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Cuisine filter chips */}
      {cuisines.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide -mx-4 px-4">
          <button
            onClick={() => setSelectedCuisine(null)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedCuisine === null
                ? 'bg-orange-500 text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-orange-300'
            }`}
          >
            All
          </button>
          {cuisines.map(cuisine => (
            <button
              key={cuisine}
              onClick={() => setSelectedCuisine(selectedCuisine === cuisine ? null : cuisine)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                selectedCuisine === cuisine
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-500 hover:border-orange-300'
              }`}
            >
              {getCuisineEmoji(cuisine)} {cuisine}
            </button>
          ))}
        </div>
      )}

      {/* AI Recommendations */}
      <div className="mb-5">
        {!showRecs ? (
          <button
            onClick={getRecommendations}
            className="flex items-center gap-2 text-sm text-orange-600 font-medium hover:text-orange-700"
          >
            <Sparkles className="w-4 h-4" />
            Get AI recipe ideas
          </button>
        ) : (
          <div className="bg-orange-50 rounded-2xl border border-orange-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-orange-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Recipe Ideas
              </h3>
              <button onClick={() => setShowRecs(false)} className="text-orange-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            {loadingRecs ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-xl p-3 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {recommendations.map((rec, i) => (
                  <div key={i} className="bg-white rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{getCuisineEmoji(rec.cuisine)} {rec.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{rec.why}</p>
                      </div>
                      <Link
                        href={`/recipes/new?name=${encodeURIComponent(rec.name)}`}
                        className="shrink-0 bg-orange-500 text-white rounded-lg px-2 py-1 text-xs font-medium hover:bg-orange-600"
                      >
                        Add
                      </Link>
                    </div>
                  </div>
                ))}
                <button
                  onClick={getRecommendations}
                  className="text-xs text-orange-600 font-medium hover:underline mt-1"
                >
                  Refresh ideas
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recipe Grid */}
      {filtered.length === 0 && !search ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🧑‍🍳</p>
          <p className="text-gray-500 mb-4">No recipes yet. Add your first one!</p>
          <Link
            href="/recipes/new"
            className="inline-flex items-center gap-2 bg-orange-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add recipe
          </Link>
        </div>
      ) : (() => {
        const ranked = filtered.filter(r => r.rank !== null && r.rank !== undefined)
        const bookmarked = filtered.filter(r => r.rank === null || r.rank === undefined)
        return (
          <div className="pb-24 space-y-6">
            {filtered.length > 0 && (
              <>
                {ranked.length > 0 && (
                  <div className="space-y-2">
                    {ranked.map(recipe => (
                      <Link
                        key={recipe.id}
                        href={`/recipes/${recipe.id}`}
                        className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 hover:shadow-md active:scale-[0.99] transition-all"
                      >
                        <span className="text-xs font-bold text-orange-500 bg-orange-50 rounded-full w-7 h-7 flex items-center justify-center shrink-0">
                          #{recipe.rank}
                        </span>
                        <span className="text-2xl shrink-0">{getCuisineEmoji(recipe.cuisine)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{recipe.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {recipe.cuisine && (
                              <span className="text-xs text-gray-400 capitalize">{recipe.cuisine}</span>
                            )}
                            {recipe.cook_time_minutes && (
                              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                <Clock className="w-3 h-3" /> {recipe.cook_time_minutes}m
                              </span>
                            )}
                            {recipe.cooked_count > 0 && (
                              <span className="text-xs text-gray-400">🍳 ×{recipe.cooked_count}</span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {bookmarked.length > 0 && (
                  <div>
                    {ranked.length > 0 && (
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-px flex-1 bg-gray-100" />
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Bookmarked</span>
                        <div className="h-px flex-1 bg-gray-100" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {bookmarked.map(recipe => (
                        <Link
                          key={recipe.id}
                          href={`/recipes/${recipe.id}`}
                          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md active:scale-[0.98] transition-all opacity-80"
                        >
                          <div className="text-3xl mb-2">{getCuisineEmoji(recipe.cuisine)}</div>
                          <p className="font-semibold text-gray-900 text-sm line-clamp-2 leading-tight">{recipe.name}</p>
                          {recipe.cuisine && (
                            <p className="text-xs text-gray-400 mt-1 capitalize">{recipe.cuisine}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {recipe.cook_time_minutes && (
                              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                <Clock className="w-3 h-3" /> {recipe.cook_time_minutes}m
                              </span>
                            )}
                          </div>
                          {recipe.tags && recipe.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {recipe.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="text-xs bg-gray-50 text-gray-400 rounded-full px-2 py-0.5">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Online Results */}
            {search && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Online
                  </span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>

                {pendingSearch || loadingOnline ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-white rounded-2xl border border-gray-100 px-4 py-3 animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-gray-100 rounded w-full" />
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
                          className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3"
                        >
                          <span className="text-2xl shrink-0">{getCuisineEmoji(result.cuisine)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{result.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {result.cuisine && (
                                <span className="text-xs text-gray-400 capitalize">{result.cuisine}</span>
                              )}
                              {result.cook_time_minutes > 0 && (
                                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" /> {result.cook_time_minutes}m
                                </span>
                              )}
                            </div>
                            {result.description && (
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{result.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => addOnlineRecipe(result)}
                            disabled={!!addingRecipe}
                            className="shrink-0 bg-orange-500 text-white rounded-xl px-3 py-1.5 text-xs font-medium hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1"
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
                    <p className="text-center text-sm text-gray-400 py-4">No results found for &quot;{search}&quot;</p>
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
