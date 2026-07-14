// ─── Servings scaling ──────────────────────────────────────────────────────────
// Client-side, arithmetic rescaling of ingredient quantities when the cook wants
// a different number of servings. This does NOT touch the stored recipe — it only
// reformats the displayed amounts. (The AI "Adapt recipe → Scale servings" flow is
// the heavier path that also rewrites steps/pan sizes and saves a new variant.)

/** Unicode fraction glyph → decimal value. */
const GLYPH_VALUE: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
}
const GLYPH_CLASS = Object.keys(GLYPH_VALUE).join('')

// Decimal → nearest cooking-friendly fraction glyph, ordered for a nearest-match scan.
const FRACTIONS: { value: number; glyph: string }[] = [
  { value: 0.125, glyph: '⅛' },
  { value: 1 / 3, glyph: '⅓' },
  { value: 0.25, glyph: '¼' },
  { value: 0.375, glyph: '⅜' },
  { value: 0.5, glyph: '½' },
  { value: 0.625, glyph: '⅝' },
  { value: 2 / 3, glyph: '⅔' },
  { value: 0.75, glyph: '¾' },
  { value: 0.875, glyph: '⅞' },
]

/** Parse a single numeric token — "1", "1.5", "1/2", "1 1/2", "1½", "½". */
function parseValue(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null

  // Trailing unicode fraction glyph, optionally after a whole number ("1½", "½").
  const glyphMatch = s.match(new RegExp(`^(\\d+)?\\s*([${GLYPH_CLASS}])$`))
  if (glyphMatch) {
    const whole = glyphMatch[1] ? parseInt(glyphMatch[1], 10) : 0
    return whole + GLYPH_VALUE[glyphMatch[2]]
  }

  // Mixed number "1 1/2".
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10)

  // Simple fraction "3/4".
  const frac = s.match(/^(\d+)\/(\d+)$/)
  if (frac) {
    const denom = parseInt(frac[2], 10)
    return denom === 0 ? null : parseInt(frac[1], 10) / denom
  }

  // Plain decimal / integer, allowing a comma decimal separator.
  const num = parseFloat(s.replace(',', '.'))
  return Number.isNaN(num) ? null : num
}

/** Format a scaled decimal back into a cooking-friendly amount ("1½", "¾", "2.25"). */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'

  const whole = Math.floor(value)
  const remainder = value - whole

  // Snap the fractional part to the nearest common fraction when close enough.
  let best: { glyph: string; diff: number; carry: boolean } | null = null
  for (const f of FRACTIONS) {
    const diff = Math.abs(remainder - f.value)
    if (!best || diff < best.diff) best = { glyph: f.glyph, diff, carry: false }
  }
  const toNext = 1 - remainder // distance to rounding the fraction up to a whole
  if (!best || toNext < best.diff) best = { glyph: '', diff: toNext, carry: true }
  const toZero = remainder // distance to dropping the fraction entirely
  if (toZero < best.diff) best = { glyph: '', diff: toZero, carry: false }

  // Only snap when the fraction is genuinely near a common value; otherwise the
  // amount is an odd decimal (e.g. ×1.3) and a rounded decimal is more honest.
  if (best.diff <= 0.06) {
    const base = whole + (best.carry ? 1 : 0)
    if (best.glyph) return base > 0 ? `${base}${best.glyph}` : best.glyph
    return String(base)
  }

  // Fall back to a trimmed 2-decimal number.
  return value.toFixed(2).replace(/\.?0+$/, '')
}

// Matches one leading quantity token: mixed number, fraction, decimal, or glyph
// (optionally preceded by a whole number, e.g. "1½").
const TOKEN = new RegExp(
  `\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?\\s*[${GLYPH_CLASS}]?|[${GLYPH_CLASS}]`
)

/**
 * Scale a stored quantity string by `factor`, preserving any surrounding text and
 * scaling both ends of a range ("2-3"). Non-numeric amounts ("a pinch", "to taste")
 * are returned unchanged. `factor` of 1 (or a non-positive/NaN factor) is a no-op.
 */
export function scaleQuantity(quantity: string | null | undefined, factor: number): string {
  if (!quantity) return quantity ?? ''
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return quantity

  let replaced = false
  const scaled = quantity.replace(new RegExp(TOKEN, 'g'), match => {
    const value = parseValue(match)
    if (value === null) return match
    replaced = true
    return formatQuantity(value * factor)
  })
  return replaced ? scaled : quantity
}
