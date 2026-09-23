import { createClient, getUser } from '@/lib/supabase/server'
import { getWeekStart } from '@/lib/week'

export { getWeekStart }

/** A recurring day-of-week cuisine cluster mined from the cooking log. */
export interface DayCuisinePattern {
  /** 0 = Monday … 6 = Sunday (planner day indexing). */
  dayOfWeek: number
  /** The dominant cuisine cooked on that weekday. */
  cuisine: string
  /** How many times that cuisine was cooked on that weekday. */
  count: number
}

/**
 * Mine the cooking log for day-of-week cuisine habits (e.g. "Italian on Sundays").
 * Pure DB aggregation done in JS — no ML. Only returns a pattern when a cuisine
 * dominates a weekday (≥2 occurrences and ≥50% of that weekday's cooks).
 */
export async function getCookingPatterns(): Promise<DayCuisinePattern[]> {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) return []

  const { data } = await supabase
    .from('cooking_log')
    .select('cooked_at, recipe:recipes(cuisine)')
    .eq('user_id', user.id)
    .order('cooked_at', { ascending: false })
    .limit(200)

  if (!data?.length) return []

  const rows = data as unknown as { cooked_at: string; recipe: { cuisine?: string | null } | null }[]

  // dayOfWeek (Mon=0) → cuisine → count
  const byDay: Record<number, Record<string, number>> = {}
  for (const row of rows) {
    const cuisine = row.recipe?.cuisine
    if (!cuisine) continue
    // JS getDay(): 0=Sun…6=Sat → shift to planner indexing (0=Mon…6=Sun)
    const dow = (new Date(row.cooked_at).getDay() + 6) % 7
    byDay[dow] ??= {}
    byDay[dow][cuisine] = (byDay[dow][cuisine] || 0) + 1
  }

  const patterns: DayCuisinePattern[] = []
  for (const [dowStr, cuisineCounts] of Object.entries(byDay)) {
    const entries = Object.entries(cuisineCounts)
    const total = entries.reduce((sum, [, c]) => sum + c, 0)
    const [cuisine, count] = entries.sort((a, b) => b[1] - a[1])[0]
    if (count >= 2 && count / total >= 0.5) {
      patterns.push({ dayOfWeek: Number(dowStr), cuisine, count })
    }
  }
  return patterns
}
