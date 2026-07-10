'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { RecipeWithIngredients, CookbookWithCount, RecipeSortPreference, RecipeSortDirection } from '@/types/database'
import { Plus, Search, Clock, X, Globe, ChevronDown, BookOpen, Loader2, Sparkles, SlidersHorizontal, ArrowDown, ArrowUp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { toast } from 'sonner'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import { computeScores } from '@/lib/scoring'
import { RecipeCard } from '@/components/recipe-card'
import { AddRecipeSheet } from '@/components/add-recipe-sheet'
import { EmptyState, RecipeBookIllustration } from '@/components/ui/empty-state'
import { Shimmer } from '@/components/ui/shimmer'

const RECIPE_TYPES = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { value: 'lunch', label: 'Lunch', emoji: '🥪' },
  { value: 'dinner', label: 'Dinner', emoji: '🍲' },
  { value: 'appetizer', label: 'Appetizer', emoji: '🥗' },
  { value: 'main', label: 'Main', emoji: '🍽️' },
  { value: 'dessert', label: 'Dessert', emoji: '🍰' },
  { value: 'drink', label: 'Drink', emoji: '🍹' },
]

const SORT_OPTIONS = [
  { value: 'ranking', label: 'Ranking' },
  { value: 'recently_cooked', label: 'Most recently cooked' },
  { value: 'most_cooked', label: 'Most cooked' },
  { value: 'cook_time', label: 'Quickest to cook' },
] as const

const SORT_DIRECTIONS = [
  { value: 'default', label: 'Top to bottom', icon: ArrowDown },
  { value: 'reversed', label: 'Bottom to top', icon: ArrowUp },
] as const

function compareDateDesc(a: string | null, b: string | null) {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1

  const aTime = new Date(a).getTime()
  const bTime = new Date(b).getTime()
  if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0
  if (Number.isNaN(aTime)) return 1
  if (Number.isNaN(bTime)) return -1
  return bTime - aTime
}

function compareRank(a: number | null, b: number | null) {
  const aRank = a ?? Number.POSITIVE_INFINITY
  const bRank = b ?? Number.POSITIVE_INFINITY
  return aRank - bRank
}

// Ascending by cook time; recipes with no cook time sort last.
function compareCookTimeAsc(a: number | null, b: number | null) {
  const aTime = a ?? Number.POSITIVE_INFINITY
  const bTime = b ?? Number.POSITIVE_INFINITY
  return aTime - bTime
}

function compareRecipes(a: RecipeWithIngredients, b: RecipeWithIngredients, sort: RecipeSortPreference) {
  if (sort === 'ranking') {
    return compareRank(a.rank, b.rank)
      || compareDateDesc(a.last_cooked_at, b.last_cooked_at)
      || a.name.localeCompare(b.name)
  }

  if (sort === 'recently_cooked') {
    return compareDateDesc(a.last_cooked_at, b.last_cooked_at)
      || compareRank(a.rank, b.rank)
      || a.name.localeCompare(b.name)
  }

  if (sort === 'cook_time') {
    return compareCookTimeAsc(a.cook_time_minutes, b.cook_time_minutes)
      || compareRank(a.rank, b.rank)
      || a.name.localeCompare(b.name)
  }

  return (b.cooked_count ?? 0) - (a.cooked_count ?? 0)
    || compareRank(a.rank, b.rank)
    || a.name.localeCompare(b.name)
}

interface OnlineResult {
  name: string
  cuisine: string
  cook_time_minutes: number
  description: string
}

interface Recommendation {
  name: string
  cuisine: string
  cook_time_minutes: number
  description: string
  why: string
}

