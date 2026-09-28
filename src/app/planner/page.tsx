import { redirect } from 'next/navigation'
import PlannerClient from './planner-client'
import { SHOW_PLANNER } from '@/lib/features'

// Zero-await static shell: data comes from the client query cache, so
// client-side navigation here needs no server round-trip.
export default function PlannerPage() {
  if (!SHOW_PLANNER) redirect('/')
  return <PlannerClient />
}
