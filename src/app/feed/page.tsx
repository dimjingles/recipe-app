import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { getFeed } from '@/lib/db/activity'
import FeedList from './feed-list'

export default async function FeedPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const feed = await getFeed()
  return <FeedList initialItems={feed.items} initialCursor={feed.nextCursor} />
}
