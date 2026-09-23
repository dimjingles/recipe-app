'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useDeferredValue, memo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { RecipeListItem, CookbookWithCount, RecipeSortPreference, RecipeSortDirection, RecipeTypeFilter } from '@/types/database'
import { Plus, Search, Clock, X, Globe, ChevronDown, BookOpen, Loader2, Sparkles, ArrowDownUp, ArrowDown, ArrowUp } from 'lucide-react'
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
import { queries, queryKeys, useCacheInvalidation } from '@/lib/queries/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { RECIPE_CATEGORIES } from '@/lib/recipe-categories'

// The "Course" filter. Mirrors the values `recipe_type` can actually hold
// (RECIPE_TYPE_VALUES). Breakfast/Lunch/Dinner used to be listed here but
// nothing ever wrote them, so those filters always came back empty.
const COURSES = [
  { value: 'appetizer', label: 'Appetizer' },
  { value: 'main', label: 'Main' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'drink', label: 'Drink' },
]

// The "Time" filter — cook-time ranges, single-select like Course. 30 and 60 both
// belong to the middle range.
const COOK_TIME_OPTIONS = [
  { value: 'under_30', label: 'Less than 30min', matches: (m: number) => m < 30 },
  { value: '30_to_60', label: 'Between 30-60min', matches: (m: number) => m >= 30 && m <= 60 },
  { value: 'over_60', label: 'More than 60min', matches: (m: number) => m > 60 },
]

// The "Difficulty" filter. Mirrors the 1–3 `difficulty` column.
const DIFFICULTIES = [
  { value: 1, label: 'Easy' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Hard' },
]

// The dropdowns that live in the scrolling filter carousel.
type FilterMenu = 'course' | 'type' | 'cuisine' | 'time' | 'difficulty'
const FILTER_MENUS: readonly string[] = ['course', 'type', 'cuisine', 'time', 'difficulty'] satisfies FilterMenu[]
const isFilterMenu = (menu: string | null): menu is FilterMenu => menu != null && FILTER_MENUS.includes(menu)

// Sort options for the "Cooked" tab — driven by cooking history, so persisted
// server-side via the user's profile preference.
const COOKED_SORT_OPTIONS = [
  { value: 'ranking', label: 'Ranking' },
  { value: 'recently_cooked', label: 'Most recently cooked' },
  { value: 'most_cooked', label: 'Most cooked' },
  { value: 'cook_time', label: 'Quickest to cook' },
] as const

// The "Want to try" tab holds recipes that have never been cooked, so the
// history-based sorts above don't apply. It gets its own lightweight options.
type WantToTrySortPreference = 'alphabetical' | 'recently_added'
const WANT_TO_TRY_SORT_OPTIONS = [
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'recently_added', label: 'Recently added' },
] as const

/** A library grid card. Memoized with primitive/stable props (the recipe object
 *  is structurally shared by the query cache), so filtering or typing only
 *  re-renders the cards that actually changed. */
const LibraryCard = memo(function LibraryCard({
  recipe,
  score,
  index,
}: {
  recipe: RecipeListItem
  score: number | null
  index: number
}) {
  const queryClient = useQueryClient()
  return (
    <RecipeCard
      recipe={recipe}
      variant="grid"
      score={score}
      href={`/recipes/${recipe.id}`}
      onIntent={() => void queryClient.prefetchQuery(queries.recipe(recipe.id))}
      showCookTime={false}
      className="animate-fade-in-up"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
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
  )
})

/** Shortest query that triggers the (AI-backed) online recipe search. */
const MIN_ONLINE_QUERY = 3

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

// Descending by score; unranked recipes sort last. Ranks are only comparable
// within a recipe's own type pool, so the 0–10 score — which is normalised per
// pool — is what makes a top dessert and a top main sort side by side.
function compareScoreDesc(a: number | undefined, b: number | undefined) {
  const aScore = a ?? Number.NEGATIVE_INFINITY
  const bScore = b ?? Number.NEGATIVE_INFINITY
  return bScore - aScore
}

