'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, Users, Edit, ChefHat, Trophy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { RecipeWithDetails } from '@/types/database'
import RecipeGallery from '@/components/recipe-gallery'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'

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

// ─── Cook Dialog ─────────────────────────────────────────────────────────────

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
    <BottomSheet open onClose={onClose} zIndex="elevated">
      <div className="px-6 pb-10">
        <h3 className="font-heading text-lg font-bold text-foreground mb-4">Log Cooking Session</h3>
        <div className="mb-6">
          <p className="text-sm font-medium text-foreground mb-2">Notes (optional)</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How did it turn out? Any tweaks?"
            className="w-full border border-border rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-brand/50 bg-card"
          />
        </div>
        {!isAlreadyRanked && (
          <p className="text-xs text-brand bg-brand-subtle rounded-xl px-3 py-2 mb-4">
            After logging, you'll rank this against your other recipes.
          </p>
        )}
        <Button
          onClick={save}
          disabled={saving}
          className="w-full bg-brand hover:bg-brand/90 text-brand-foreground h-12 text-base"
        >
          {saving ? 'Saving...' : 'Log it!'}
        </Button>
      </div>
    </BottomSheet>
  )
}

// ─── Comparison / Ranking Dialog ──────────────────────────────────────────────

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

  useState(() => {
    fetch('/api/rankings')
      .then(r => r.json())
      .then((data: RankedRecipe[]) => {
        const others = data.filter(r => r.id !== thisRecipe.id)
        setRanked(others)
        setLo(0)
        setHi(others.length)
        setLoading(false)
        if (others.length === 0) saveRank(1)
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
    if (newLo >= newHi) saveRank(newLo + 1)
    else { setLo(newLo); setHi(newHi) }
  }

  const mid = ranked ? Math.floor((lo + hi) / 2) : 0
  const opponent = ranked?.[mid]

  if (loading || !ranked) {
    return (
      <BottomSheet open onClose={onClose} zIndex="elevated">
        <div className="px-6 pb-10">
          <p className="text-center text-muted-foreground py-8">Loading rankings…</p>
        </div>
      </BottomSheet>
    )
  }

  if (saving) {
    return (
      <BottomSheet open onClose={onClose} zIndex="elevated">
        <div className="px-6 pb-10">
          <p className="text-center text-muted-foreground py-8">Saving your ranking…</p>
        </div>
      </BottomSheet>
    )
  }

  if (!opponent) return null

  const total = ranked.length
  const step = Math.ceil(Math.log2(total + 1)) - Math.ceil(Math.log2(hi - lo + 1)) + 1
  const totalSteps = Math.ceil(Math.log2(total + 1))

  return (
    <BottomSheet open onClose={onClose} zIndex="default">
      <div className="px-6 pb-10">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-heading text-lg font-bold text-foreground">Rank this recipe</h3>
          <span className="text-xs text-muted-foreground">{step}/{totalSteps}</span>
        </div>
        <p className="text-sm text-muted-foreground mb-6">Which did you like better?</p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => choose(true)}
            className="bg-brand-subtle border-2 border-brand/30 hover:border-brand hover:bg-brand/10 active:scale-[0.97] transition-all rounded-2xl p-4 text-left"
          >
            <p className="text-xs text-brand font-medium uppercase tracking-wide mb-1">This one</p>
            <p className="font-semibold text-foreground text-sm leading-snug">{thisRecipe.name}</p>
          </button>
          <button
            onClick={() => choose(false)}
            className="bg-muted border-2 border-border hover:border-muted-foreground hover:bg-border active:scale-[0.97] transition-all rounded-2xl p-4 text-left"
          >
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">#{opponent.rank}</p>
            <p className="font-semibold text-foreground text-sm leading-snug">{opponent.name}</p>
          </button>
        </div>

        <button onClick={onClose} className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground">
          Skip for now
        </button>
      </div>
    </BottomSheet>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

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

  const emoji = getCuisineEmoji(recipe.cuisine)

  return (
    <div className="max-w-lg mx-auto pb-8">

      {/* ── Hero: with image ─────────────────────────────────────────── */}
      {recipe.image_url && (
        <div className="relative">
          <img
            src={recipe.image_url}
            alt={recipe.name}
            className="w-full h-56 object-cover"
          />
          {/* Soft fade into the header band below */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-brand/70 to-transparent" />
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-5">
            <Link href="/recipes" className="text-white/90 hover:text-white bg-black/20 rounded-full p-1.5">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href={`/recipes/${recipe.id}/edit`} className="text-white/90 hover:text-white bg-black/20 rounded-full p-1.5">
              <Edit className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* ── Header band (with image = gradient; without = warm-white) ── */}
      {recipe.image_url ? (
        /* Gradient header — only shown when there IS a hero image */
        <div className="bg-gradient-to-br from-brand to-cooking/80 px-4 pt-3 pb-8">
          <h1 className="font-heading text-2xl font-bold text-white leading-tight">{recipe.name}</h1>
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
            {recipe.difficulty && (
              <span className="flex items-center gap-0.5 text-white/90 text-sm" title={['Easy', 'Medium', 'Hard'][recipe.difficulty - 1]}>
                {Array.from({ length: recipe.difficulty }, (_, i) => <span key={i}>🔪</span>)}
              </span>
            )}
          </div>
        </div>
      ) : (
        /* Warm-white header — shown when there is NO hero image */
        <div className="bg-card border-b border-border px-4 pt-5 pb-6">
          <div className="flex items-center justify-between mb-4">
            <Link href="/recipes" className="text-muted-foreground hover:text-foreground p-1 -ml-1 active:scale-[0.95] transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href={`/recipes/${recipe.id}/edit`} className="text-muted-foreground hover:text-foreground p-2 active:scale-[0.95] transition-all">
              <Edit className="w-4 h-4" />
            </Link>
          </div>
          {/* Large emoji + title */}
          <div className="flex items-start gap-4">
            <span className="text-5xl">{emoji}</span>
            <div className="flex-1 min-w-0">
              <h1 className="font-heading text-2xl font-bold text-foreground leading-tight">{recipe.name}</h1>
              {recipe.description && (
                <p className="text-muted-foreground text-sm mt-2 leading-relaxed">{recipe.description}</p>
              )}
            </div>
          </div>
          {/* Meta pills */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            {recipe.cuisine && (
              <span className="bg-brand-subtle text-brand rounded-full px-3 py-1 text-xs font-medium capitalize">{recipe.cuisine}</span>
            )}
            {recipe.cook_time_minutes && (
              <span className="flex items-center gap-1 text-muted-foreground text-sm">
                <Clock className="w-3.5 h-3.5" /> {recipe.cook_time_minutes} min
              </span>
            )}
            {recipe.servings && (
              <span className="flex items-center gap-1 text-muted-foreground text-sm">
                <Users className="w-3.5 h-3.5" /> {recipe.servings} servings
              </span>
            )}
            {cookedCount > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground text-sm">
                <ChefHat className="w-3.5 h-3.5" /> Cooked {cookedCount}×
              </span>
            )}
            {currentRank !== null && (
              <span className="flex items-center gap-1 text-brand font-semibold text-sm">
                <Trophy className="w-3.5 h-3.5" /> Ranked #{currentRank}
              </span>
            )}
            {recipe.difficulty && (
              <span className="flex items-center gap-0.5 text-muted-foreground text-sm" title={['Easy', 'Medium', 'Hard'][recipe.difficulty - 1]}>
                {Array.from({ length: recipe.difficulty }, (_, i) => <span key={i}>🔪</span>)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Content (pulled up over gradient, or flush after warm header) ── */}
      <div className={`px-4 ${recipe.image_url ? '-mt-4' : 'mt-4'}`}>
        {/* Action buttons */}
        {(cookedCount === 0 || currentRank !== null) && (
          <div className="flex gap-2 mb-6">
            {cookedCount === 0 && (
              <Button
                onClick={() => setShowCook(true)}
                className="flex-1 bg-card text-brand hover:bg-brand-subtle border border-brand/30 font-semibold h-12 rounded-2xl shadow-md active:scale-[0.98] transition-all"
              >
                🍳 Mark as Cooked
              </Button>
            )}
            {currentRank !== null && (
              <Button
                onClick={() => setShowRank(true)}
                className="bg-card text-brand hover:bg-brand-subtle border border-brand/30 font-semibold h-12 rounded-2xl shadow-md px-4 active:scale-[0.98] transition-all"
              >
                <Trophy className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* Gallery */}
        <RecipeGallery
          recipeId={recipe.id}
          initialImages={recipe.gallery_images ?? []}
        />

        {/* Ingredients — sage accent */}
        {grouped.length > 0 && (
          <div className="mb-6">
            <h2 className="font-heading font-bold text-foreground text-lg mb-3">Ingredients</h2>
            <div className="space-y-3">
              {grouped.map(({ category, items }) => (
                <div key={category} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  {/* Sage-tinted category header */}
                  <div className="px-4 py-2 bg-sage-subtle border-b border-sage/15">
                    <h3 className="text-xs font-semibold text-sage uppercase tracking-wide flex items-center gap-1.5">
                      <span>{CATEGORY_EMOJI[category] ?? '📦'}</span> {category}
                    </h3>
                  </div>
                  <ul className="divide-y divide-border/50">
                    {items.map(ing => (
                      <li key={ing.id} className="px-4 py-2.5 flex items-center justify-between">
                        <span className="text-foreground text-sm">{ing.name}</span>
                        {(ing.quantity || ing.unit) && (
                          <span className="text-muted-foreground text-sm font-medium">
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
            <h2 className="font-heading font-bold text-foreground text-lg mb-3">Instructions</h2>
            <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
              <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">{recipe.instructions}</p>
            </div>
          </div>
        )}

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {recipe.tags.map(tag => (
              <span key={tag} className="bg-brand-subtle text-brand rounded-full px-3 py-1 text-sm font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Cooking history — amber accent */}
        {logs.length > 0 && (
          <div className="mb-6">
            <h2 className="font-heading font-bold text-foreground text-lg mb-3">Cooking History</h2>
            <div className="space-y-2">
              {logs.map(log => (
                <div
                  key={log.id}
                  onClick={() => editingLogId !== log.id && setEditingLogId(log.id)}
                  className="bg-cooking-subtle border-l-4 border-cooking rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-cooking/10 active:scale-[0.99] transition-all"
                >
                  <div className="flex-1 min-w-0">
                    {editingLogId === log.id ? (
                      <input
                        type="date"
                        defaultValue={format(new Date(log.cooked_at), 'yyyy-MM-dd')}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        onBlur={e => handleUpdateLogDate(log.id, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleUpdateLogDate(log.id, (e.target as HTMLInputElement).value)
                          if (e.key === 'Escape') setEditingLogId(null)
                        }}
                        className="text-sm text-foreground border border-cooking rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-cooking/50 bg-card"
                      />
                    ) : (
                      <p className="text-sm font-medium text-cooking-foreground">{format(new Date(log.cooked_at), 'MMM d, yyyy')}</p>
                    )}
                    {log.notes && <p className="text-xs text-muted-foreground mt-0.5">{log.notes}</p>}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteLog(log.id) }}
                    className="text-cooking/40 hover:text-destructive transition-colors shrink-0"
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
