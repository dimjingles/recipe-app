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

import { Clock, Thermometer, Scale, ChefHat } from 'lucide-react'
import { splitStepsFromText, overlayIngredients } from '@/lib/instructions'
import type { InstructionStep, StepToken, Ingredient } from '@/types/database'

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
              {renderTokens(overlayIngredients(step.tokens, ingredientNames))}
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

// ── Token renderer ────────────────────────────────────────────────────────────

function renderTokens(tokens: StepToken[]): React.ReactNode[] {
  return tokens.map((token, i) => {
    switch (token.type) {
      case 'time':
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold bg-cooking-subtle text-cooking align-baseline mx-0.5"
            title="Time"
          >
            <Clock className="w-3 h-3 flex-shrink-0" />
            {token.value}
          </span>
        )

      case 'temp':
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold bg-brand-subtle text-brand align-baseline mx-0.5"
            title="Temperature"
          >
            <Thermometer className="w-3 h-3 flex-shrink-0" />
            {token.value}
          </span>
        )

      case 'quantity':
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold bg-sage-subtle text-sage align-baseline mx-0.5"
            title="Amount"
          >
            <Scale className="w-3 h-3 flex-shrink-0" />
            {token.value}
          </span>
        )

      case 'doneness':
        return (
          <span
            key={i}
            className="italic text-muted-foreground underline decoration-dotted underline-offset-2"
            title="Doneness cue"
          >
            {token.value}
          </span>
        )

      case 'ingredient':
        return (
          <span
            key={i}
            className="font-semibold text-sage underline decoration-sage/40 underline-offset-2"
            title="Ingredient"
          >
            {token.value}
          </span>
        )

      default:
        return <span key={i}>{token.value}</span>
    }
  })
}