export default function RecipeLibrary({
  initialRecipes,
  initialCookbooks,
  hasHousehold = false,
  initialSortPreference = 'ranking',
  initialSortDirection = 'default',
}: {
  initialRecipes: RecipeWithIngredients[]
  initialCookbooks: CookbookWithCount[]
  hasHousehold?: boolean
  initialSortPreference?: RecipeSortPreference
  initialSortDirection?: RecipeSortDirection
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<'all' | 'personal' | 'household'>('all')
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedCookbook, setSelectedCookbook] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<'cooked' | 'bookmarked'>('cooked')
  const [sortPreference, setSortPreference] = useState<RecipeSortPreference>(initialSortPreference)
  const [sortDirection, setSortDirection] = useState<RecipeSortDirection>(initialSortDirection)
  const [cookbooks, setCookbooks] = useState<CookbookWithCount[]>(initialCookbooks)
  const [onlineResults, setOnlineResults] = useState<OnlineResult[]>([])
  const [loadingOnline, setLoadingOnline] = useState(false)
  const [pendingSearch, setPendingSearch] = useState(false)
  const [addingRecipe, setAddingRecipe] = useState<string | null>(null)
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [recommendationsError, setRecommendationsError] = useState('')
  const [openDropdown, setOpenDropdown] = useState<'type' | 'cuisine' | 'cookbook' | 'sort' | null>(null)

  // Create cookbook sheet
  const [showCreateCookbook, setShowCreateCookbook] = useState(false)
  const [showAddRecipe, setShowAddRecipe] = useState(false)
  const [newCookbookName, setNewCookbookName] = useState('')
  const [newCookbookRecipes, setNewCookbookRecipes] = useState<string[]>([])
  const [creatingCookbook, setCreatingCookbook] = useState(false)

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveSortSeq = useRef(0)

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

  const fetchRecommendations = async () => {
    setShowRecommendations(true)
    setRecommendationsLoading(true)
    setRecommendationsError('')
    try {
      const res = await fetch('/api/recipes/recommend', { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRecommendations(data.recommendations || [])
    } catch (e: any) {
      setRecommendations([])
      setRecommendationsError(e.message || 'Could not load recommendations')
    } finally {
      setRecommendationsLoading(false)
    }
  }

  const addRecommendation = (result: Recommendation) => {
    const params = new URLSearchParams()
    params.set('name', result.name)
    if (result.cuisine) params.set('cuisine', result.cuisine)
    if (result.description) params.set('description', result.description)
    if (result.cook_time_minutes) params.set('cook_time_minutes', String(result.cook_time_minutes))
    router.push(`/recipes/new?${params.toString()}`)
  }

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

  const handleSortChange = async (nextSort: RecipeSortPreference, nextDirection: RecipeSortDirection) => {
    setSortPreference(nextSort)
    setSortDirection(nextDirection)
    setOpenDropdown(null)
    const requestSeq = saveSortSeq.current + 1
    saveSortSeq.current = requestSeq

    try {
      const res = await fetch('/api/profile/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_sort_preference: nextSort, recipe_sort_direction: nextDirection }),
      })
      if (!res.ok) throw new Error('Could not save sort preference')
    } catch {
      if (saveSortSeq.current === requestSeq) {
        toast.error('Could not save sort preference')
      }
    }
  }

  const openCreateCookbook = () => {
    setOpenDropdown(null)
    setShowCreateCookbook(true)
  }

  const closeCreateCookbook = () => {
    setShowCreateCookbook(false)
    setNewCookbookName('')
    setNewCookbookRecipes([])
  }

  const toggleNewCookbookRecipe = (id: string) =>
    setNewCookbookRecipes(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])

  const createCookbook = async () => {
    if (!newCookbookName.trim()) return
    setCreatingCookbook(true)
    try {
      const res = await fetch('/api/cookbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCookbookName.trim(), recipe_ids: newCookbookRecipes }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const newCookbook: CookbookWithCount = {
        ...data,
        cookbook_recipes: newCookbookRecipes.map(id => ({ recipe_id: id })),
      }
      toast.success(`"${newCookbookName.trim()}" created!`)
      setCookbooks(prev => [...prev, newCookbook])
      setSelectedCookbook(data.id)
      closeCreateCookbook()
      router.refresh()
    } catch (e: any) {
      toast.error(e.message || 'Could not create cookbook')
    } finally {
      setCreatingCookbook(false)
    }
  }

  // Unique cuisines from the user's own recipes
  const cuisines = Array.from(
    new Set(initialRecipes.map(r => r.cuisine?.toLowerCase()).filter(Boolean) as string[])
  )

  const uniqueTags = Array.from(
    new Set(initialRecipes.flatMap(r => r.tags || []))
  ).sort()

  // Per-tier 0–10 scores, keyed by recipe id.
  const scores = computeScores(initialRecipes)

  const scopedRecipes = initialRecipes.filter(r => {
    const matchesCookbook = !selectedCookbook ||
      (r.cookbook_recipes || []).some(cr => cr.cookbook_id === selectedCookbook)
    const ownerScope = (r as { owner_scope?: string }).owner_scope ?? 'user'
    const matchesScope =
      scope === 'all' ||
      (scope === 'personal' ? ownerScope === 'user' : ownerScope === 'household')
    return matchesCookbook && matchesScope
  })
  const cookedCount = scopedRecipes.filter(r => r.cooked_count > 0).length
  const bookmarkedCount = scopedRecipes.filter(r => r.cooked_count === 0).length

  const filtered = scopedRecipes.filter(r => {
    const matchesCategory = selectedCategory === 'cooked' ? r.cooked_count > 0 : r.cooked_count === 0
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.cuisine?.toLowerCase().includes(search.toLowerCase()) ||
      r.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchesCuisine = !selectedCuisine || r.cuisine?.toLowerCase() === selectedCuisine
    const matchesType = !selectedType || r.recipe_type?.toLowerCase() === selectedType
    const matchesTag = !selectedTag || (r.tags || []).includes(selectedTag)
    return matchesCategory && matchesSearch && matchesCuisine && matchesType && matchesTag
  })

  const sortedRecipes = useMemo(
    () => {
      const ordered = [...filtered].sort((a, b) => compareRecipes(a, b, sortPreference))
      // 'reversed' flips the whole list bottom-to-top for the chosen sort option.
      return sortDirection === 'reversed' ? ordered.reverse() : ordered
    },
    [filtered, sortPreference, sortDirection]
  )

  /* ── Chip style helpers ─────────────────────────────────────────── */
  const allChipClass = (isNullSelected: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.95] ${
      isNullSelected
        ? 'bg-muted text-muted-foreground border border-border'
        : 'bg-card border border-border text-foreground hover:border-brand'
    }`

  const filterChipClass = (active: boolean) =>
    `shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors active:scale-[0.95] ${
      active
        ? 'bg-brand text-brand-foreground'
        : 'bg-card border border-border text-foreground hover:border-brand'
    }`

  const selectedCookbookName = cookbooks.find(c => c.id === selectedCookbook)?.name

  return (
    <div className="mx-auto max-w-6xl px-5 pt-4 md:px-8 md:pt-6">
      {/* Cookbook selector */}
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
        {cookbooks.length === 0 ? (
          <>
            <button
              onClick={() => setOpenDropdown(openDropdown === 'cookbook' ? null : 'cookbook')}
              className="group flex items-center gap-2 text-left text-2xl font-extrabold tracking-tight text-foreground transition-colors hover:text-brand active:scale-[0.99]"
            >
              Cookbooks
              <ChevronDown className={`h-6 w-6 shrink-0 text-muted-foreground transition-all duration-150 group-hover:text-brand ${openDropdown === 'cookbook' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'cookbook' && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                <div className="absolute left-0 top-full z-20 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  <button
                    onClick={openCreateCookbook}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-brand transition-colors hover:bg-brand-subtle"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" /> Add Cookbooks
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setOpenDropdown(openDropdown === 'cookbook' ? null : 'cookbook')}
              className="group flex max-w-full items-center gap-2 text-left text-2xl font-extrabold tracking-tight text-foreground transition-colors hover:text-brand active:scale-[0.99]"
            >
              <span className="truncate">{selectedCookbook ? selectedCookbookName : 'Cookbooks'}</span>
              <ChevronDown className={`h-6 w-6 shrink-0 text-muted-foreground transition-all duration-150 group-hover:text-brand ${openDropdown === 'cookbook' ? 'rotate-180' : ''}`} />
            </button>
            {openDropdown === 'cookbook' && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                <div className="absolute left-0 top-full z-20 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  <button
                    onClick={() => { setSelectedCookbook(null); setOpenDropdown(null) }}
                    className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors ${!selectedCookbook ? 'bg-brand-subtle text-brand' : 'text-foreground hover:bg-muted'}`}
                  >
                    All cookbooks
                  </button>
                  {cookbooks.map(cb => (
                    <button
                      key={cb.id}
                      onClick={() => { setSelectedCookbook(cb.id); setOpenDropdown(null) }}
                      className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors ${selectedCookbook === cb.id ? 'bg-brand-subtle font-medium text-brand' : 'text-foreground hover:bg-muted'}`}
                    >
                      <span className="flex-1 truncate">{cb.name}</span>
                      <span className="text-xs text-muted-foreground">({cb.cookbook_recipes.length})</span>
                    </button>
                  ))}
                  <div className="h-px bg-border" />
                  <button
                    onClick={openCreateCookbook}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-brand transition-colors hover:bg-brand-subtle"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" /> Add Cookbook
                  </button>
                  <button
                    onClick={() => { setOpenDropdown(null); router.push('/cookbooks') }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <BookOpen className="h-3.5 w-3.5 shrink-0" /> View cookbooks
                  </button>
                </div>
              </>
            )}
          </>
        )}
        </div>
        <Button onClick={fetchRecommendations} variant="outline" className="h-8 shrink-0 rounded-full border-brand/30 px-3 text-xs text-brand hover:bg-brand-subtle">
          <Sparkles className="mr-1 h-3.5 w-3.5" /> Suggest
        </Button>
      </div>

      {/* Category tabs */}
      <div className="mb-5 flex gap-8 border-b border-border/70">
        {([
          { key: 'cooked', label: 'Cooked', count: cookedCount },
          { key: 'bookmarked', label: 'Want to try', count: bookmarkedCount },
        ] as const).map(category => {
          const active = selectedCategory === category.key
          return (
            <button
              key={category.key}
              onClick={() => setSelectedCategory(category.key)}
              className={`relative -mb-px pb-3 text-lg font-bold transition-colors ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {category.label}
              <span className="ml-1.5 text-sm font-semibold text-muted-foreground">{category.count}</span>
              {active && <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-brand" />}
            </button>
          )
        })}
      </div>

      {/* Personal | Household | All scope */}
      {hasHousehold && (
        <div className="mb-4 flex gap-1 rounded-2xl bg-muted p-1">
          {([['all', 'All'], ['personal', 'Personal'], ['household', 'Household']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setScope(key)}
              className={`flex-1 rounded-xl py-1.5 text-sm font-bold transition-colors ${
                scope === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search recipes..."
          className="bg-card pl-9 pr-9"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <button
        onClick={() => setShowAddRecipe(true)}
        className="fixed bottom-28 right-5 z-30 inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-sage px-3.5 text-xs font-bold text-sage-foreground shadow-float transition-all hover:bg-sage/90 active:scale-[0.95] md:bottom-8 md:right-8"
        aria-label="Add recipe"
        title="Add recipe"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Add Recipe</span>
      </button>

      <AddRecipeSheet open={showAddRecipe} onClose={() => setShowAddRecipe(false)} />

      {/* Filter dropdowns */}
      <div className="mb-5 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-2">
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
                <div className="absolute left-0 top-full mt-1.5 z-20 min-w-[152px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
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
                  ? <span className="capitalize">{selectedCuisine}</span>
                  : 'Cuisine'}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openDropdown === 'cuisine' ? 'rotate-180' : ''}`} />
              </button>
              {openDropdown === 'cuisine' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                  <div className="absolute left-0 top-full mt-1.5 z-20 min-w-[160px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
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
                        {cuisine}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="relative ml-auto shrink-0">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'sort' ? null : 'sort')}
            className={`grid h-8 w-8 place-items-center rounded-full border transition-colors active:scale-[0.95] ${
              openDropdown === 'sort'
                ? 'border-transparent bg-brand text-brand-foreground'
                : 'border-border bg-card text-foreground hover:border-brand'
            }`}
            aria-label="Sort recipes"
            title="Sort recipes"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          {openDropdown === 'sort' && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
              <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[248px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                {SORT_OPTIONS.map(option => {
                  const active = sortPreference === option.value
                  return (
                    <div
                      key={option.value}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm ${active ? 'bg-brand-subtle' : ''}`}
                    >
                      <span className={`flex-1 ${active ? 'font-medium text-brand' : 'text-foreground'}`}>
                        {option.label}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        {SORT_DIRECTIONS.map(direction => {
                          const dirActive = active && sortDirection === direction.value
                          const Icon = direction.icon
                          return (
                            <button
                              key={direction.value}
                              onClick={() => handleSortChange(option.value, direction.value)}
                              className={`grid h-7 w-7 place-items-center rounded-lg border transition-colors active:scale-[0.95] ${
                                dirActive
                                  ? 'border-transparent bg-brand text-brand-foreground'
                                  : 'border-border bg-card text-muted-foreground hover:border-brand hover:text-foreground'
                              }`}
                              aria-label={`Sort by ${option.label}, ${direction.label.toLowerCase()}`}
                              aria-pressed={dirActive}
                              title={direction.label}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
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
      {sortedRecipes.length === 0 && !search ? (
        <EmptyState
          illustration={<RecipeBookIllustration />}
          title={selectedCategory === 'cooked' ? 'No cooked recipes yet' : 'No recipes to try yet'}
          description={selectedCategory === 'cooked' ? 'Cook and log a recipe to see it here.' : 'Add a recipe to save it for later.'}
          action={
            <Link
              href="/recipes/new"
              className="inline-flex items-center gap-2 bg-brand text-brand-foreground rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-brand/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add recipe
            </Link>
          }
        />
      ) : (
        <div className="pb-24 space-y-6">
          {sortedRecipes.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {sortedRecipes.map((recipe, i) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  variant="list"
                  score={scores[recipe.id] ?? null}
                  onClick={() => router.push(`/recipes/${recipe.id}`)}
                  showCookTime={false}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${i * 40}ms` }}
                  action={
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {recipe.cook_time_minutes ? (
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Clock className="w-3 h-3" /> {recipe.cook_time_minutes}m
                        </span>
                      ) : null}
                      {recipe.cooked_count > 0 ? (
                        <span className="shrink-0">🍳×{recipe.cooked_count}</span>
                      ) : null}
                    </div>
                  }
                />
              ))}
            </div>
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
                      <div key={i} className="space-y-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
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
                          className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card"
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
      )}

      {/* Recommendations Bottom Sheet */}
      <BottomSheet open={showRecommendations} onClose={() => setShowRecommendations(false)} maxHeight="85vh">
        <div className="px-6 pb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground">Chef AI suggestions</h3>
              <p className="text-sm text-muted-foreground">Based on your library and preferences.</p>
            </div>
            <button onClick={() => setShowRecommendations(false)} className="text-muted-foreground hover:text-foreground active:scale-[0.95] transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>

          {recommendationsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-card rounded-2xl border border-border p-4 space-y-2">
                  <Shimmer className="h-4 w-2/3" />
                  <Shimmer className="h-3 w-full" />
                  <Shimmer className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : recommendationsError ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">{recommendationsError}</p>
              <Button onClick={fetchRecommendations} variant="outline">Try again</Button>
            </div>
          ) : recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((result, i) => (
                <div key={`${result.name}-${i}`} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">{getCuisineEmoji(result.cuisine)}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-heading font-bold text-foreground">{result.name}</h4>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {result.cuisine && <span className="capitalize">{result.cuisine}</span>}
                        {result.cook_time_minutes > 0 && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {result.cook_time_minutes}m</span>}
                      </div>
                      {result.description && <p className="text-sm text-muted-foreground mt-2">{result.description}</p>}
                      {result.why && <p className="text-xs text-brand mt-2">Why: {result.why}</p>}
                    </div>
                  </div>
                  <button onClick={() => addRecommendation(result)} className="mt-3 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-brand-foreground transition-all hover:bg-brand/90 active:scale-[0.98]">
                    Add to library
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No suggestions yet.</p>
          )}
        </div>
      </BottomSheet>

      {/* Create Cookbook Bottom Sheet */}
      <BottomSheet open={showCreateCookbook} onClose={closeCreateCookbook} maxHeight="85vh">
        <div className="px-6 pb-8">
          <h3 className="font-heading text-lg font-bold text-foreground mb-4">New Cookbook</h3>

          <div className="mb-4">
            <p className="text-sm font-medium text-foreground mb-2">Name</p>
            <Input
              value={newCookbookName}
              onChange={e => setNewCookbookName(e.target.value)}
              placeholder="e.g. Quick Weeknight Dinners"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && createCookbook()}
              className="bg-card"
            />
          </div>

          {initialRecipes.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-foreground mb-2">
                Add recipes <span className="text-muted-foreground font-normal">(optional)</span>
              </p>
              <div className="space-y-1 max-h-56 overflow-y-auto -mx-1 px-1">
                {initialRecipes.map(r => (
                  <button
                    key={r.id}
                    onClick={() => toggleNewCookbookRecipe(r.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      newCookbookRecipes.includes(r.id)
                        ? 'bg-brand-subtle text-brand'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      newCookbookRecipes.includes(r.id) ? 'bg-brand border-brand' : 'border-border'
                    }`}>
                      {newCookbookRecipes.includes(r.id) && (
                        <span className="text-brand-foreground text-[10px] font-bold">✓</span>
                      )}
                    </span>
                    <span className="flex-1 text-left truncate">{r.name}</span>
                    {r.cuisine && (
                      <span className="text-xs text-muted-foreground capitalize shrink-0">{r.cuisine}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={createCookbook}
            disabled={creatingCookbook || !newCookbookName.trim()}
            className="w-full bg-brand hover:bg-brand/90 text-brand-foreground h-12 text-base"
          >
            {creatingCookbook ? 'Creating...' : 'Create Cookbook'}
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}
