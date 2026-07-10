'use client'

/**
 * Renders recipe instructions as a numbered list of step cards.
 *
 * Each step is colour-coded with inline highlight pills:
 *   time      → amber  (cooking accent)   + Clock icon
 *   temp      → orange (brand accent)     + Thermometer icon
 *   quantity  → green  (sage accent)      + Scale icon
 *   doneness  → italic underline (sensory cue, distinct from measured values)
 *   text      → plain prose
 *
 * Fallback chain (most → least structured):
 *   1. `steps` prop (AI-structured from DB)
 *   2. `splitStepsFromText(rawInstructions)` (deterministic split, no highlights)
 *   3. plain <p> blob (original rendering, identical to before this feature)
 */

import { ChefHat } from 'lucide-react'
import { splitStepsFromText, overlayIngredients } from '@/lib/instructions'
import { renderStepTokens } from '@/components/step-tokens'
import type { InstructionStep, Ingredient } from '@/types/database'

interface Props {
  steps: InstructionStep[] | null | undefined
  rawInstructions: string | null | undefined
  ingredients?: Ingredient[]
  onAskChef: (step: InstructionStep) => void
}

export default function InstructionSteps({ steps, rawInstructions, ingredients = [], onAskChef }: Props) {
  const ingredientNames = ingredients.map(i => i.name).filter(Boolean)
  // Resolve which steps to display
  const displaySteps: InstructionStep[] | null =
    steps && steps.length > 0
      ? steps
      : rawInstructions
        ? splitStepsFromText(rawInstructions)
        : null

  // Fallback: no steps could be derived — render original blob
  if (!displaySteps || displaySteps.length === 0) {
    if (!rawInstructions) return null
    return (
      <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
        {rawInstructions}
      </p>
    )
  }

  return (
    <ol className="space-y-3 list-none">
      {displaySteps.map(step => (
        <li key={step.n} className="flex gap-3">
          {/* Step number badge */}
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand text-brand-foreground flex items-center justify-center text-xs font-bold mt-0.5">
            {step.n}
          </span>

          {/* Step content */}
          <div className="flex-1 bg-card rounded-xl border border-border shadow-sm px-4 py-3">
            <p className="text-foreground text-sm leading-relaxed">
              {renderStepTokens(overlayIngredients(step.tokens, ingredientNames))}
            </p>

            {/* Per-step Ask Chef AI button */}
            <button
              onClick={() => onAskChef(step)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs text-cooking hover:text-cooking/80 font-medium transition-colors"
              title="Ask Chef AI about this step"
            >
              <ChefHat className="w-3.5 h-3.5" />
              Ask Chef AI
            </button>
          </div>
        </li>
      ))}
    </ol>
  )
}
