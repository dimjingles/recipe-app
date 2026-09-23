import { Suspense } from 'react'
import GroceryClient from './grocery-client'
import { DetailSkeleton } from '@/components/cached-page'

// Static shell: the week comes from the query string on the client, and the
// list renders from the query cache (prefetched from the planner).
export default function GroceryPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <GroceryClient />
    </Suspense>
  )
}
