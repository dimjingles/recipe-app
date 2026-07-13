'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, Users, Edit, ChefHat, Trophy, X, BookOpen, Plus, Minus, Home, Play, Sparkles, GitBranch, Maximize2, Images, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { RecipeWithDetails, Cookbook, SkillProfile, Technique, InstructionStep } from '@/types/database'
import AdaptRecipeDialog from '@/components/adapt-recipe-dialog'
import RecipeGallery from '@/components/recipe-gallery'
import ChefAiChat from '@/components/chef-ai-chat'
import InstructionSteps from '@/components/instruction-steps'
import { isRecipeTechnique, resolveTechniqueState } from '@/lib/skills'
import { getCuisineEmoji } from '@/lib/cuisine-emoji'
import { useCacheInvalidation } from '@/lib/queries/hooks'
import { formatScore, FEEDBACK_ADJECTIVE, type Feedback } from '@/lib/scoring'
import { scaleQuantity } from '@/lib/servings'
import { FeedbackButtons, ComparisonDialog, RankFeedbackDialog } from '@/components/ranking-flow'

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
  initialFeedback: Feedback | null
  onClose: () => void
  onSaved: (feedback: Feedback) => void
}

function CookDialog({ recipeId, initialFeedback, onClose, onSaved }: CookDialogProps) {
  const [notes, setNotes] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(initialFeedback)
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
      // Persist the taste verdict alongside the cook, if the user set one.
      if (feedback !== initialFeedback) {
        await fetch(`/api/recipes/${recipeId}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback }),
        })
      }
      toast.success('Cooking logged! 🎉')
      onSaved(feedback!)
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

        {/* How was it? — required taste feedback that calibrates the score */}
        <div className="mb-5">
          <p className="text-sm font-medium text-foreground mb-2">
            How was it? <span className="text-destructive">*</span>
          </p>
          <FeedbackButtons value={feedback} onChange={setFeedback} />
        </div>

        <div className="mb-6">
          <p className="text-sm font-medium text-foreground mb-2">Notes (optional)</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="How did it turn out? Any tweaks?"
            className="w-full border border-border rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-brand/50 bg-card"
          />
        </div>
        <p className="text-xs text-brand bg-brand-subtle rounded-xl px-3 py-2 mb-4">
          After logging, you&apos;ll rank this against your other recipes.
        </p>
        <Button
          onClick={save}
          disabled={saving || !feedback}
          className="w-full bg-brand hover:bg-brand/90 text-brand-foreground h-12 text-base"
        >
          {saving ? 'Saving...' : feedback ? 'Log it!' : 'Rate it to log'}
        </Button>
      </div>
    </BottomSheet>
  )
}

// ─── Cookbook Dialog ──────────────────────────────────────────────────────────

interface CookbookDialogProps {
  recipeId: string
  allCookbooks: Cookbook[]
  initialSelectedIds: string[]
  onClose: () => void
  onSaved: (newIds: string[]) => void
  onCookbookCreated: (cookbook: Cookbook) => void
}

function CookbookDialog({
  recipeId,
  allCookbooks,
  initialSelectedIds,
  onClose,
  onSaved,
  onCookbookCreated,
}: CookbookDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds)
  const [showNewInput, setShowNewInput] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)

  const toggle = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const createNew = async () => {
    if (!newName.trim()) return
    setCreatingNew(true)
    try {
      const res = await fetch('/api/cookbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      onCookbookCreated(data)
      setSelectedIds(prev => [...prev, data.id])
      setNewName('')
      setShowNewInput(false)
      toast.success(`"${data.name}" created!`)
    } catch (e: any) {
      toast.error(e.message || 'Could not create cookbook')
    } finally {
      setCreatingNew(false)
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/recipes/${recipeId}/cookbooks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookbook_ids: selectedIds }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Cookbooks updated')
      onSaved(selectedIds)
      onClose()
    } catch {
      toast.error('Could not update cookbooks')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open onClose={onClose} zIndex="elevated" maxHeight="80vh">
      <div className="px-6 pb-8">
        <h3 className="font-heading text-lg font-bold text-foreground mb-4">Add to Cookbook</h3>

        {allCookbooks.length === 0 && !showNewInput && (
          <p className="text-sm text-muted-foreground mb-4">No cookbooks yet. Create one below.</p>
        )}

        {allCookbooks.length > 0 && (
          <div className="space-y-1 mb-4 max-h-60 overflow-y-auto -mx-1 px-1">
            {allCookbooks.map(cb => (
              <button
                key={cb.id}
                onClick={() => toggle(cb.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  selectedIds.includes(cb.id) ? 'bg-brand-subtle text-brand' : 'hover:bg-muted text-foreground'
                }`}
              >
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  selectedIds.includes(cb.id) ? 'bg-brand border-brand' : 'border-border'
                }`}>
                  {selectedIds.includes(cb.id) && (
                    <span className="text-brand-foreground text-[10px] font-bold">✓</span>
                  )}
                </span>
                <span className="flex-1 text-left">{cb.name}</span>
              </button>
            ))}
          </div>
        )}

        {showNewInput ? (
          <div className="flex gap-2 mb-4">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Cookbook name"
              autoFocus
              className="flex-1 bg-card"
              onKeyDown={e => {
                if (e.key === 'Enter') createNew()
                if (e.key === 'Escape') { setShowNewInput(false); setNewName('') }
              }}
            />
            <button
              onClick={createNew}
              disabled={creatingNew || !newName.trim()}
              className="bg-brand text-brand-foreground rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50 shrink-0"
            >
              {creatingNew ? '...' : 'Add'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewInput(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-brand hover:bg-brand-subtle rounded-xl transition-colors mb-4"
          >
            <Plus className="w-4 h-4" /> New cookbook
          </button>
        )}

        <Button
          onClick={save}
          disabled={saving}
          className="w-full bg-brand hover:bg-brand/90 text-brand-foreground h-12 text-base"
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </BottomSheet>
  )
}

// ─── Servings Control ─────────────────────────────────────────────────────────

/** Compact stepper that rescales the displayed ingredient amounts. Purely a view
 *  adjustment — it never writes to the stored recipe. */
function ServingsControl({
  servings,
  base,
  onChange,
}: {
  servings: number
  base: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      {servings !== base && (
        <button
          onClick={() => onChange(base)}
          className="text-xs font-medium text-brand hover:underline"
        >
          Reset
        </button>
      )}
      <div className="flex items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-sm">
        <button
          onClick={() => onChange(Math.max(1, servings - 1))}
          aria-label="Fewer servings"
          className="flex h-7 w-7 items-center justify-center rounded-full text-foreground hover:bg-muted active:scale-95 transition-all"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="flex min-w-[52px] items-center justify-center gap-1 px-1 text-sm font-semibold tabular-nums text-foreground">
          <Users className="h-3.5 w-3.5 text-muted-foreground" /> {servings}
        </span>
        <button
          onClick={() => onChange(Math.min(100, servings + 1))}
          aria-label="More servings"
          className="flex h-7 w-7 items-center justify-center rounded-full text-foreground hover:bg-muted active:scale-95 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

/** A sibling recipe adapted from this one (or the original this was adapted from). */
export interface RecipeVariantLink {
  id: string
  name: string
  cuisine: string | null
  adaptation_type: string | null
}

export default function RecipeDetail({
  recipe,
  initialCookbooks,
  skillProfile,
  techniques,
  isOwner = true,
  hasHousehold = false,
  readOnly = false,
  variants = [],
  score,
}: {
  recipe: RecipeWithDetails
  initialCookbooks: Cookbook[]
  skillProfile?: SkillProfile | null
  techniques?: Technique[]
  isOwner?: boolean
  hasHousehold?: boolean
  readOnly?: boolean
  variants?: RecipeVariantLink[]
  score: number | null
}) {
  const router = useRouter()
  const invalidate = useCacheInvalidation()
  // Converted pages (home/recipes/planner/cookbooks) render from the client
  // query cache, so a refresh of this server-rendered page alone isn't enough.
  const refreshEverywhere = () => {
    invalidate.recipesChanged()
    router.refresh()
  }
  const [showCook, setShowCook] = useState(false)
  const [showRerankFeedback, setShowRerankFeedback] = useState(false)
  const [showRank, setShowRank] = useState(false)
  const [showCookbook, setShowCookbook] = useState(false)
  const [showChefAi, setShowChefAi] = useState(false)
  const [showAdapt, setShowAdapt] = useState(false)
  const [chefInitialPrompt, setChefInitialPrompt] = useState<string | undefined>(undefined)
  const [cookedCount, setCookedCount] = useState(recipe.cooked_count)
  // Live servings adjuster — rescales displayed ingredient amounts only.
  const baseServings = recipe.servings || 4
  const [servings, setServings] = useState(baseServings)
  const scaleFactor = servings / baseServings
  const [currentRank, setCurrentRank] = useState<number | null>(recipe.rank)
  const [currentFeedback, setCurrentFeedback] = useState<Feedback | null>(recipe.feedback)
  const [ownerScope, setOwnerScope] = useState<string>((recipe as { owner_scope?: string }).owner_scope ?? 'user')
  const [sharing, setSharing] = useState(false)
  // ── Display (hero) image + gallery — shared state so a gallery photo can
  //    be promoted to the hero shown at the top of the page. ──────────────
  const [heroUrl, setHeroUrl] = useState<string | null>(recipe.image_url)
  const [galleryImages, setGalleryImages] = useState<string[]>(recipe.gallery_images ?? [])
  const [heroMenu, setHeroMenu] = useState(false) // action sheet when the hero is tapped
  const [heroLightbox, setHeroLightbox] = useState(false) // full-screen shaded view
  const [showChooser, setShowChooser] = useState(false) // "choose a different display image"

  const setAsDisplay = async (url: string) => {
    const prev = heroUrl
    setHeroUrl(url) // optimistic
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: url }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      toast.success('Display image updated')
    } catch (e: any) {
      setHeroUrl(prev) // revert
      toast.error(e.message || 'Could not update display image')
    }
  }

  const toggleHouseholdShare = async () => {
    const next = ownerScope !== 'household'
    setSharing(true)
    try {
      const res = await fetch(`/api/recipes/${recipe.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: next }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      setOwnerScope(next ? 'household' : 'user')
      toast.success(next ? 'Shared with your household' : 'Now personal again')
      refreshEverywhere()
    } catch (e: any) {
      toast.error(e.message || 'Could not update sharing')
    } finally {
      setSharing(false)
    }
  }

  const [cookbooks, setCookbooks] = useState<Cookbook[]>(initialCookbooks)
  const [cookbookIds, setCookbookIds] = useState<string[]>(
    (recipe.cookbook_recipes || []).map(cr => cr.cookbook_id)
  )
  const [logs, setLogs] = useState(
    (recipe.cooking_log || [])
      .sort((a, b) => new Date(b.cooked_at).getTime() - new Date(a.cooked_at).getTime())
      .slice(0, 5)
  )
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const grouped = groupIngredients(recipe.ingredients || [])
  const techniquesMap = new Map((techniques || []).filter(isRecipeTechnique).map(t => [t.key, t]))
  const recipeTechniqueKeys = (recipe.techniques || []).filter(key => techniquesMap.has(key))
  const masteredTechniques = skillProfile?.techniques_mastered ?? []

  // After logging a cook, always rank it against the other recipes — same as the
  // re-rank flow. The taste verdict was just chosen in the cook dialog.
  const handleCookSaved = (feedback: Feedback) => {
    setCookedCount(c => c + 1)
    setCurrentFeedback(feedback)
    setShowRank(true)
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
      refreshEverywhere()
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
      refreshEverywhere()
    }
  }

  // Re-rank: the user re-confirms their like/okay/dislike verdict, we persist any
  // change, then open the head-to-head comparison within that tier.
  const handleRerankFeedback = async (feedback: Feedback) => {
    setShowRerankFeedback(false)
    if (feedback !== currentFeedback) {
      try {
        const res = await fetch(`/api/recipes/${recipe.id}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback }),
        })
        if (!res.ok) throw new Error('Failed')
      } catch {
        toast.error('Could not save your rating')
        return
      }
    }
    setCurrentFeedback(feedback)
    setShowRank(true)
  }

  const handleRanked = (rank: number) => {
    setCurrentRank(rank)
    toast.success(
      currentFeedback
        ? `Ranked among your ${FEEDBACK_ADJECTIVE[currentFeedback]} recipes 🏆`
        : 'Ranked! 🏆'
    )
    refreshEverywhere()
  }

  const emoji = getCuisineEmoji(recipe.cuisine)
  const adaptedFrom = recipe.adaptation_metadata

  return (
    <div className="max-w-lg mx-auto pb-8">

      {/* ── Hero: the selected display image ─────────────────────────── */}
      {heroUrl && (
        <div className="relative">
          <button
            type="button"
            onClick={() => (readOnly ? setHeroLightbox(true) : setHeroMenu(true))}
            className="block w-full active:opacity-95 transition-opacity"
            aria-label="Recipe display image"
          >
            <img
              src={heroUrl}
              alt={recipe.name}
              className="w-full h-auto"
            />
          </button>
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-5">
            <Link href="/recipes" className="text-white/90 hover:text-white bg-black/20 rounded-full p-1.5">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            {!readOnly && (
              <Link href={`/recipes/${recipe.id}/edit`} className="text-white/90 hover:text-white bg-black/20 rounded-full p-1.5">
                <Edit className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ── Header band (with image = gradient; without = warm-white) ── */}
      {heroUrl ? (
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
            {cookedCount > 0 && (
              <span className="flex items-center gap-1 text-white/90 text-sm">
                <ChefHat className="w-3.5 h-3.5" /> Cooked {cookedCount}×
              </span>
            )}
            {score !== null && (
              <span className="flex items-center gap-1 text-white font-semibold text-sm">
                <Trophy className="w-3.5 h-3.5" /> {formatScore(score)}
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
            {!readOnly && (
              <Link href={`/recipes/${recipe.id}/edit`} className="text-muted-foreground hover:text-foreground p-2 active:scale-[0.95] transition-all">
                <Edit className="w-4 h-4" />
              </Link>
            )}
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
            {cookedCount > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground text-sm">
                <ChefHat className="w-3.5 h-3.5" /> Cooked {cookedCount}×
              </span>
            )}
            {score !== null && (
              <span className="flex items-center gap-1 text-brand font-semibold text-sm">
                <Trophy className="w-3.5 h-3.5" /> {formatScore(score)}
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
      <div className={`px-4 ${heroUrl ? '-mt-4' : 'mt-4'}`}>
        {/* Adapted-from banner (shown on variants) */}
        {adaptedFrom && (
          <Link
            href={`/recipes/${adaptedFrom.created_from_recipe_id}`}
            className="flex items-center gap-2 mb-4 bg-sage-subtle border border-sage/20 rounded-xl px-3 py-2 text-sm text-sage hover:bg-sage/10 transition-colors"
          >
            <GitBranch className="w-4 h-4 shrink-0" />
            <span className="flex-1 min-w-0 truncate">
              Adapted from <strong className="font-semibold">{adaptedFrom.created_from_name}</strong>
            </span>
          </Link>
        )}

        {/* Guided cook mode — primary CTA when the recipe has steps */}
        {!readOnly && recipe.instructions && (
          <Link
            href={`/recipes/${recipe.id}/cook`}
            className="mb-3 flex items-center justify-center gap-2 w-full bg-brand text-brand-foreground hover:bg-brand/90 font-semibold h-14 rounded-2xl shadow-md active:scale-[0.98] transition-all text-base"
          >
            <Play className="w-5 h-5" /> Start Cooking
          </Link>
        )}

        {/* Action buttons */}
        {!readOnly && (
        <div className="flex gap-2 mb-3">
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
              onClick={() => setShowRerankFeedback(true)}
              className="bg-card text-brand hover:bg-brand-subtle border border-brand/30 font-semibold h-12 rounded-2xl shadow-md px-4 active:scale-[0.98] transition-all"
            >
              <Trophy className="w-4 h-4" />
            </Button>
          )}
          <Button
            onClick={() => setShowCookbook(true)}
            className={`bg-card border font-semibold h-12 rounded-2xl shadow-md px-4 active:scale-[0.98] transition-all ${
              cookbookIds.length > 0
                ? 'text-brand border-brand/30 hover:bg-brand-subtle'
                : 'text-muted-foreground border-border hover:border-brand hover:text-brand'
            }`}
            title={cookbookIds.length > 0 ? `In ${cookbookIds.length} cookbook${cookbookIds.length > 1 ? 's' : ''}` : 'Add to cookbook'}
          >
            <BookOpen className="w-4 h-4" />
          </Button>
        </div>
        )}

        {/* Household sharing */}
        {isOwner && hasHousehold ? (
          <button
            onClick={toggleHouseholdShare}
            disabled={sharing}
            className={`mb-6 flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60 ${
              ownerScope === 'household'
                ? 'border-sage/30 bg-sage-subtle text-sage'
                : 'border-border bg-card text-muted-foreground hover:border-brand hover:text-brand'
            }`}
          >
            <Home className="h-4 w-4" />
            {ownerScope === 'household' ? 'Shared with household · tap to make personal' : 'Share with household'}
          </button>
        ) : ownerScope === 'household' ? (
          <div className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-sage/30 bg-sage-subtle px-4 py-3 text-sm font-semibold text-sage">
            <Home className="h-4 w-4" /> Shared with household
          </div>
        ) : null}

        {/* Adapt recipe — AI variant generator */}
        {!readOnly && (
          <Button
            onClick={() => setShowAdapt(true)}
            className="w-full mb-6 bg-brand-subtle text-brand hover:bg-brand/15 border border-brand/30 font-semibold h-12 rounded-2xl active:scale-[0.98] transition-all"
          >
            <Sparkles className="w-4 h-4" /> Adapt recipe
          </Button>
        )}

        {/* Techniques */}
        {recipeTechniqueKeys.length > 0 && techniquesMap.size > 0 && (
          <div className="mb-6">
            <h2 className="font-heading font-bold text-foreground text-lg mb-3">Techniques</h2>
            <div className="flex flex-wrap gap-2">
              {recipeTechniqueKeys.map(key => {
                const technique = techniquesMap.get(key)
                if (!technique) return null
                const state = resolveTechniqueState(key, technique.prerequisites, masteredTechniques)
                const className = state === 'mastered'
                  ? 'bg-sage-subtle text-sage border-sage/30'
                  : state === 'unlocked'
                    ? 'bg-cooking-subtle text-cooking border-cooking/30'
                    : 'bg-muted text-muted-foreground border-border opacity-70'
                const prefix = state === 'mastered' ? '✓ ' : state === 'unlocked' ? '○ ' : '🔒 '
                return (
                  <Link
                    key={key}
                    href={`/skills#${key}`}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${className}`}
                    title={state === 'mastered' ? 'You know this' : state === 'unlocked' ? 'Ready to learn' : 'Locked - learn prerequisites first'}
                  >
                    {prefix}{technique.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Ingredients — sage accent */}
        {grouped.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-heading font-bold text-foreground text-lg">Ingredients</h2>
              <ServingsControl servings={servings} base={baseServings} onChange={setServings} />
            </div>
            {servings !== baseServings && (
              <p className="text-xs text-muted-foreground mb-3">
                Amounts scaled for {servings} servings (recipe makes {baseServings}).
              </p>
            )}
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
                            {scaleQuantity(ing.quantity, scaleFactor)} {ing.unit}
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
            <InstructionSteps
              steps={recipe.instruction_steps as InstructionStep[] | null}
              rawInstructions={recipe.instructions}
              ingredients={recipe.ingredients}
              onAskChef={(step) => {
                setChefInitialPrompt(
                  `I'm on step ${step.n} and I need help understanding it. Can you explain it clearly?\n\nStep ${step.n}: ${step.text}`
                )
                setShowChefAi(true)
              }}
            />
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

        {/* Variants — recipes adapted from this one */}
        {variants.length > 0 && (
          <div className="mb-6">
            <h2 className="font-heading font-bold text-foreground text-lg mb-3 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-brand" /> Variants
            </h2>
            <div className="space-y-2">
              {variants.map(v => (
                <Link
                  key={v.id}
                  href={`/recipes/${v.id}`}
                  className="flex items-center justify-between gap-2 bg-card border border-border rounded-2xl shadow-sm px-4 py-3 hover:border-brand/40 hover:bg-brand-subtle/40 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{getCuisineEmoji(v.cuisine)}</span>
                    <span className="text-sm font-medium text-foreground truncate">{v.name}</span>
                  </div>
                  {v.adaptation_type && (
                    <span className="text-[10px] font-semibold text-brand bg-brand-subtle rounded-full px-2 py-0.5 uppercase tracking-wide shrink-0">
                      {v.adaptation_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Photos gallery — sits between the instructions and cooking history.
            Promoting a photo here updates the display image shown at the top. */}
        <RecipeGallery
          recipeId={recipe.id}
          recipeName={recipe.name}
          images={galleryImages}
          onImagesChange={setGalleryImages}
          heroUrl={heroUrl}
          onSetHero={setAsDisplay}
          readOnly={readOnly}
        />

        {/* Cooking history — amber accent */}
        {!readOnly && logs.length > 0 && (
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
          initialFeedback={currentFeedback}
          onClose={() => setShowCook(false)}
          onSaved={handleCookSaved}
        />
      )}

      {showRerankFeedback && (
        <RankFeedbackDialog
          initialFeedback={currentFeedback}
          onClose={() => setShowRerankFeedback(false)}
          onConfirm={handleRerankFeedback}
        />
      )}

      {showRank && (
        <ComparisonDialog
          thisRecipe={{ id: recipe.id, name: recipe.name, feedback: currentFeedback }}
          onClose={() => setShowRank(false)}
          onRanked={handleRanked}
        />
      )}

      <ChefAiChat
        recipeId={recipe.id}
        open={showChefAi}
        onClose={() => setShowChefAi(false)}
        initialPrompt={chefInitialPrompt}
      />

      {showAdapt && (
        <AdaptRecipeDialog
          recipeId={recipe.id}
          currentServings={recipe.servings || 4}
          onClose={() => setShowAdapt(false)}
        />
      )}

      {showCookbook && (
        <CookbookDialog
          recipeId={recipe.id}
          allCookbooks={cookbooks}
          initialSelectedIds={cookbookIds}
          onClose={() => setShowCookbook(false)}
          onSaved={(newIds) => {
            setCookbookIds(newIds)
            refreshEverywhere()
          }}
          onCookbookCreated={(cb) => setCookbooks(prev => [...prev, cb])}
        />
      )}

      {/* Tapping the display image → view it full-screen, or swap it out */}
      {heroMenu && (
        <BottomSheet open onClose={() => setHeroMenu(false)} zIndex="elevated">
          <div className="px-6 pb-10">
            <h3 className="font-heading text-lg font-bold text-foreground mb-4">Display image</h3>
            <div className="space-y-2">
              <button
                onClick={() => { setHeroMenu(false); setHeroLightbox(true) }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-card hover:bg-muted text-foreground text-sm font-medium active:scale-[0.99] transition-all"
              >
                <Maximize2 className="w-4 h-4 text-brand" /> View photo
              </button>
              {!readOnly && (
                <button
                  onClick={() => { setHeroMenu(false); setShowChooser(true) }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-card hover:bg-muted text-foreground text-sm font-medium active:scale-[0.99] transition-all"
                >
                  <Images className="w-4 h-4 text-brand" /> Choose a different display image
                </button>
              )}
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Choose which gallery photo is the display image */}
      {showChooser && (
        <BottomSheet open onClose={() => setShowChooser(false)} zIndex="elevated" maxHeight="80vh">
          <div className="px-6 pb-10">
            <h3 className="font-heading text-lg font-bold text-foreground mb-1">Choose display image</h3>
            <p className="text-sm text-muted-foreground mb-4">Pick a photo from your gallery to feature at the top.</p>
            {galleryImages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No photos yet. Add some in the Photos section first.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {galleryImages.map(url => {
                  const active = url === heroUrl
                  return (
                    <button
                      key={url}
                      onClick={() => { setAsDisplay(url); setShowChooser(false) }}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 active:scale-[0.97] transition-all ${active ? 'border-brand' : 'border-border'}`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {active && (
                        <span className="absolute inset-0 bg-brand/20 flex items-center justify-center">
                          <span className="bg-brand text-brand-foreground rounded-full p-1"><Check className="w-4 h-4" /></span>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </BottomSheet>
      )}

      {/* Full-screen shaded view of the display image */}
      {heroLightbox && heroUrl && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={() => setHeroLightbox(false)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white active:scale-[0.95] transition-all"><X className="w-6 h-6" /></button>
          <img src={heroUrl} alt={recipe.name} className="max-w-full max-h-full rounded-xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
