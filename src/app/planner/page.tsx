import PlannerClient from './planner-client'

// Zero-await static shell: data comes from the client query cache, so
// client-side navigation here needs no server round-trip.
export default function PlannerPage() {
  return <PlannerClient />
}
