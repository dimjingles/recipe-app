import { startOfWeek, format } from 'date-fns'

/** Monday-based week start as yyyy-MM-dd. Client-safe (no server imports). */
export function getWeekStart(date: Date = new Date()): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}
