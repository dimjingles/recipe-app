/**
 * AI-powered instruction structurer.
 *
 * Converts a free-text instructions blob into an array of InstructionStep
 * objects where each step's text is tokenised into typed highlight spans:
 *   text      — plain prose
 *   time      — durations ("10 minutes", "1 hour", "overnight")
 *   temp      — temperatures/heat levels ("350°F", "medium-high heat")
 *   quantity  — measured amounts ("2 cups", "1 tbsp", "½ tsp")
 *   doneness  — sensory completion cues ("until golden brown", "fork-tender")
 *
 * Invariant: for every step, joining token values reproduces step.text exactly.
 * If the AI violates this for a given step, that step falls back to a single
 * text token so the app always renders correctly.
 *
 * On any failure the whole call falls back to the deterministic text splitter
 * so a recipe save can never be broken by this step.
 */

import { anthropic, HAIKU, extractJsonArray } from '@/lib/anthropic'
import { splitStepsFromText, stripSourceNote } from '@/lib/instructions'
import type { InstructionStep, StepToken, StepTokenType } from '@/types/database'

const VALID_TOKEN_TYPES: Set<StepTokenType> = new Set(['text', 'time', 'temp', 'quantity', 'doneness'])

export async function structureInstructions(
  recipeName: string,
  instructions: string | null | undefined,
): Promise<InstructionStep[]> {
  if (!instructions?.trim()) return []

  const cleaned = stripSourceNote(instructions).trim()
  if (!cleaned) return []

  try {
    const message = await anthropic.messages.create({
      model: HAIKU,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: buildPrompt(recipeName, cleaned),
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') return fallback(cleaned)

    const parsed = extractJsonArray(content.text)
    if (!Array.isArray(parsed)) return fallback(cleaned)

    return validateAndCoerce(parsed, cleaned)
  } catch (err) {
    console.error('[structure-instructions] AI call failed, using text fallback:', err)
    return fallback(cleaned)
  }
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(recipeName: string, instructions: string): string {
  return `You are a culinary assistant. Structure the cooking instructions for "${recipeName}" into numbered steps, then tokenise each step's text into typed spans.

TOKEN TYPES:
  "text"     — plain prose (everything that is not one of the below)
  "time"     — any time duration: "10 minutes", "1 hour", "30 seconds", "overnight", "2-3 hours"
  "temp"     — temperatures or heat-level words: "350°F", "180°C", "medium-high heat", "low heat", "high"
  "quantity" — measured amounts with or without a unit: "2 cups", "1 tbsp", "½ tsp", "3 cloves", "a pinch"
  "doneness" — sensory completion cues: "until golden brown", "until fork-tender", "until fragrant", "until the juices run clear"

RULES:
1. Split into logical steps. Each step must be one complete action (may reference prior prep but stands alone).
2. Tokens for a step must concatenate to reproduce the step text EXACTLY — do not add, remove, or change any characters. Use adjacent "text" tokens for prose between highlights.
3. Keep highlights tight — only mark what is actually a time/temp/quantity/doneness phrase, not surrounding prose.
4. Do not merge unrelated highlights; each highlighted phrase is its own token.
5. Return ONLY a valid JSON array with this exact structure — no markdown, no explanation:

[
  {
    "n": 1,
    "text": "full step text exactly as written",
    "tokens": [
      { "type": "text", "value": "Preheat the oven to " },
      { "type": "temp", "value": "350°F" },
      { "type": "text", "value": ". Line a baking pan with parchment." }
    ]
  }
]

INSTRUCTIONS:
${instructions}`
}

// ── Validation & coercion ─────────────────────────────────────────────────────

function validateAndCoerce(raw: unknown[], cleaned: string): InstructionStep[] {
  const steps: InstructionStep[] = []

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    if (!item || typeof item !== 'object') continue

    const obj = item as Record<string, unknown>
    const n = typeof obj.n === 'number' ? obj.n : i + 1
    const text = typeof obj.text === 'string' ? obj.text : ''
    if (!text.trim()) continue

    const rawTokens = Array.isArray(obj.tokens) ? obj.tokens : []
    const tokens = coerceTokens(rawTokens, text)

    steps.push({ n, text, tokens })
  }

  if (steps.length === 0) return fallback(cleaned)

  // Re-sequence step numbers 1…N regardless of what the model returned
  return steps.map((s, i) => ({ ...s, n: i + 1 }))
}

function coerceTokens(raw: unknown[], stepText: string): StepToken[] {
  const tokens: StepToken[] = raw
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map(t => ({
      type: VALID_TOKEN_TYPES.has(t.type as StepTokenType) ? (t.type as StepTokenType) : 'text',
      value: typeof t.value === 'string' ? t.value : '',
    }))
    .filter(t => t.value !== '')

  // Verify concatenation invariant
  const joined = tokens.map(t => t.value).join('')
  if (joined !== stepText) {
    // Model violated the contract — fall back to a single text token for this step
    return [{ type: 'text', value: stepText }]
  }

  return tokens
}

// ── Fallback ──────────────────────────────────────────────────────────────────

function fallback(cleaned: string): InstructionStep[] {
  return splitStepsFromText(cleaned)
}
