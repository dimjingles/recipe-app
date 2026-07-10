/**
 * Pure utilities for working with recipe instruction text.
 *
 * `instructions` is stored as a single free-text blob.  These helpers normalise
 * it without any AI so they work synchronously in both the renderer (as a
 * fallback for recipes without structured data yet) and in the AI structurer
 * (to pre-clean the text before the Haiku call).
 */

import type { InstructionStep, StepToken, StepTokenType } from '@/types/database'

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
    const built = steps.filter(s => s.text)
    // If the numbered items were packed inline on one line (AI output with no
    // line breaks), line-based splitting yields a single giant step. Inline
    // splitting recovers the real steps; prefer it only when it finds more.
    const inline = splitInlineNumbered(cleaned)
    if (inline && inline.length > built.length) return inline.map((text, i) => buildTextStep(i + 1, text))
    if (built.length) return built
  }

  // Strategy 2: inline numbered markers with no leading "1." on the first step
  // ("Peel … thick. 2. Melt … heat. 3. Add …")
  const inline = splitInlineNumbered(cleaned)
  if (inline) return inline.map((text, i) => buildTextStep(i + 1, text))

  // Strategy 3: blank-line paragraphs
  const paragraphs = cleaned.split(/\n\s*\n+/).map(p => p.replace(/\n/g, ' ').trim()).filter(Boolean)
  return paragraphs.map((text, i) => buildTextStep(i + 1, text))
}

/**
 * Split running text on inline numbered markers (a number followed by "." or
 * ")" and a space) when they form a clean 1…N / 2…N sequence. Returns null when
 * the text isn't an inline-numbered list so the caller can fall back.
 *
 * Handles AI output that numbers steps inline without line breaks, and the case
 * where the first step carries no explicit "1." (markers start at "2.").
 */
function splitInlineNumbered(text: string): string[] | null {
  const re = /(?:^|\s)(\d{1,2})[.)]\s+/g
  const marks: { num: number; markStart: number; contentStart: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    // Skip a leading whitespace char that the alternation may have consumed.
    const hadLeadingWs = m.index > 0 && /\s/.test(text[m.index])
    marks.push({
      num: parseInt(m[1], 10),
      markStart: hadLeadingWs ? m.index + 1 : m.index,
      contentStart: m.index + m[0].length,
    })
  }

  if (marks.length < 2) return null
  // Must be a clean consecutive run starting at 1 or 2 — otherwise it's just
  // prose that happens to contain "3. " somewhere, not a step list.
  if (marks[0].num > 2) return null
  for (let i = 1; i < marks.length; i++) {
    if (marks[i].num !== marks[i - 1].num + 1) return null
  }

  const steps: string[] = []
  // Text before the first marker is step 1 when the list starts at "2." (the
  // first step had no number). If it starts at "1." any preamble is unexpected
  // but preserved to avoid losing content.
  const preamble = text.slice(0, marks[0].markStart).replace(/\n/g, ' ').trim()
  if (preamble && (marks[0].num === 2 || marks[0].num === 1)) steps.push(preamble)
  else if (!preamble && marks[0].num === 2) return null // bare "2." with nothing before it

  for (let i = 0; i < marks.length; i++) {
    const end = i + 1 < marks.length ? marks[i + 1].markStart : text.length
    const seg = text.slice(marks[i].contentStart, end).replace(/\n/g, ' ').trim()
    if (seg) steps.push(seg)
  }

  return steps.length > 1 ? steps : null
}

// ── Step ↔ text conversion ────────────────────────────────────────────────────

/**
 * Serialise an array of step strings back into the single numbered-text blob
 * that is stored in `recipes.instructions` (the source of truth). Empty steps
 * are dropped and the remaining ones are re-numbered 1…N.
 */
export function stepsToText(steps: string[]): string {
  return steps
    .map(s => s.trim())
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n\n')
}

/**
 * Split an instructions blob into an array of plain step strings for the
 * step-based editor. Thin wrapper over `splitStepsFromText` that returns just
 * the human text of each step (no tokens).
 */
export function textToSteps(raw: string | null | undefined): string[] {
  return splitStepsFromText(raw).map(s => s.text)
}

/**
 * Separate the trailing "Source: <url>" note from the body of an instructions
 * blob so the editor can edit steps without clobbering the note, then
 * re-append it on save. Returns the note WITHOUT its leading blank lines.
 */
export function splitSourceNote(raw: string | null | undefined): { body: string; note: string } {
  if (!raw) return { body: '', note: '' }
  const m = raw.match(/\n+\s*Source\s*:\s*https?:\/\/[^\n]*/i)
  if (!m || m.index == null) return { body: raw, note: '' }
  return { body: raw.slice(0, m.index).trimEnd(), note: m[0].trim() }
}

