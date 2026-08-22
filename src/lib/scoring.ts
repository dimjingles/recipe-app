// ── Recipe scoring ────────────────────────────────────────────────────────────
// A recipe's score lives entirely within its own pool: recipes are ranked only
// against others of the same type (main / dessert / drink / other) AND the same
// like/okay/dislike verdict. Each pool is spread across its tier's band, so the
// best liked dessert is 10.0 and so is the best liked main — comparing a
// margarita to a lasagna was never a meaningful question.

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

// ── Ranking pools ─────────────────────────────────────────────────────────────
// The three core types people actually compare within, plus one shared bucket
// for everything else (appetizers, untyped recipes, anything unrecognized).

export const RANK_GROUPS = ['main', 'dessert', 'drink', 'other'] as const
export type RankGroup = (typeof RANK_GROUPS)[number]

/** The pool a recipe ranks in, from its `recipe_type`. Unknown/missing → 'other'.
 *  breakfast/lunch/dinner fold into mains: the library filter offers them even
 *  though nothing writes them today. */
export function rankGroup(recipeType: string | null | undefined): RankGroup {
  switch (recipeType?.trim().toLowerCase()) {
    case 'main':
    case 'dinner':
    case 'lunch':
    case 'breakfast':
      return 'main'
    case 'dessert':
      return 'dessert'
    case 'drink':
      return 'drink'
    default:
      return 'other'
  }
}

export function isRankGroup(value: unknown): value is RankGroup {
  return RANK_GROUPS.includes(value as RankGroup)
}

/** Plural noun for UI copy — "Ranking among your liked desserts". */
export const RANK_GROUP_NOUN: Record<RankGroup, string> = {
  main: 'mains',
  dessert: 'desserts',
  drink: 'drinks',
  other: 'other recipes',
}

/**
 * Where to splice a recipe into its tier's ordered list so that it lands at
 * 1-based `position` among the members of its own pool.
 *
 * Ranks are stored as one global tier-major ordinal, but comparisons only ever
 * happen within a pool — so we translate the within-pool slot into a flat index
 * that leaves every other recipe's relative order untouched. Re-ranking a
 * dessert must never reshuffle the mains.
 */
export function poolInsertIndex(tierGroups: RankGroup[], group: RankGroup, position: number): number {
  const peers: number[] = []
  tierGroups.forEach((g, i) => { if (g === group) peers.push(i) })
  if (peers.length === 0) return tierGroups.length // no peers yet — park it at the end
  const slot = Math.max(position - 1, 0)
  if (slot < peers.length) return peers[slot] // just ahead of the peer it beat
  return peers[peers.length - 1] + 1 // worst in its pool — just after the last peer
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
  recipeType: string | null
}

/**
 * Compute the 0.0–10.0 score for every ranked recipe, keyed by id. Recipes are
 * grouped by (pool, feedback tier) and each group is spread across its tier's
 * band by rank (best rank → top of band). The stored rank is a global ordinal,
 * but only its order *within* a group is meaningful. Unranked recipes are omitted.
 */
export function computeScores(recipes: RankedInput[]): Record<string, number> {
  const groups = new Map<string, { id: string; rank: number; feedback: Feedback | null }[]>()
  for (const r of recipes) {
    if (r.rank == null) continue
    const key = `${rankGroup(r.recipeType)}|${r.feedback ?? 'none'}`
    const list = groups.get(key) ?? []
    list.push({ id: r.id, rank: r.rank, feedback: r.feedback })
    groups.set(key, list)
  }

  const scores: Record<string, number> = {}
  for (const list of groups.values()) {
    list.sort((a, b) => a.rank - b.rank) // best (lowest rank) first
    list.forEach((r, i) => { scores[r.id] = bucketScore(i, list.length, r.feedback) })
  }
  return scores
}

/** One-decimal display string, e.g. `10.0`, `8.7`, `0.0`. */
export function formatScore(score: number): string {
  return score.toFixed(1)
}
