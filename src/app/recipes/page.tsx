import { Suspense } from 'react'
import { PageSkeleton } from '@/components/cached-page'
import RecipesClient from './recipes-client'

// Zero-await static shell: data comes from the client query cache, so
// client-side navigation here needs no server round-trip. The Suspense
// boundary lets the client read ?tab= without opting the route into
// dynamic rendering.
export default function RecipesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RecipesClient />
    </Suspense>
  )
}
