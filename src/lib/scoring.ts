// ── Recipe scoring ────────────────────────────────────────────────────────────
// A recipe's score lives entirely within its feedback tier: recipes are ranked
// only against others in the same like/okay/dislike category, and each tier's
// recipes are spread across that tier's band. So the best "liked" recipe is 10.0
// and the worst "liked" recipe is 7.0, independent of the okay/dislike tiers.

export type Feedback = 'like' | 'okay' | 'dislike'

/** Displayed score band for each feedback tier. Contiguous and non-overlapping,
 *  so any `like` outscores any `okay`, which outscores any `dislike`. */
export const FEEDBACK_RANGE: Record<Feedback, readonly [number, number]> = {
  like: [7.0, 10.0],
  okay: [4.0, 6.9],
  dislike: [0.0, 3.9],
}

/** Band used for recipes with no feedback yet (legacy / untiered). */
export const FULL_RANGE: readonly [number, number] = [0.0, 10.0]

/** Tiers ordered best → worst — the global ordering of ranked recipes. */
export const TIER_ORDER: Feedback[] = ['like', 'okay', 'dislike']

/** Feedback choices in display order, with their UI labels. */
export const FEEDBACK_OPTIONS: { value: Feedback; label: string; emoji: string }[] = [
  { value: 'like', label: 'Liked it', emoji: '👍' },
  { value: 'okay', label: 'It was okay', emoji: '😐' },
  { value: 'dislike', label: 'Not for me', emoji: '👎' },
]

/** Adjective for each tier, used in toasts ("Ranked among your liked recipes"). */
export const FEEDBACK_ADJECTIVE: Record<Feedback, string> = {
  like: 'liked',
  okay: 'okay',
  dislike: 'disliked',
}

export function isFeedback(value: unknown): value is Feedback {
  return value === 'like' || value === 'okay' || value === 'dislike'
}

/**
 * Score for a recipe at position `indexInBucket` (0 = best) within a tier of
 * `bucketSize` recipes. The best in the tier scores the top of the band, the
 * worst scores the bottom, and a lone recipe scores the top of its band.
 */
export function bucketScore(indexInBucket: number, bucketSize: number, feedback: Feedback | null): number {
  const [lo, hi] = feedback ? FEEDBACK_RANGE[feedback] : FULL_RANGE
  if (bucketSize <= 1) return hi
  const clamped = Math.min(Math.max(indexInBucket, 0), bucketSize - 1)
  const position = (bucketSize - 1 - clamped) / (bucketSize - 1) // best → 1, worst → 0
  return lo + (hi - lo) * position
}

export interface RankedInput {
  id: string
  rank: number | null
  feedback: Feedback | null
}

/**
 * Compute the 0.0–10.0 score for every ranked recipe, keyed by id. Recipes are
 * grouped by feedback tier and each tier is spread across its band by rank
 * (best rank → top of band). Unranked recipes are omitted.
 */
export function computeScores(recipes: RankedInput[]): Record<string, number> {
  const groups = new Map<Feedback | 'none', { id: string; rank: number }[]>()
  for (const r of recipes) {
    if (r.rank == null) continue
    const key = r.feedback ?? 'none'
    const list = groups.get(key) ?? []
    list.push({ id: r.id, rank: r.rank })
    groups.set(key, list)
  }

  const scores: Record<string, number> = {}
  for (const [key, list] of groups) {
    list.sort((a, b) => a.rank - b.rank) // best (lowest rank) first
    const feedback = key === 'none' ? null : key
    list.forEach((r, i) => { scores[r.id] = bucketScore(i, list.length, feedback) })
  }
  return scores
}

/** One-decimal display string, e.g. `10.0`, `8.7`, `0.0`. */
export function formatScore(score: number): string {
  return score.toFixed(1)
}
