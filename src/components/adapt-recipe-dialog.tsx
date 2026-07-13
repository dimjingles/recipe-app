'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCacheInvalidation } from '@/lib/queries/hooks'
import { Loader2, AlertTriangle, ArrowLeftRight, Minus, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { toast } from 'sonner'
import type { AdaptationType, AdaptedRecipeDraft } from '@/types/database'

const CATEGORY_EMOJI: Record<string, string> = {
  produce: '🥦', dairy: '🧀', meat: '🥩', seafood: '🐟',
  pantry: '🫙', spices: '🌿', bakery: '🍞', frozen: '🧊', other: '📦',
}

interface QuickAction {
  key: string
  label: string
  emoji: string
  type: AdaptationType
  request?: string
}

const DIETARY_ACTIONS: QuickAction[] = [
  { key: 'vegan', label: 'Make vegan', emoji: '🌱', type: 'dietary_swap', request: 'Make this recipe fully vegan (no meat, dairy, eggs, honey, or other animal products).' },
  { key: 'vegetarian', label: 'Make vegetarian', emoji: '🥕', type: 'dietary_swap', request: 'Make this recipe vegetarian (no meat, poultry, or seafood).' },
  { key: 'gluten-free', label: 'Make gluten-free', emoji: '🌾', type: 'dietary_swap', request: 'Make this recipe gluten-free (no wheat, barley, rye, or other gluten sources).' },
  { key: 'dairy-free', label: 'Make dairy-free', emoji: '🥛', type: 'dietary_swap', request: 'Make this recipe dairy-free (no milk, butter, cheese, cream, or other dairy).' },
]

type Mode = 'menu' | 'scale' | 'pantry' | 'freeform'

interface AdaptRecipeDialogProps {
  recipeId: string
  currentServings: number
  onClose: () => void
}

export default function AdaptRecipeDialog({ recipeId, currentServings, onClose }: AdaptRecipeDialogProps) {
  const router = useRouter()
  const invalidate = useCacheInvalidation()
  const [mode, setMode] = useState<Mode>('menu')
  const [targetServings, setTargetServings] = useState(Math.max(1, currentServings))
  const [pantryText, setPantryText] = useState('')
  const [freeformText, setFreeformText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<AdaptedRecipeDraft | null>(null)

  const generate = async (payload: {
    adaptation_type: AdaptationType
    request?: string
    target_servings?: number
    missing_ingredients?: string[]
  }) => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/recipes/${recipeId}/adapt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Adaptation failed')
      setDraft(data as AdaptedRecipeDraft)
    } catch (e) {
      toast.error((e as Error).message || 'Could not adapt recipe')
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          cuisine: draft.cuisine,
          cook_time_minutes: draft.cook_time_minutes,
          servings: draft.servings ?? currentServings,
          difficulty: draft.difficulty,
          instructions: draft.instructions,
          tags: draft.tags,
          ingredients: draft.ingredients.filter(i => i.name.trim()),
          original_recipe_id: draft.created_from_recipe_id,
          adaptation_metadata: {
            adaptation_type: draft.adaptation_type,
            user_request: draft.user_request,
            warnings: draft.warnings,
            substitution_notes: draft.substitution_notes,
            created_from_recipe_id: draft.created_from_recipe_id,
            created_from_name: draft.created_from_name,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to save')
      toast.success('Variant saved! 🎉')
      invalidate.recipesChanged()
      onClose()
      router.push(`/recipes/${data.id}`)
      router.refresh()
    } catch (e) {
      toast.error((e as Error).message || 'Could not save variant')
      setSaving(false)
    }
  }

  // ── Preview ────────────────────────────────────────────────────────────────
  if (draft) {
    return (
      <BottomSheet open onClose={onClose} zIndex="elevated" maxHeight="88vh">
        <div className="px-6 pb-10">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-brand" />
            <span className="text-xs font-semibold text-brand uppercase tracking-wide">Adaptation preview</span>
          </div>
          <h3 className="font-heading text-xl font-bold text-foreground leading-tight">{draft.name}</h3>
          {draft.description && (
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{draft.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {draft.servings ? <span>🍽️ {draft.servings} servings</span> : null}
            {draft.cook_time_minutes ? <span>⏱️ {draft.cook_time_minutes} min</span> : null}
            {draft.difficulty ? <span>{Array.from({ length: draft.difficulty }, () => '🔪').join('')}</span> : null}
          </div>

          {/* Warnings — always prominent so the cook can't miss them */}
          {draft.warnings.length > 0 && (
            <div className="mt-4 bg-cooking-subtle border border-cooking/30 rounded-xl p-3">
              <p className="text-xs font-semibold text-cooking-foreground uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Heads up
              </p>
              <ul className="space-y-1">
                {draft.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-cooking-foreground leading-snug">• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Substitution notes */}
          {draft.substitution_notes.length > 0 && (
            <div className="mt-3 bg-sage-subtle border border-sage/20 rounded-xl p-3">
              <p className="text-xs font-semibold text-sage uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <ArrowLeftRight className="w-3.5 h-3.5" /> Substitutions
              </p>
              <ul className="space-y-1">
                {draft.substitution_notes.map((s, i) => (
                  <li key={i} className="text-sm text-foreground leading-snug">• {s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Ingredients */}
          <div className="mt-4">
            <h4 className="font-heading font-bold text-foreground text-sm mb-2">Ingredients</h4>
            <ul className="bg-card rounded-xl border border-border divide-y divide-border/50 overflow-hidden">
              {draft.ingredients.map((ing, i) => (
                <li key={i} className="px-3 py-2 flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    <span className="mr-1.5">{CATEGORY_EMOJI[ing.category] ?? '📦'}</span>{ing.name}
                  </span>
                  {(ing.quantity || ing.unit) && (
                    <span className="text-muted-foreground font-medium">{ing.quantity} {ing.unit}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Instructions */}
          {draft.instructions && (
            <div className="mt-4">
              <h4 className="font-heading font-bold text-foreground text-sm mb-2">Instructions</h4>
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed bg-card rounded-xl border border-border p-3">
                {draft.instructions}
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-4">
            This will be saved as a <strong>new recipe</strong> linked to the original. Your original recipe is not changed.
          </p>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={() => setDraft(null)}
              variant="outline"
              disabled={saving}
              className="flex-1 h-12 rounded-2xl"
            >
              Back
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="flex-[2] bg-brand hover:bg-brand/90 text-brand-foreground h-12 rounded-2xl font-semibold"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {saving ? 'Saving…' : 'Save as new variant'}
            </Button>
          </div>
        </div>
      </BottomSheet>
    )
  }

  // ── Generating ─────────────────────────────────────────────────────────────
  if (generating) {
    return (
      <BottomSheet open onClose={onClose} zIndex="elevated">
        <div className="px-6 pb-12 pt-4 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand mx-auto mb-4" />
          <p className="text-foreground font-medium">Adapting your recipe…</p>
          <p className="text-sm text-muted-foreground mt-1">Claude is rewriting ingredients and steps.</p>
        </div>
      </BottomSheet>
    )
  }

  // ── Request menu ───────────────────────────────────────────────────────────
  return (
    <BottomSheet open onClose={onClose} zIndex="elevated" maxHeight="85vh">
      <div className="px-6 pb-10">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-brand" />
          <h3 className="font-heading text-lg font-bold text-foreground">Adapt recipe</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Transform this recipe into a new variant. The original stays untouched.
        </p>

        {mode === 'menu' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {DIETARY_ACTIONS.map(a => (
                <button
                  key={a.key}
                  onClick={() => generate({ adaptation_type: a.type, request: a.request })}
                  className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-3 text-sm font-medium text-foreground hover:border-brand hover:bg-brand-subtle active:scale-[0.98] transition-all"
                >
                  <span className="text-lg">{a.emoji}</span> {a.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('scale')}
                className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-3 text-sm font-medium text-foreground hover:border-brand hover:bg-brand-subtle active:scale-[0.98] transition-all"
              >
                <span className="text-lg">⚖️</span> Scale servings
              </button>
              <button
                onClick={() => setMode('pantry')}
                className="flex items-center gap-2 bg-card border border-border rounded-2xl px-3 py-3 text-sm font-medium text-foreground hover:border-brand hover:bg-brand-subtle active:scale-[0.98] transition-all"
              >
                <span className="text-lg">🧺</span> I don&apos;t have…
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Or describe a change</label>
              <textarea
                value={freeformText}
                onChange={e => setFreeformText(e.target.value)}
                placeholder="e.g. make it spicier, lower-carb, kid-friendly…"
                className="mt-1.5 w-full border border-border rounded-xl p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-brand/50 bg-card"
              />
              <Button
                onClick={() => generate({ adaptation_type: 'freeform', request: freeformText.trim() })}
                disabled={!freeformText.trim()}
                className="w-full mt-2 bg-brand hover:bg-brand/90 text-brand-foreground h-11 rounded-2xl font-semibold"
              >
                Adapt
              </Button>
            </div>
          </div>
        )}

        {mode === 'scale' && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Currently serves <strong>{currentServings}</strong>. We&apos;ll rescale quantities and adjust cook times and pan sizes where needed.
            </p>
            <div className="flex items-center justify-center gap-4 mb-5">
              <button
                onClick={() => setTargetServings(s => Math.max(1, s - 1))}
                className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-foreground hover:border-brand active:scale-95 transition-all"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="text-center min-w-[64px]">
                <div className="text-3xl font-bold text-foreground">{targetServings}</div>
                <div className="text-xs text-muted-foreground">servings</div>
              </div>
              <button
                onClick={() => setTargetServings(s => Math.min(100, s + 1))}
                className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-foreground hover:border-brand active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setMode('menu')} variant="outline" className="flex-1 h-12 rounded-2xl">Back</Button>
              <Button
                onClick={() => generate({ adaptation_type: 'portion_scaling', target_servings: targetServings })}
                disabled={targetServings === currentServings}
                className="flex-[2] bg-brand hover:bg-brand/90 text-brand-foreground h-12 rounded-2xl font-semibold"
              >
                Scale to {targetServings}
              </Button>
            </div>
          </div>
        )}

        {mode === 'pantry' && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              What are you missing? List the ingredients you don&apos;t have and we&apos;ll suggest swaps.
            </p>
            <Input
              value={pantryText}
              onChange={e => setPantryText(e.target.value)}
              placeholder="e.g. eggs, buttermilk"
              autoFocus
              className="bg-card"
              onKeyDown={e => {
                if (e.key === 'Enter' && pantryText.trim()) {
                  generate({
                    adaptation_type: 'pantry_substitution',
                    missing_ingredients: pantryText.split(',').map(s => s.trim()).filter(Boolean),
                    request: `I don't have: ${pantryText.trim()}`,
                  })
                }
              }}
            />
            <div className="flex gap-2 mt-4">
              <Button onClick={() => setMode('menu')} variant="outline" className="flex-1 h-12 rounded-2xl">Back</Button>
              <Button
                onClick={() => generate({
                  adaptation_type: 'pantry_substitution',
                  missing_ingredients: pantryText.split(',').map(s => s.trim()).filter(Boolean),
                  request: `I don't have: ${pantryText.trim()}`,
                })}
                disabled={!pantryText.trim()}
                className="flex-[2] bg-brand hover:bg-brand/90 text-brand-foreground h-12 rounded-2xl font-semibold"
              >
                Find substitutes
              </Button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
