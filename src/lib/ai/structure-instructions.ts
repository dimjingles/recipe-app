/**
 * Instruction structurer.
 *
 * Converts a free-text instructions blob into an array of InstructionStep
 * objects where each step's text is tokenised into typed highlight spans
 * (text / time / temp / quantity / doneness).
 *
 * Tokenising is deterministic (`tokenizeStep`), so joining a step's token values
 * always reproduces its text. The only judgement call is where the step
 * boundaries are:
 *  - Instructions that are already a step list (numbered lines, inline "1. … 2.
 *    …", or paragraphs) are split without AI. Lookup, photo and import all
 *    produce numbered steps, so this is the common case.
 *  - A single unbroken block of prose goes to Haiku, which only returns the
 *    step strings (it used to write every step twice: once as text, once as
 *    tokens).
 *
 * On any failure this falls back to the deterministic splitter, so a recipe
 * save can never be broken by this step.
 */

import { anthropic, HAIKU, QUICK_CALL } from '@/lib/anthropic'
import { splitStepsFromText, stripSourceNote, tokenizeStep } from '@/lib/instructions'
import type { InstructionStep } from '@/types/database'

const STEPS_SCHEMA = {
  type: 'object',
  properties: { steps: { type: 'array', items: { type: 'string' } } },
  required: ['steps'],
  additionalProperties: false,
} as const

export async function structureInstructions(
  recipeName: string,
  instructions: string | null | undefined,
): Promise<InstructionStep[]> {
  if (!instructions?.trim()) return []

  const cleaned = stripSourceNote(instructions).trim()
  if (!cleaned) return []

  const split = splitStepsFromText(cleaned)
  if (split.length >= 2) return tokenize(split.map(s => s.text))

  try {
    const message = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 4096,
      output_config: { format: { type: 'json_schema', schema: STEPS_SCHEMA } },
      messages: [{ role: 'user', content: buildPrompt(recipeName, cleaned) }],
    }, QUICK_CALL)

    const content = message.content[0]
    if (message.stop_reason !== 'end_turn' || content?.type !== 'text') return fallback(split)

    const { steps } = JSON.parse(content.text) as { steps: string[] }
    const texts = steps.map(s => s.trim()).filter(Boolean)
    return texts.length ? tokenize(texts) : fallback(split)
  } catch (err) {
    console.error('[structure-instructions] AI call failed, using text fallback:', err)
    return fallback(split)
  }
}

function buildPrompt(recipeName: string, instructions: string): string {
  return `You are a culinary assistant. Split the cooking instructions for "${recipeName}" into steps.

Each step is one complete action (it may reference earlier prep but stands alone). Keep the original wording — do not add, remove, or rephrase anything; only decide where one step ends and the next begins. Do not number the steps.

INSTRUCTIONS:
${instructions}`
}

function tokenize(texts: string[]): InstructionStep[] {
  return texts.map((text, i) => ({ n: i + 1, text, tokens: tokenizeStep(text) }))
}

function fallback(split: InstructionStep[]): InstructionStep[] {
  return tokenize(split.map(s => s.text))
}
