'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { bucketScore, formatScore, FEEDBACK_OPTIONS, type Feedback } from '@/lib/scoring'

// Active-state styling for each feedback choice — green / yellow / red.
const FEEDBACK_ACTIVE: Record<Feedback, string> = {
  like: 'border-green-500 bg-green-50 text-green-700',
  okay: 'border-yellow-500 bg-yellow-50 text-yellow-700',
  dislike: 'border-red-500 bg-red-50 text-red-700',
}

// Shared like / okay / dislike picker — used everywhere the taste verdict is
// chosen (logging a cook, finishing guided cook mode, re-ranking) so it always
// looks and behaves the same.
export function FeedbackButtons({ value, onChange }: { value: Feedback | null; onChange: (f: Feedback) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {FEEDBACK_OPTIONS.map(opt => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-3 py-2.5 text-xs font-semibold transition-all active:scale-[0.97] ${
              active ? FEEDBACK_ACTIVE[opt.value] : 'border-border bg-card text-muted-foreground hover:border-brand/40'
            }`}
          >
            <span className="text-lg leading-none">{opt.emoji}</span>
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Comparison / Ranking Dialog ──────────────────────────────────────────────

interface RankedRecipe {
  id: string
  name: string
  cuisine: string | null
  rank: number
  feedback: Feedback | null
}

interface ComparisonDialogProps {
  thisRecipe: { id: string; name: string; feedback: Feedback | null }
  onClose: () => void
  onRanked: (rank: number) => void
}

export function ComparisonDialog({ thisRecipe, onClose, onRanked }: ComparisonDialogProps) {
  const [ranked, setRanked] = useState<RankedRecipe[] | null>(null)
  const [lo, setLo] = useState(0)
  const [hi, setHi] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useState(() => {
    // Only compare against recipes in the same like/okay/dislike tier.
    fetch(`/api/rankings?feedback=${thisRecipe.feedback ?? 'none'}`)
      .then(async r => {
        const body = await r.json()
        if (!r.ok || !Array.isArray(body)) {
          throw new Error(body?.error || 'Failed to load rankings')
        }
        return body as RankedRecipe[]
      })
      .then(data => {
        const others = data.filter(r => r.id !== thisRecipe.id)
        setRanked(others)
        setLo(0)
        setHi(others.length)
        setLoading(false)
        if (others.length === 0) saveRank(1)
      })
      .catch(err => {
        toast.error(err?.message || 'Could not load rankings')
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
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      onRanked(data.rank ?? position) // endpoint returns the new global rank
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
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Score {formatScore(bucketScore(mid, ranked.length, thisRecipe.feedback))}</p>
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

// ─── Rank Feedback Dialog ─────────────────────────────────────────────────────

// Ask for the like/okay/dislike verdict first, then hand the chosen tier off to
// the comparison. Shown both after marking a recipe cooked and when re-ranking,
// so the taste verdict is always confirmed before ranking against other recipes.
interface RankFeedbackDialogProps {
  initialFeedback: Feedback | null
  title?: string
  description?: string
  onClose: () => void
  onConfirm: (feedback: Feedback) => void
}

export function RankFeedbackDialog({
  initialFeedback,
  title = 'How was it?',
  description = "Confirm how you feel about this recipe, then we'll rank it.",
  onClose,
  onConfirm,
}: RankFeedbackDialogProps) {
  const [feedback, setFeedback] = useState<Feedback | null>(initialFeedback)

  return (
    <BottomSheet open onClose={onClose} zIndex="elevated">
      <div className="px-6 pb-10">
        <h3 className="font-heading text-lg font-bold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <div className="mb-6">
          <FeedbackButtons value={feedback} onChange={setFeedback} />
        </div>
        <Button
          onClick={() => feedback && onConfirm(feedback)}
          disabled={!feedback}
          className="w-full bg-brand hover:bg-brand/90 text-brand-foreground h-12 text-base"
        >
          {feedback ? 'Continue to ranking' : 'Pick one to continue'}
        </Button>
      </div>
    </BottomSheet>
  )
}

// ─── Rank Flow (ask feedback → compare) ───────────────────────────────────────

// The full post-cook / re-rank ranking flow: re-confirm the like/okay/dislike
// verdict (persisting any change), then rank head-to-head within that tier.
interface RankFlowProps {
  recipeId: string
  recipeName: string
  initialFeedback: Feedback | null
  feedbackTitle?: string
  feedbackDescription?: string
  onClose: () => void
  onRanked: (rank: number, feedback: Feedback) => void
}

export function RankFlow({
  recipeId,
  recipeName,
  initialFeedback,
  feedbackTitle,
  feedbackDescription,
  onClose,
  onRanked,
}: RankFlowProps) {
  // Once the verdict is confirmed we move on to the head-to-head comparison.
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const confirmFeedback = async (chosen: Feedback) => {
    if (chosen !== initialFeedback) {
      try {
        const res = await fetch(`/api/recipes/${recipeId}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback: chosen }),
        })
        if (!res.ok) throw new Error('Failed')
      } catch {
        toast.error('Could not save your rating')
        return
      }
    }
    setFeedback(chosen)
  }

  if (!feedback) {
    return (
      <RankFeedbackDialog
        initialFeedback={initialFeedback}
        title={feedbackTitle}
        description={feedbackDescription}
        onClose={onClose}
        onConfirm={confirmFeedback}
      />
    )
  }

  return (
    <ComparisonDialog
      thisRecipe={{ id: recipeId, name: recipeName, feedback }}
      onClose={onClose}
      onRanked={rank => onRanked(rank, feedback)}
    />
  )
}
