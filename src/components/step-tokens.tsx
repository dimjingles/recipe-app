/**
 * Shared renderer for tokenised instruction text.
 *
 * A step's `StepToken[]` is rendered into colour-coded inline highlight pills:
 *   time      → amber  (cooking accent)   + Clock icon
 *   temp      → orange (brand accent)     + Thermometer icon
 *   quantity  → green  (sage accent)      + Scale icon
 *   doneness  → italic dotted underline (sensory cue, distinct from measured values)
 *   ingredient→ bold sage underline
 *   text      → plain prose
 *
 * Used both by the read-only recipe view (`instruction-steps.tsx`) and by the
 * step editor's on-blur preview (`instructions-editor.tsx`) so highlights look
 * identical wherever they appear.
 */

import { Clock, Thermometer, Scale } from 'lucide-react'
import type { StepToken } from '@/types/database'

export function renderStepTokens(tokens: StepToken[]): React.ReactNode[] {
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
