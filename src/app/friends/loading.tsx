import { PageSkeleton } from '@/components/cached-page'

// Instant feedback while this server-rendered route streams in.
export default function Loading() {
  return <PageSkeleton />
}
