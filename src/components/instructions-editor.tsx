'use client'

/**
 * Step-based instructions editor.
 *
 * Instead of one free-text box, instructions are edited as a numbered list of
 * discrete steps that can be added, removed, and reordered. This is the same
 * shape used to render a saved recipe, so AI-generated instructions (which come
 * back as a numbered blob) are split into separate steps the moment they land
 * in the editor — see `textToSteps` in the parent forms.
 *
 * Editing model: a step shows a highlighted preview (via `tokenizeStep`) until
 * you tap it, which swaps in a plain textarea. Clicking out (blur) re-formats
 * the step — quantities, times, temperatures, doneness cues, and ingredient
 * names get highlighted automatically, using the same logic the recipe view
 * uses. The canonical value stays a plain string per step; the parent joins
 * them back into `recipes.instructions` on save.
 */

import { useEffect, useRef, useState } from 'react'
import { Sparkles, Loader2, Plus, X, ArrowUp, ArrowDown, ChefHat } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { tokenizeStep } from '@/lib/instructions'
import { renderStepTokens } from '@/components/step-tokens'

interface InstructionsEditorProps {
  /** One plain-text string per step (empty strings allowed while editing). */
  steps: string[]
  onStepsChange: (steps: string[]) => void
  /** Ingredient names used to highlight ingredient mentions on blur. */
  ingredientNames?: string[]
  /** Optional "Generate with AI" action rendered in the section header. */
  onGenerate?: () => void
  /** True while AI generation / fill is in flight (disables + shows spinner). */
  generating?: boolean
  /** Disable the generate action (e.g. no recipe name yet). */
  generateDisabled?: boolean
}

export default function InstructionsEditor({
  steps,
  onStepsChange,
  ingredientNames = [],
  onGenerate,
  generating = false,
  generateDisabled = false,
}: InstructionsEditorProps) {
  const [editing, setEditing] = useState<number | null>(null)

  const updateStep = (i: number, value: string) =>
    onStepsChange(steps.map((s, idx) => (idx === i ? value : s)))

  const addStep = () => {
    onStepsChange([...steps, ''])
    setEditing(steps.length) // focus the new (last) step
  }

  const removeStep = (i: number) => {
    onStepsChange(steps.filter((_, idx) => idx !== i))
    setEditing(null)
  }

  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= steps.length) return
    const next = [...steps]
    ;[next[i], next[j]] = [next[j], next[i]]
    onStepsChange(next)
    setEditing(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-gray-700 font-medium">Instructions</Label>
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            disabled={generating || generateDisabled}
            className="text-sm text-orange-500 font-medium flex items-center gap-1 hover:text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {generating ? 'Generating…' : 'Generate with AI'}
          </button>
        )}
      </div>

      {steps.length === 0 ? (
        <button
          type="button"
          onClick={addStep}
          className="w-full text-center py-5 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors"
        >
          <Plus className="w-4 h-4 inline mr-1 -mt-0.5" />
          Add the first step{onGenerate ? ' — or generate them with AI' : ''}
        </button>
      ) : (
        <ol className="space-y-2 list-none">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold mt-1.5">
                {i + 1}
              </span>

              <div className="flex-1 min-w-0">
                {editing === i ? (
                  <StepTextarea
                    value={step}
                    onChange={value => updateStep(i, value)}
                    onBlur={() => setEditing(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(i)}
                    className="w-full text-left bg-white rounded-xl border border-border shadow-sm px-3 py-2.5 text-sm leading-relaxed text-foreground hover:border-orange-300 transition-colors"
                  >
                    {step.trim()
                      ? renderStepTokens(tokenizeStep(step, ingredientNames))
                      : <span className="text-gray-400">Tap to write this step…</span>}
                  </button>
                )}
              </div>

              <div className="flex flex-col items-center gap-0.5 pt-1">
                <button
                  type="button"
                  onClick={() => moveStep(i, -1)}
                  disabled={i === 0}
                  className="text-gray-300 hover:text-gray-500 disabled:opacity-30 disabled:hover:text-gray-300"
                  title="Move up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(i, 1)}
                  disabled={i === steps.length - 1}
                  className="text-gray-300 hover:text-gray-500 disabled:opacity-30 disabled:hover:text-gray-300"
                  title="Move down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  className="text-gray-300 hover:text-red-400"
                  title="Remove step"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {steps.length > 0 && (
        <button
          type="button"
          onClick={addStep}
          className="mt-2 text-sm text-orange-500 font-medium flex items-center gap-1 hover:text-orange-600"
        >
          <Plus className="w-3.5 h-3.5" /> Add step
        </button>
      )}

      {steps.some(s => s.trim()) && (
        <p className="text-xs text-gray-400 mt-2">
          <ChefHat className="w-3 h-3 inline mr-0.5" />
          Ingredients, amounts, times, and temperatures are highlighted automatically when you finish a step.
        </p>
      )}
    </div>
  )
}

/** Auto-growing textarea used while a step is being edited. */
function StepTextarea({
  value,
  onChange,
  onBlur,
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const resize = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    resize()
    // Focus at end of the existing text when a step opens for editing.
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={e => {
        onChange(e.target.value)
        resize()
      }}
      onBlur={onBlur}
      placeholder="Describe this step…"
      className="w-full resize-none overflow-hidden rounded-xl border border-orange-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
    />
  )
}
