/**
 * Pure utilities for working with recipe instruction text.
 *
 * `instructions` is stored as a single free-text blob.  These helpers normalise
 * it without any AI so they work synchronously in both the renderer (as a
 * fallback for recipes without structured data yet) and in the AI structurer
 * (to pre-clean the text before the Haiku call).
 */

import type { InstructionStep, StepToken } from '@/types/database'

// ── Source note ───────────────────────────────────────────────────────────────

/**
 * Remove the trailing "Source: <url>" note that the import pipeline appends
 * inside the instructions text blob (there is no dedicated source_url column).
 */
export function stripSourceNote(text: string): string {
  // The note is always at the very end, separated by at least one blank line.
  // Match both "Source:" and "Source :" spellings, http and https.
  return text.replace(/\n+\s*Source\s*:\s*https?:\/\/[^\n]*/gi, '').trimEnd()
}

// ── Deterministic step splitter ───────────────────────────────────────────────

/**
 * Split a raw instructions blob into numbered steps WITHOUT using AI.
 * Used as:
 *  - The fallback inside `structureInstructions` when the Haiku call fails.
 *  - The renderer fallback for recipes that have not been backfilled yet.
 *
 * Strategy (in order):
 *  1. If the text contains lines that start with a step prefix (`1.`, `1)`,
 *     `Step 1:`, `Step 1.`) use those as split points.
 *  2. Otherwise split on blank lines and treat each non-empty paragraph as a step.
 *  3. Each resulting step gets a single `text` token (no highlights).
 */
export function splitStepsFromText(raw: string | null | undefined): InstructionStep[] {
  if (!raw?.trim()) return []

  const cleaned = stripSourceNote(raw).trim()
  if (!cleaned) return []

  // Strategy 1: numbered step prefixes
  const numberedLineRe = /^(?:step\s+)?\d+[.)]\s+/i

  const lines = cleaned.split('\n')
  const hasNumberedSteps = lines.some(l => numberedLineRe.test(l.trim()))

  if (hasNumberedSteps) {
    const steps: InstructionStep[] = []
    let current: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (numberedLineRe.test(trimmed)) {
        if (current.length) steps.push(buildTextStep(steps.length + 1, current.join(' ').trim()))
        // Strip the leading "1. " / "Step 1. " prefix; the UI adds its own number badge
        current = [trimmed.replace(numberedLineRe, '').trim()]
      } else if (trimmed) {
        current.push(trimmed)
      }
    }
    if (current.length) steps.push(buildTextStep(steps.length + 1, current.join(' ').trim()))
    return steps.filter(s => s.text)
  }

  // Strategy 2: blank-line paragraphs
  const paragraphs = cleaned.split(/\n\s*\n+/).map(p => p.replace(/\n/g, ' ').trim()).filter(Boolean)
  return paragraphs.map((text, i) => buildTextStep(i + 1, text))
}

// ── Ingredient overlay ────────────────────────────────────────────────────────

/**
 * Post-process a step's token array to highlight ingredient name occurrences
 * inside `text` tokens.  Only plain text spans are split — already-highlighted
 * tokens (time, temp, quantity, doneness) are left untouched.
 *
 * Matching is case-insensitive and whole-word so "butter" doesn't fire inside
 * "buttermilk".  Ingredient names are sorted longest-first so "soy sauce"
 * matches before "soy".
 */
export function overlayIngredients(
  tokens: StepToken[],
  ingredientNames: string[],
): StepToken[] {
  const aliases = buildIngredientAliases(ingredientNames)
  if (aliases.length === 0) return tokens

  // Longest first to prevent "soy" eating "soy sauce"
  const pattern = aliases.map(escapeRegex).join('|')
  const re = new RegExp(`\\b(${pattern})\\b`, 'gi')

  return tokens.flatMap(token => {
    if (token.type !== 'text') return [token]
    return splitByIngredientRe(token.value, re)
  })
}

/**
 * Expand a list of ingredient names into match aliases so that partial names
 * found in instruction prose are still highlighted.
 *
 * "unsalted butter"  → also matches "butter"
 * "garlic cloves"    → also matches "garlic", "clove" (singular)
 * "all-purpose flour"→ also matches "flour", "all-purpose flour"
 * "large eggs"       → also matches "egg", "eggs"
 */
function buildIngredientAliases(names: string[]): string[] {
  const aliases = new Set<string>()

  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue

    aliases.add(name)

    const words = name.split(/\s+/)

    // First word: "sago pearls" → "sago", "coconut cream" → "coconut"
    const first = words[0]
    if (words.length > 1 && first.length >= 3) aliases.add(first)

    // Last word: "unsalted butter" → "butter"
    const last = words[words.length - 1]
    if (words.length > 1 && last.length >= 3) aliases.add(last)

    // Last two words: "extra virgin olive oil" → "olive oil"
    if (words.length >= 3) aliases.add(words.slice(-2).join(' '))

    // Basic singular/plural for full name and last word
    for (const form of [name, last]) {
      if (form.endsWith('ves')) {
        aliases.add(form.slice(0, -3) + 'f')
        aliases.add(form.slice(0, -3) + 'fe')
      } else if (form.endsWith('ies') && form.length > 4) {
        aliases.add(form.slice(0, -3) + 'y')
      } else if (form.endsWith('es') && form.length > 4) {
        aliases.add(form.slice(0, -2))
      } else if (form.endsWith('s') && form.length > 3 && !form.endsWith('ss')) {
        aliases.add(form.slice(0, -1))
      } else if (form.length >= 3) {
        aliases.add(form + 's')
      }
    }
  }

  return [...aliases]
    .filter(a => a.length >= 3)
    .sort((a, b) => b.length - a.length) // longest first prevents partial shadowing
}

function splitByIngredientRe(text: string, re: RegExp): StepToken[] {
  const result: StepToken[] = []
  let last = 0
  re.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) result.push({ type: 'text', value: text.slice(last, m.index) })
    result.push({ type: 'ingredient', value: m[0] })
    last = m.index + m[0].length
  }
  if (last < text.length) result.push({ type: 'text', value: text.slice(last) })
  return result
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function buildTextStep(n: number, text: string): InstructionStep {
  return { n, text, tokens: [{ type: 'text', value: text }] }
}
