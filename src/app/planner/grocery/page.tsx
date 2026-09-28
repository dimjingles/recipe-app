import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import GroceryClient from './grocery-client'
import { DetailSkeleton } from '@/components/cached-page'
import { SHOW_PLANNER } from '@/lib/features'

// Static shell: the week comes from the query string on the client, and the
// list renders from the query cache (prefetched from the planner).
export default function GroceryPage() {
  if (!SHOW_PLANNER) redirect('/')
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <GroceryClient />
    </Suspense>
  )
}
