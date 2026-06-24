'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RecipeWithIngredients } from '@/types/database'
import { Plus, Search, Sparkles, Clock, X } from 'lucide-react'
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

export default function RecipeLibrary({ initialRecipes }: { initialRecipes: RecipeWithIngredients[] }) {
  const [search, setSearch] = useState('')
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [showRecs, setShowRecs] = useState(false)

  const filtered = initialRecipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.cuisine?.toLowerCase().includes(search.toLowerCase()) ||
    r.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

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
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          {search ? (
            <>
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-gray-500">No recipes matching &quot;{search}&quot;</p>
            </>
          ) : (
            <>
              <p className="text-4xl mb-3">🧑‍🍳</p>
              <p className="text-gray-500 mb-4">No recipes yet. Add your first one!</p>
              <Link
                href="/recipes/new"
                className="inline-flex items-center gap-2 bg-orange-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Add recipe
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-4">
          {filtered.map(recipe => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md active:scale-[0.98] transition-all"
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
                {recipe.cooked_count > 0 && (
                  <span className="text-xs text-gray-400">🍳 ×{recipe.cooked_count}</span>
                )}
              </div>
              {recipe.tags && recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {recipe.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-xs bg-orange-50 text-orange-600 rounded-full px-2 py-0.5">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
