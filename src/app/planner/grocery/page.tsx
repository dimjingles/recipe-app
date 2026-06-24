import { getWeekStart } from '@/lib/db/planner'
import GroceryList from '@/components/grocery-list'

export default async function GroceryPage({
  searchParams,
}: {
  searchParams: Promise<{ week_start?: string }>
}) {
  const params = await searchParams
  const weekStart = params.week_start || getWeekStart()
  return <GroceryList weekStart={weekStart} />
}