// ── Deterministic step tokeniser (client-side, no AI) ─────────────────────────

/**
 * Highlight patterns applied, in priority order, to a step's plain text so the
 * editor can format critical cooking info the moment the user clicks out of a
 * step — mirroring the typed-highlight vocabulary the AI structurer produces
 * (see `structure-instructions.ts`) but synchronously and without a network
 * call. The stored, canonical `instruction_steps` are still regenerated by the
 * AI on save; this is purely for instant edit-time feedback.
 *
 * Order matters: earlier passes claim their spans first, so later patterns can
 * only match the remaining plain-text gaps (prevents overlaps).
 */
const QUANTITY_UNITS = [
  'cups?', 'tbsps?', 'tablespoons?', 'tsps?', 'teaspoons?',
  'grams?', 'kg', 'kilograms?', 'mg', 'ml', 'milliliters?', 'litres?', 'liters?',
  'oz', 'ounces?', 'lbs?', 'pounds?', 'cloves?', 'sticks?', 'slices?', 'sprigs?',
  'cans?', 'pinch(?:es)?', 'dash(?:es)?', 'handfuls?', 'quarts?', 'pints?', 'gallons?',
  'g', 'l',
]

const HIGHLIGHT_PATTERNS: { type: StepTokenType; re: RegExp }[] = [
  // doneness — "until golden brown", "until fork-tender"; stops at connectors
  {
    type: 'doneness',
    re: /\buntil\s+(?:(?!(?:and|then|for|about|or|but|so)\b)[A-Za-z][A-Za-z-]*)(?:\s+(?!(?:and|then|for|about|or|but|so)\b)[A-Za-z][A-Za-z-]*){0,4}/gi,
  },
  // temp — "350°F", "180 °C", "375°", "350 degrees", "medium-high heat"
  {
    type: 'temp',
    re: /\b\d{2,3}\s*°\s*[CF]?|\b\d{2,3}\s*(?:°\s*)?degrees?(?:\s*(?:celsius|fahrenheit|[CF]))?|\b(?:medium[-\s]?high|medium[-\s]?low|medium|high|low)\s+heat\b/gi,
  },
  // time — "10 minutes", "2-3 hours", "30 seconds", "1 hr", "overnight"
  {
    type: 'time',
    re: /\b\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?\s*(?:seconds?|secs?|minutes?|mins?|min|hours?|hrs?|hr|days?|weeks?)\b|\bovernight\b/gi,
  },
  // quantity — "2 cups", "½ tsp", "1/2 cup", "3 cloves", "a pinch of"
  {
    type: 'quantity',
    // `(?<![\w])` (rather than `\b`) so standalone fraction glyphs like "½ tsp"
    // match — a fraction char is not an ASCII word char, so `\b` never fires
    // before it — while still refusing to match in the middle of a word.
    re: new RegExp(
      `(?<![\\w])(?:\\d+(?:[./,]\\d+)?\\s*[½¼¾⅓⅔⅛⅜⅝⅞]?|[½¼¾⅓⅔⅛⅜⅝⅞])\\s*(?:${QUANTITY_UNITS.join('|')})\\b|\\ba (?:pinch|dash|handful)(?: of)?\\b`,
      'gi',
    ),
  },
]

/**
 * Tokenise a single step's text into typed highlight spans, deterministically.
 * Ingredient names (when provided) are overlaid last, matching the render-time
 * behaviour in `instruction-steps.tsx`. Concatenating the returned token values
 * always reproduces `text` exactly.
 */
export function tokenizeStep(text: string, ingredientNames: string[] = []): StepToken[] {
  if (!text) return []
  let tokens: StepToken[] = [{ type: 'text', value: text }]
  for (const { type, re } of HIGHLIGHT_PATTERNS) {
    tokens = applyPattern(tokens, re, type)
  }
  return overlayIngredients(tokens, ingredientNames)
}

/** Split every plain-`text` token by `re`, tagging matches as `type`. */
function applyPattern(tokens: StepToken[], re: RegExp, type: StepTokenType): StepToken[] {
  return tokens.flatMap(token => {
    if (token.type !== 'text') return [token]
    const out: StepToken[] = []
    let last = 0
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(token.value)) !== null) {
      if (m[0] === '') { re.lastIndex++; continue } // guard against zero-length matches
      if (m.index > last) out.push({ type: 'text', value: token.value.slice(last, m.index) })
      out.push({ type, value: m[0] })
      last = m.index + m[0].length
    }
    if (out.length === 0) return [token]
    if (last < token.value.length) out.push({ type: 'text', value: token.value.slice(last) })
    return out
  })
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
