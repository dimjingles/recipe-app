'use client'

import { useFeedPages } from '@/lib/queries/hooks'
import { PageSkeleton, useAuthRedirect } from '@/components/cached-page'
import FeedList from './feed-list'

export default function FeedClient() {
  const feed = useFeedPages()
  useAuthRedirect(feed.error)

  if (!feed.data) return <PageSkeleton />
  return (
    <FeedList
      items={feed.data.pages.flatMap(p => p.items)}
      hasMore={feed.hasNextPage}
      loading={feed.isFetchingNextPage}
      onLoadMore={() => void feed.fetchNextPage()}
    />
  )
}
