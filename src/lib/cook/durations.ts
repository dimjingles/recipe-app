/**
 * Pure helpers for Guided Cook Mode timers.
 *
 * `detectDurations` scans a step's text for time phrases ("simmer for 10
 * minutes", "bake 1 hour", "rest 30 seconds") and returns the durations it
 * finds so the UI can offer one-tap timer buttons. It is deliberately AI-free
 * so it runs synchronously in the client while cooking.
 */

export interface DetectedDuration {
  /** Total milliseconds for the timer. */
  ms: number
  /** Short human label, e.g. "10 min", "1 hr", "45 sec". */
  label: string
}

const UNIT_MS: Record<string, number> = {
  h: 3_600_000,
  m: 60_000,
  s: 1_000,
}

/**
 * Map a matched unit word to its canonical single-letter key.
 * Returns null for anything unrecognised.
 */
function unitKey(raw: string): 'h' | 'm' | 's' | null {
  const u = raw.toLowerCase()
  if (u.startsWith('h')) return 'h'      // hour, hours, hr, hrs
  if (u.startsWith('min') || u === 'm') return 'm' // minute(s), min(s), m
  if (u.startsWith('s')) return 's'      // second(s), sec(s)
  return null
}

function unitWord(key: 'h' | 'm' | 's'): string {
  return key === 'h' ? 'hr' : key === 'm' ? 'min' : 'sec'
}

/**
 * Detect all time durations mentioned in a piece of instruction text.
 *
 * Handles: "10 minutes", "1 hour", "30 sec", "1.5 hours", "2-3 minutes"
 * (uses the first number of a range), "45 seconds", "1 min".
 *
 * Results are de-duplicated by total duration and returned in the order they
 * appear in the text.
 */
export function detectDurations(text: string | null | undefined): DetectedDuration[] {
  if (!text) return []

  // number  (optional range: "2-3", "2 to 3")  unit
  const re = /(\d+(?:\.\d+)?)\s*(?:(?:-|–|—|to)\s*\d+(?:\.\d+)?\s*)?(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi

  const seen = new Set<number>()
  const out: DetectedDuration[] = []
  let m: RegExpExecArray | null

  while ((m = re.exec(text)) !== null) {
    const value = parseFloat(m[1])
    const key = unitKey(m[2])
    if (!key || !Number.isFinite(value) || value <= 0) continue

    const ms = Math.round(value * UNIT_MS[key])
    if (ms <= 0 || seen.has(ms)) continue
    seen.add(ms)

    // parseFloat already drops a trailing ".0", so "10.0 min" reads as "10 min"
    out.push({ ms, label: `${value} ${unitWord(key)}` })
  }

  return out
}

/**
 * Format a millisecond duration as a clock string.
 *   90_000    → "1:30"
 *   3_665_000 → "1:01:05"
 */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