// Ascending by cook time; recipes with no cook time sort last.
function compareCookTimeAsc(a: number | null, b: number | null) {
  const aTime = a ?? Number.POSITIVE_INFINITY
  const bTime = b ?? Number.POSITIVE_INFINITY
  return aTime - bTime
}

function compareRecipes(
  a: RecipeListItem,
  b: RecipeListItem,
  sort: RecipeSortPreference,
  scores: Record<string, number>
) {
  if (sort === 'ranking') {
    return compareScoreDesc(scores[a.id], scores[b.id])
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

function compareWantToTry(a: RecipeListItem, b: RecipeListItem, sort: WantToTrySortPreference) {
  if (sort === 'recently_added') {
    return compareDateDesc(a.created_at, b.created_at)
      || a.name.localeCompare(b.name)
  }

  // 'alphabetical'
  return a.name.localeCompare(b.name)
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
  initialCategory = 'cooked',
  initialSortPreference = 'ranking',
  initialSortDirection = 'default',
  initialTypeFilter = 'main',
}: {
  initialRecipes: RecipeListItem[]
  initialCookbooks: CookbookWithCount[]
  initialCategory?: 'cooked' | 'bookmarked'
  initialSortPreference?: RecipeSortPreference
  initialSortDirection?: RecipeSortDirection
  initialTypeFilter?: RecipeTypeFilter
}) {
  const router = useRouter()
  const invalidate = useCacheInvalidation()
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([])
  const [selectedType, setSelectedType] = useState<string | null>(
    initialTypeFilter === 'all' ? null : initialTypeFilter
  )
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedCookTime, setSelectedCookTime] = useState<string | null>(null)
  const [selectedDifficulties, setSelectedDifficulties] = useState<number[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedCookbook, setSelectedCookbook] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<'cooked' | 'bookmarked'>(initialCategory)
  const [sortPreference, setSortPreference] = useState<RecipeSortPreference>(initialSortPreference)
  const [sortDirection, setSortDirection] = useState<RecipeSortDirection>(initialSortDirection)
  // The "Want to try" tab keeps its own sort, independent of the persisted
  // Cooked-tab preference, so switching tabs doesn't clobber the other's choice.
  const [wantToTrySort, setWantToTrySort] = useState<WantToTrySortPreference>('recently_added')
  const [wantToTryDirection, setWantToTryDirection] = useState<RecipeSortDirection>('default')
  const queryClient = useQueryClient()
  // Render straight from the cached query (the prop is useCookbooks().data), and
  // write edits into that cache — a local copy would ignore background refetches.
  const cookbooks = initialCookbooks
  const setCookbooks = (fn: (prev: CookbookWithCount[]) => CookbookWithCount[]) =>
    queryClient.setQueryData<CookbookWithCount[]>(queryKeys.cookbooks, old => fn(old ?? []))
  const [onlineResults, setOnlineResults] = useState<OnlineResult[]>([])
  const [loadingOnline, setLoadingOnline] = useState(false)
  const [pendingSearch, setPendingSearch] = useState(false)
  const [addingRecipe, setAddingRecipe] = useState<string | null>(null)
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [recommendationsError, setRecommendationsError] = useState('')
  const [openDropdown, setOpenDropdown] = useState<FilterMenu | 'cookbook' | 'sort' | null>(null)
  // Left offset of the open filter menu within the filter bar, so it sits under its chip.
  const [filterMenuLeft, setFilterMenuLeft] = useState(0)
  const filterBarRef = useRef<HTMLDivElement>(null)
  const filterMenuRef = useRef<HTMLDivElement>(null)

  // Create cookbook sheet
  const [showCreateCookbook, setShowCreateCookbook] = useState(false)
  const [showAddRecipe, setShowAddRecipe] = useState(false)
  const [newCookbookName, setNewCookbookName] = useState('')
  const [newCookbookRecipes, setNewCookbookRecipes] = useState<string[]>([])
  const [creatingCookbook, setCreatingCookbook] = useState(false)

  const saveSortSeq = useRef(0)
  const saveTypeSeq = useRef(0)

  // Online suggestions are an AI call, so only for real queries (3+ chars),
  // debounced, and a newer query aborts the older request — a slow stale
  // response can never overwrite fresher results.
  const onlineQuery = search.trim().length >= MIN_ONLINE_QUERY ? search.trim() : ''
  useEffect(() => {
    if (!onlineQuery) {
      setOnlineResults([])
      setPendingSearch(false)
      setLoadingOnline(false)
      return
    }
    setPendingSearch(true)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setPendingSearch(false)
      setLoadingOnline(true)
      try {
        const res = await fetch('/api/recipes/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: onlineQuery }),
          signal: controller.signal,
        })
        const data = await res.json()
        setOnlineResults(data.results || [])
      } catch {
        if (controller.signal.aborted) return
        setOnlineResults([])
      } finally {
        if (!controller.signal.aborted) setLoadingOnline(false)
      }
    }, 600)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [onlineQuery])

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
          recipe_type: details.recipe_type || undefined,
          categories: details.categories || undefined,
          cook_time_minutes: details.cook_time_minutes || result.cook_time_minutes,
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

      toast.success(`${result.name} added to your library!`)
      invalidate.recipesChanged()
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
      invalidate.meChanged()
    } catch {
      if (saveSortSeq.current === requestSeq) {
        toast.error('Could not save sort preference')
      }
    }
  }

  // The course filter persists server-side like the sort preference, so the
  // library reopens on whatever the user last looked at rather than resetting.
  const handleTypeFilterChange = async (nextType: string | null) => {
    setSelectedType(nextType)
    setOpenDropdown(null)
    const requestSeq = saveTypeSeq.current + 1
    saveTypeSeq.current = requestSeq

    try {
      const res = await fetch('/api/profile/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_type_filter: nextType ?? 'all' }),
      })
      if (!res.ok) throw new Error('Could not save course filter')
      invalidate.meChanged()
    } catch {
      if (saveTypeSeq.current === requestSeq) {
        toast.error('Could not save course filter')
      }
    }
  }

  // Routes a dropdown selection to the right place: the Cooked tab persists its
  // preference server-side, the Want to try tab keeps it in local state.
  const handleSortSelection = (
    value: RecipeSortPreference | WantToTrySortPreference,
    nextDirection: RecipeSortDirection,
  ) => {
    if (isWantToTry) {
      setWantToTrySort(value as WantToTrySortPreference)
      setWantToTryDirection(nextDirection)
      setOpenDropdown(null)
      return
    }
    handleSortChange(value as RecipeSortPreference, nextDirection)
  }

  const toggleFilterMenu = (menu: FilterMenu, chip: HTMLElement) => {
    if (openDropdown === menu) {
      setOpenDropdown(null)
      return
    }
    const bar = filterBarRef.current
    if (bar) setFilterMenuLeft(chip.getBoundingClientRect().left - bar.getBoundingClientRect().left)
    setOpenDropdown(menu)
  }

  // Keep an open filter menu inside the bar: a chip scrolled near either edge would
  // otherwise hang its menu off-screen.
  useLayoutEffect(() => {
    const bar = filterBarRef.current
    const menu = filterMenuRef.current
    if (!bar || !menu) return
    const maxLeft = Math.max(0, bar.clientWidth - menu.offsetWidth)
    const clamped = Math.min(Math.max(filterMenuLeft, 0), maxLeft)
    if (clamped !== filterMenuLeft) setFilterMenuLeft(clamped)
  }, [openDropdown, filterMenuLeft])

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

  const toggleCategory = (category: string) =>
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    )

  const toggleCuisine = (cuisine: string) =>
    setSelectedCuisines(prev =>
      prev.includes(cuisine) ? prev.filter(c => c !== cuisine) : [...prev, cuisine]
    )

  const toggleDifficulty = (difficulty: number) =>
    setSelectedDifficulties(prev =>
      prev.includes(difficulty) ? prev.filter(d => d !== difficulty) : [...prev, difficulty]
    )

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
      invalidate.cookbooksChanged()
      setCookbooks(prev => [...prev, newCookbook])
      setSelectedCookbook(data.id)
      closeCreateCookbook()
    } catch (e: any) {
      toast.error(e.message || 'Could not create cookbook')
    } finally {
      setCreatingCookbook(false)
    }
  }

  // 0–10 scores keyed by recipe id, normalised within each (type, tier) pool.
  const scores = useMemo(
    () => computeScores(initialRecipes.map(r => ({
      id: r.id,
      rank: r.rank,
      feedback: r.feedback,
      recipeType: r.recipe_type,
    }))),
    [initialRecipes]
  )

  // Typing stays responsive: the list filters against a deferred copy of the
  // search text, so React can render keystrokes first.
  const deferredSearch = useDeferredValue(search)

  // The whole filter chain, recomputed only when an input changes — not on
  // every unrelated re-render (dropdowns, sheets, online-search state).
  const {
    uniqueTags, cookedCount, bookmarkedCount, cuisines, activeCuisines, categoryOptions,
    activeCategories, hasCookTimes, difficultyOptions, activeDifficulties, activeCookTime, filtered,
  } = useMemo(() => {
    const uniqueTags = Array.from(new Set(initialRecipes.flatMap(r => r.tags || []))).sort()

    const scopedRecipes = initialRecipes.filter(r =>
      !selectedCookbook ||
      (r.cookbook_recipes || []).some(cr => cr.cookbook_id === selectedCookbook)
    )
    const cookedCount = scopedRecipes.filter(r => r.cooked_count > 0).length
    const bookmarkedCount = scopedRecipes.length - cookedCount

    // Recipes in the current cookbook + tab — the scope both the cuisine options
    // and the filtered list are drawn from.
    const categoryRecipes = scopedRecipes.filter(r =>
      selectedCategory === 'cooked' ? r.cooked_count > 0 : r.cooked_count === 0
    )

    // Cuisine options only offer what actually exists in the current view.
    const cuisines = Array.from(
      new Set(categoryRecipes.map(r => r.cuisine?.toLowerCase()).filter(Boolean) as string[])
    ).sort()

    // A selection can fall out of scope when the cookbook or tab changes; ignore
    // those rather than clearing state, so the selection returns when the user
    // switches back.
    const activeCuisines = selectedCuisines.filter(c => cuisines.includes(c))

    // Same idea for the "Type" filter: offer only categories present in view,
    // in the fixed RECIPE_CATEGORIES order.
    const presentCategories = new Set(categoryRecipes.flatMap(r => r.categories ?? []))
    const categoryOptions = RECIPE_CATEGORIES.filter(c => presentCategories.has(c.value))
    const activeCategories = selectedCategories.filter(c => presentCategories.has(c))

    // Time and Difficulty follow suit: hidden when nothing in view has the field.
    const hasCookTimes = categoryRecipes.some(r => r.cook_time_minutes != null)
    const presentDifficulties = new Set(categoryRecipes.map(r => r.difficulty).filter((d): d is number => d != null))
    const difficultyOptions = DIFFICULTIES.filter(d => presentDifficulties.has(d.value))
    const activeDifficulties = selectedDifficulties.filter(d => presentDifficulties.has(d))
    const activeCookTime = hasCookTimes ? COOK_TIME_OPTIONS.find(o => o.value === selectedCookTime) ?? null : null

    const q = deferredSearch.toLowerCase()
    const filtered = categoryRecipes.filter(r => {
      const matchesSearch =
        r.name.toLowerCase().includes(q) ||
        r.cuisine?.toLowerCase().includes(q) ||
        r.tags?.some(t => t.toLowerCase().includes(q))
      const matchesCuisine =
        activeCuisines.length === 0 ||
        (!!r.cuisine && activeCuisines.includes(r.cuisine.toLowerCase()))
      const matchesCourse = !selectedType || r.recipe_type?.toLowerCase() === selectedType
      const matchesCategory =
        activeCategories.length === 0 ||
        (r.categories ?? []).some(c => activeCategories.includes(c))
      const matchesTime =
        activeCookTime == null ||
        (r.cook_time_minutes != null && activeCookTime.matches(r.cook_time_minutes))
      const matchesDifficulty =
        activeDifficulties.length === 0 ||
        (r.difficulty != null && activeDifficulties.includes(r.difficulty))
      const matchesTag = !selectedTag || (r.tags || []).includes(selectedTag)
      return matchesSearch && matchesCuisine && matchesCourse && matchesCategory
        && matchesTime && matchesDifficulty && matchesTag
    })

    return {
      uniqueTags, cookedCount, bookmarkedCount, cuisines, activeCuisines, categoryOptions,
      activeCategories, hasCookTimes, difficultyOptions, activeDifficulties, activeCookTime, filtered,
    }
  }, [
    initialRecipes, selectedCookbook, selectedCategory, selectedCuisines, selectedCategories,
    selectedDifficulties, selectedCookTime, selectedType, selectedTag, deferredSearch,
  ])

  const isWantToTry = selectedCategory === 'bookmarked'
  const activeSortOptions = isWantToTry ? WANT_TO_TRY_SORT_OPTIONS : COOKED_SORT_OPTIONS
  const activeSortValue = isWantToTry ? wantToTrySort : sortPreference
  const activeSortDirection = isWantToTry ? wantToTryDirection : sortDirection

  const sortedRecipes = useMemo(
    () => {
      const ordered = [...filtered].sort((a, b) =>
        isWantToTry ? compareWantToTry(a, b, wantToTrySort) : compareRecipes(a, b, sortPreference, scores)
      )
      // 'reversed' flips the whole list bottom-to-top for the chosen sort option.
      return activeSortDirection === 'reversed' ? ordered.reverse() : ordered
    },
    [filtered, isWantToTry, sortPreference, sortDirection, wantToTrySort, wantToTryDirection, activeSortDirection, scores]
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

  // Dropdown chips in the filter carousel. shrink-0 + nowrap keep them on one scrolling row.
  const filterDropdownClass = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium border transition-colors active:scale-[0.95] ${
      active
        ? 'bg-brand text-brand-foreground border-transparent'
        : 'bg-card border-border text-foreground hover:border-brand'
    }`

  const selectedCookbookName =cookbooks.find(c => c.id === selectedCookbook)?.name

  return (
    <div className="mx-auto max-w-6xl px-5 md:px-8">
      {/* Sticky header: cookbook, tabs, filters, sort + search, tags */}
      <div className="sticky top-0 z-30 -mx-5 mb-4 border-b border-border/70 px-5 pt-[max(1rem,env(safe-area-inset-top))] header-surface md:-mx-8 md:px-8 md:pt-6">
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

        {/* Filter carousel — one row of chips that scrolls sideways and runs to the screen
            edge. The menus render outside the scroller (which would clip them), anchored
            under whichever chip opened them. */}
        <div ref={filterBarRef} className="relative mb-4">
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 scrollbar-hide md:-mx-8 md:px-8">
            <button onClick={e => toggleFilterMenu('course', e.currentTarget)} className={filterDropdownClass(!!selectedType)}>
              {selectedType
                ? COURSES.find(t => t.value === selectedType)?.label
                : 'Course'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openDropdown === 'course' ? 'rotate-180' : ''}`} />
            </button>

            {/* Type — descriptive categories, multi-select like Cuisine */}
            {categoryOptions.length > 0 && (
              <button onClick={e => toggleFilterMenu('type', e.currentTarget)} className={filterDropdownClass(activeCategories.length > 0)}>
                {activeCategories.length === 0
                  ? 'Type'
                  : activeCategories.length === 1
                    ? RECIPE_CATEGORIES.find(c => c.value === activeCategories[0])?.label
                    : `Type (${activeCategories.length})`}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openDropdown === 'type' ? 'rotate-180' : ''}`} />
              </button>
            )}

            {cuisines.length > 0 && (
              <button onClick={e => toggleFilterMenu('cuisine', e.currentTarget)} className={filterDropdownClass(activeCuisines.length > 0)}>
                {activeCuisines.length === 0
                  ? 'Cuisine'
                  : activeCuisines.length === 1
                    ? <span className="capitalize">{activeCuisines[0]}</span>
                    : `Cuisine (${activeCuisines.length})`}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openDropdown === 'cuisine' ? 'rotate-180' : ''}`} />
              </button>
            )}

            {/* Time — maximum cook time, single-select like Course */}
            {hasCookTimes && (
              <button onClick={e => toggleFilterMenu('time', e.currentTarget)} className={filterDropdownClass(activeCookTime != null)}>
                {activeCookTime != null
                  ? activeCookTime.label
                  : 'Time'}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openDropdown === 'time' ? 'rotate-180' : ''}`} />
              </button>
            )}

            {/* Difficulty — multi-select like Cuisine */}
            {difficultyOptions.length > 0 && (
              <button onClick={e => toggleFilterMenu('difficulty', e.currentTarget)} className={filterDropdownClass(activeDifficulties.length > 0)}>
                {activeDifficulties.length === 0
                  ? 'Difficulty'
                  : activeDifficulties.length === 1
                    ? DIFFICULTIES.find(d => d.value === activeDifficulties[0])?.label
                    : `Difficulty (${activeDifficulties.length})`}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${openDropdown === 'difficulty' ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>

          {isFilterMenu(openDropdown) && (
            <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
          )}

          {openDropdown === 'course' && (
            <div ref={filterMenuRef} style={{ left: filterMenuLeft }} className="absolute top-full mt-1.5 z-20 min-w-[152px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <button
                onClick={() => handleTypeFilterChange(null)}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${!selectedType ? 'text-brand bg-brand-subtle' : 'text-foreground hover:bg-muted'}`}
              >
                All courses
              </button>
              {COURSES.map(t => (
                <button
                  key={t.value}
                  onClick={() => handleTypeFilterChange(t.value)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${selectedType === t.value ? 'text-brand bg-brand-subtle font-medium' : 'text-foreground hover:bg-muted'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Stays open while types are checked on and off; the backdrop dismisses it. */}
          {openDropdown === 'type' && (
            <div ref={filterMenuRef} style={{ left: filterMenuLeft }} className="absolute top-full mt-1.5 z-20 max-h-72 min-w-[180px] overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
              <button
                onClick={() => setSelectedCategories([])}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${activeCategories.length === 0 ? 'text-brand bg-brand-subtle' : 'text-foreground hover:bg-muted'}`}
              >
                All types
              </button>
              {categoryOptions.map(c => {
                const checked = activeCategories.includes(c.value)
                return (
                  <button
                    key={c.value}
                    onClick={() => toggleCategory(c.value)}
                    role="checkbox"
                    aria-checked={checked}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      checked ? 'bg-brand-subtle font-medium text-brand' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      checked ? 'bg-brand border-brand' : 'border-border'
                    }`}>
                      {checked && <span className="text-brand-foreground text-[10px] font-bold">✓</span>}
                    </span>
                    <span className="flex-1">{c.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Stays open while cuisines are checked on and off; the backdrop dismisses it. */}
          {openDropdown === 'cuisine' && (
            <div ref={filterMenuRef} style={{ left: filterMenuLeft }} className="absolute top-full mt-1.5 z-20 max-h-72 min-w-[180px] overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
              <button
                onClick={() => setSelectedCuisines([])}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${activeCuisines.length === 0 ? 'text-brand bg-brand-subtle' : 'text-foreground hover:bg-muted'}`}
              >
                All cuisines
              </button>
              {cuisines.map(cuisine => {
                const checked = activeCuisines.includes(cuisine)
                return (
                  <button
                    key={cuisine}
                    onClick={() => toggleCuisine(cuisine)}
                    role="checkbox"
                    aria-checked={checked}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm capitalize transition-colors ${
                      checked ? 'bg-brand-subtle font-medium text-brand' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      checked ? 'bg-brand border-brand' : 'border-border'
                    }`}>
                      {checked && <span className="text-brand-foreground text-[10px] font-bold">✓</span>}
                    </span>
                    <span className="flex-1">{cuisine}</span>
                  </button>
                )
              })}
            </div>
          )}

          {openDropdown === 'time' && (
            <div ref={filterMenuRef} style={{ left: filterMenuLeft }} className="absolute top-full mt-1.5 z-20 min-w-[168px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <button
                onClick={() => { setSelectedCookTime(null); setOpenDropdown(null) }}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${activeCookTime == null ? 'text-brand bg-brand-subtle' : 'text-foreground hover:bg-muted'}`}
              >
                Any time
              </button>
              {COOK_TIME_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => { setSelectedCookTime(o.value); setOpenDropdown(null) }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${activeCookTime?.value === o.value ? 'text-brand bg-brand-subtle font-medium' : 'text-foreground hover:bg-muted'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {/* Stays open while levels are checked on and off; the backdrop dismisses it. */}
          {openDropdown === 'difficulty' && (
            <div ref={filterMenuRef} style={{ left: filterMenuLeft }} className="absolute top-full mt-1.5 z-20 min-w-[180px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <button
                onClick={() => setSelectedDifficulties([])}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${activeDifficulties.length === 0 ? 'text-brand bg-brand-subtle' : 'text-foreground hover:bg-muted'}`}
              >
                Any difficulty
              </button>
              {difficultyOptions.map(d => {
                const checked = activeDifficulties.includes(d.value)
                return (
                  <button
                    key={d.value}
                    onClick={() => toggleDifficulty(d.value)}
                    role="checkbox"
                    aria-checked={checked}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                      checked ? 'bg-brand-subtle font-medium text-brand' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      checked ? 'bg-brand border-brand' : 'border-border'
                    }`}>
                      {checked && <span className="text-brand-foreground text-[10px] font-bold">✓</span>}
                    </span>
                    <span className="flex-1">{d.label}</span>
                    <span className="text-xs">{'🔪'.repeat(d.value)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Sort + search row */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'sort' ? null : 'sort')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand transition-opacity active:opacity-70"
              aria-label="Sort recipes"
              title="Sort recipes"
            >
              <ArrowDownUp className="h-4 w-4" />
              <span>{activeSortOptions.find(o => o.value === activeSortValue)?.label}</span>
            </button>
            {openDropdown === 'sort' && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                <div className="absolute left-0 top-full z-20 mt-1.5 min-w-[248px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  {activeSortOptions.map(option => {
                    const active = activeSortValue === option.value
                    const reversed = active && activeSortDirection === 'reversed'
                    const DirIcon = reversed ? ArrowUp : ArrowDown
                    const dirLabel = reversed ? 'Bottom to top' : 'Top to bottom'
                    // Single toggle: selecting an inactive option starts top-to-bottom;
                    // tapping the active option flips its direction.
                    const nextDirection = active && activeSortDirection === 'default' ? 'reversed' : 'default'
                    return (
                      <div
                        key={option.value}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm ${active ? 'bg-brand-subtle' : ''}`}
                      >
                        <span className={`flex-1 ${active ? 'font-medium text-brand' : 'text-foreground'}`}>
                          {option.label}
                        </span>
                        <button
                          onClick={() => handleSortSelection(option.value, nextDirection)}
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition-colors active:scale-[0.95] ${
                            active
                              ? 'border-transparent bg-brand text-brand-foreground'
                              : 'border-border bg-card text-muted-foreground hover:border-brand hover:text-foreground'
                          }`}
                          aria-label={active ? `Sorted by ${option.label}, ${dirLabel.toLowerCase()} — tap to reverse` : `Sort by ${option.label}`}
                          aria-pressed={reversed}
                          title={active ? `${dirLabel} — tap to reverse` : `Sort by ${option.label}`}
                        >
                          <DirIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setSearchOpen(open => !open)}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors active:scale-[0.95] ${
              searchOpen || search ? 'text-brand' : 'text-foreground hover:text-brand'
            }`}
            aria-label="Search recipes"
            aria-pressed={searchOpen || !!search}
            title="Search recipes"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>

        {/* Search input, revealed by the search icon */}
        {(searchOpen || search) && (
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search recipes..."
              autoFocus
              className="bg-card pl-9 pr-9"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        )}

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
            <div className="grid grid-cols-2 gap-3">
              {sortedRecipes.map((recipe, i) => (
                <LibraryCard
                  key={recipe.id}
                  recipe={recipe}
                  score={scores[recipe.id] ?? null}
                  index={i}
                />
              ))}
            </div>
          )}

          {/* Online search results */}
            {onlineQuery && (
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
