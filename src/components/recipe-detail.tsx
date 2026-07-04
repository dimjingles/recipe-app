'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, Users, Edit, ChefHat, Trophy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { RecipeWithDetails } from '@/types/database'

const CATEGORY_EMOJI: Record<string, string> = {
  produce: '🥦', dairy: '🧀', meat: '🥩', seafood: '🐟',
  pantry: '🫙', spices: '🌿', bakery: '🍞', frozen: '🧊', other: '📦',
}

const CATEGORY_ORDER = ['produce', 'meat', 'seafood', 'dairy', 'bakery', 'pantry', 'spices', 'frozen', 'other']

function groupIngredients(ingredients: RecipeWithDetails['ingredients']) {
  const groups: Record<string, typeof ingredients> = {}
  for (const ing of ingredients) {
    const cat = ing.category || 'other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(ing)
  }
  return CATEGORY_ORDER.filter(c => groups[c]).map(c => ({ category: c, items: groups[c] }))
}

// ─── Cook Dialog ────────────────────────────────────────────────────────────

interface CookDialogProps {
  recipeId: string
  onClose: () => void
  onSaved: (wasUnranked: boolean) => void
  isAlreadyRanked: boolean
}

function CookDialog({ recipeId, onClose, onSaved, isAlreadyRanked }: CookDialogProps) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/recipes/${recipeId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes || undefined }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Cooking logged! 🎉')
      onSaved(!isAlreadyRanked)
      onClose()
    } catch {
      toast.error('Could not save log')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-10 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900 mb-4">Log Cooking Session</h3>
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Notes (optional)</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How did it turn out? Any tweaks?"
            className="w-full border rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        {!isAlreadyRanked && (
          <p className="text-xs text-orange-600 bg-orange-50 rounded-xl px-3 py-2 mb-4">
            After logging, you'll rank this against your other recipes.
          </p>
        )}
        <Button
          onClick={save}
          disabled={saving}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 text-base"
        >
          {saving ? 'Saving...' : 'Log it!'}
        </Button>
      </div>
    </div>
  )
}

// ─── Comparison / Ranking Dialog ─────────────────────────────────────────────

interface RankedRecipe {
  id: string
  name: string
  cuisine: string | null
  rank: number
}

interface ComparisonDialogProps {
  thisRecipe: { id: string; name: string }
  onClose: () => void
  onRanked: (rank: number) => void
}

