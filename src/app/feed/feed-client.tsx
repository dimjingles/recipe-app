'use client'

import { useFeed } from '@/lib/queries/hooks'
import { PageSkeleton, useAuthRedirect } from '@/components/cached-page'
import FeedList from './feed-list'

export default function FeedClient() {
  const feed = useFeed()
  useAuthRedirect(feed.error)

  if (!feed.data) return <PageSkeleton />
  return <FeedList initialItems={feed.data.items} initialCursor={feed.data.nextCursor} />
}