function ComparisonDialog({ thisRecipe, onClose, onRanked }: ComparisonDialogProps) {
  const [ranked, setRanked] = useState<RankedRecipe[] | null>(null)
  const [lo, setLo] = useState(0)
  const [hi, setHi] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Fetch ranked list on mount
  useState(() => {
    fetch('/api/rankings')
      .then(r => r.json())
      .then((data: RankedRecipe[]) => {
        const others = data.filter(r => r.id !== thisRecipe.id)
        setRanked(others)
        setLo(0)
        setHi(others.length)
        setLoading(false)
        // If no comparisons needed, save immediately
        if (others.length === 0) {
          saveRank(1)
        }
      })
      .catch(() => {
        toast.error('Could not load rankings')
        onClose()
      })
  })

  const saveRank = async (position: number) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/recipes/${thisRecipe.id}/rank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position }),
      })
      if (!res.ok) throw new Error('Failed')
      onRanked(position)
      onClose()
    } catch {
      toast.error('Could not save ranking')
      setSaving(false)
    }
  }

  const choose = (thisRecipeWins: boolean) => {
    if (!ranked) return
    const mid = Math.floor((lo + hi) / 2)
    const newLo = thisRecipeWins ? lo : mid + 1
    const newHi = thisRecipeWins ? mid : hi

    if (newLo >= newHi) {
      saveRank(newLo + 1)
    } else {
      setLo(newLo)
      setHi(newHi)
    }
  }

  const mid = ranked ? Math.floor((lo + hi) / 2) : 0
  const opponent = ranked?.[mid]

  if (loading || !ranked) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
        <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-10 shadow-xl">
          <p className="text-center text-gray-400 py-8">Loading rankings…</p>
        </div>
      </div>
    )
  }

  if (saving) {
    return (
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
        <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-10 shadow-xl">
          <p className="text-center text-gray-400 py-8">Saving your ranking…</p>
        </div>
      </div>
    )
  }

  if (!opponent) return null

  const total = ranked.length
  const step = Math.ceil(Math.log2(total + 1)) - Math.ceil(Math.log2(hi - lo + 1)) + 1
  const totalSteps = Math.ceil(Math.log2(total + 1))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl p-6 pb-10 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900">Rank this recipe</h3>
          <span className="text-xs text-gray-400">{step}/{totalSteps}</span>
        </div>
        <p className="text-sm text-gray-500 mb-6">Which did you like better?</p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => choose(true)}
            className="bg-orange-50 border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-100 active:scale-[0.97] transition-all rounded-2xl p-4 text-left"
          >
            <p className="text-xs text-orange-400 font-medium uppercase tracking-wide mb-1">This one</p>
            <p className="font-semibold text-gray-900 text-sm leading-snug">{thisRecipe.name}</p>
          </button>
          <button
            onClick={() => choose(false)}
            className="bg-gray-50 border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-100 active:scale-[0.97] transition-all rounded-2xl p-4 text-left"
          >
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">#{opponent.rank}</p>
            <p className="font-semibold text-gray-900 text-sm leading-snug">{opponent.name}</p>
          </button>
        </div>

        <button onClick={onClose} className="mt-4 w-full text-sm text-gray-400 hover:text-gray-600">
          Skip for now
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RecipeDetail({ recipe }: { recipe: RecipeWithDetails }) {
  const router = useRouter()
  const [showCook, setShowCook] = useState(false)
  const [showRank, setShowRank] = useState(false)
  const [cookedCount, setCookedCount] = useState(recipe.cooked_count)
  const [currentRank, setCurrentRank] = useState<number | null>(recipe.rank)
  const [logs, setLogs] = useState(
    (recipe.cooking_log || [])
      .sort((a, b) => new Date(b.cooked_at).getTime() - new Date(a.cooked_at).getTime())
      .slice(0, 5)
  )
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const grouped = groupIngredients(recipe.ingredients || [])

  const handleCookSaved = (triggerRanking: boolean) => {
    setCookedCount(c => c + 1)
    if (triggerRanking) setShowRank(true)
    else router.refresh()
  }

  const handleUpdateLogDate = async (logId: string, dateValue: string) => {
    setEditingLogId(null)
    const cooked_at = new Date(dateValue).toISOString()
    setLogs(prev =>
      prev
        .map(l => l.id === logId ? { ...l, cooked_at } : l)
        .sort((a, b) => new Date(b.cooked_at).getTime() - new Date(a.cooked_at).getTime())
    )
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/log/${logId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cooked_at }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      toast.error('Could not update date')
      router.refresh()
    }
  }

  const handleDeleteLog = async (logId: string) => {
    setLogs(prev => prev.filter(l => l.id !== logId))
    setCookedCount(c => Math.max(0, c - 1))
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/log/${logId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
    } catch {
      toast.error('Could not delete log entry')
      router.refresh()
    }
  }

  const handleRanked = (rank: number) => {
    setCurrentRank(rank)
    toast.success(`Ranked #${rank} 🏆`)
    router.refresh()
  }

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-orange-400 to-amber-500 px-4 pt-6 pb-8">
        <div className="flex items-center justify-between mb-4">
          <Link href="/recipes" className="text-white/80 hover:text-white p-1 -ml-1">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className="text-white/80 hover:text-white p-2"
          >
            <Edit className="w-4 h-4" />
          </Link>
        </div>
        <div className="text-5xl mb-3">
          {recipe.cuisine ? { italian:'🍝',japanese:'🍜',chinese:'🥢',mexican:'🌮',indian:'🍛',thai:'🌶️',french:'🥐',american:'🍔',mediterranean:'🫒',korean:'🍱',vietnamese:'🍲',greek:'🥗',spanish:'🥘' }[recipe.cuisine.toLowerCase()] ?? '🍽️' : '🍽️'}
        </div>
        <h1 className="text-2xl font-bold text-white leading-tight">{recipe.name}</h1>
        {recipe.description && (
          <p className="text-white/80 text-sm mt-2 leading-relaxed">{recipe.description}</p>
        )}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          {recipe.cuisine && (
            <span className="bg-white/20 text-white rounded-full px-3 py-1 text-xs font-medium capitalize">{recipe.cuisine}</span>
          )}
          {recipe.cook_time_minutes && (
            <span className="flex items-center gap-1 text-white/90 text-sm">
              <Clock className="w-3.5 h-3.5" /> {recipe.cook_time_minutes} min
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1 text-white/90 text-sm">
              <Users className="w-3.5 h-3.5" /> {recipe.servings} servings
            </span>
          )}
          {cookedCount > 0 && (
            <span className="flex items-center gap-1 text-white/90 text-sm">
              <ChefHat className="w-3.5 h-3.5" /> Cooked {cookedCount}×
            </span>
          )}
          {currentRank !== null && (
            <span className="flex items-center gap-1 text-white font-semibold text-sm">
              <Trophy className="w-3.5 h-3.5" /> Ranked #{currentRank}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 -mt-4">
        {/* Action buttons */}
        {(cookedCount === 0 || currentRank !== null) && (
          <div className="flex gap-2 mb-6">
            {cookedCount === 0 && (
              <Button
                onClick={() => setShowCook(true)}
                className="flex-1 bg-white text-orange-600 hover:bg-orange-50 border border-orange-200 font-semibold h-12 rounded-2xl shadow-md"
              >
                🍳 Mark as Cooked
              </Button>
            )}
            {currentRank !== null && (
              <Button
                onClick={() => setShowRank(true)}
                className="bg-white text-orange-600 hover:bg-orange-50 border border-orange-200 font-semibold h-12 rounded-2xl shadow-md px-4"
              >
                <Trophy className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* Ingredients */}
        {grouped.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-gray-900 text-lg mb-3">Ingredients</h2>
            <div className="space-y-3">
              {grouped.map(({ category, items }) => (
                <div key={category} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                      <span>{CATEGORY_EMOJI[category] ?? '📦'}</span> {category}
                    </h3>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {items.map(ing => (
                      <li key={ing.id} className="px-4 py-2.5 flex items-center justify-between">
                        <span className="text-gray-900 text-sm">{ing.name}</span>
                        {(ing.quantity || ing.unit) && (
                          <span className="text-gray-400 text-sm font-medium">
                            {ing.quantity} {ing.unit}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        {recipe.instructions && (
          <div className="mb-6">
            <h2 className="font-bold text-gray-900 text-lg mb-3">Instructions</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{recipe.instructions}</p>
            </div>
          </div>
        )}

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {recipe.tags.map(tag => (
              <span key={tag} className="bg-orange-50 text-orange-600 rounded-full px-3 py-1 text-sm font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Cooking history */}
        {logs.length > 0 && (
          <div className="mb-6">
            <h2 className="font-bold text-gray-900 text-lg mb-3">Cooking History</h2>
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {editingLogId === log.id ? (
                      <input
                        type="date"
                        defaultValue={format(new Date(log.cooked_at), 'yyyy-MM-dd')}
                        autoFocus
                        onBlur={e => handleUpdateLogDate(log.id, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleUpdateLogDate(log.id, (e.target as HTMLInputElement).value)
                          if (e.key === 'Escape') setEditingLogId(null)
                        }}
                        className="text-sm text-gray-600 border border-orange-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingLogId(log.id)}
                        className="text-sm text-gray-600 hover:text-orange-500 transition-colors text-left"
                      >
                        {format(new Date(log.cooked_at), 'MMM d, yyyy')}
                      </button>
                    )}
                    {log.notes && <p className="text-xs text-gray-400 mt-0.5">{log.notes}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteLog(log.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCook && (
        <CookDialog
          recipeId={recipe.id}
          onClose={() => setShowCook(false)}
          onSaved={handleCookSaved}
          isAlreadyRanked={currentRank !== null}
        />
      )}

      {showRank && (
        <ComparisonDialog
          thisRecipe={{ id: recipe.id, name: recipe.name }}
          onClose={() => setShowRank(false)}
          onRanked={handleRanked}
        />
      )}
    </div>
  )
}
