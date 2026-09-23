'use client'

import { useFriends, useMe } from '@/lib/queries/hooks'
import { PageSkeleton, useAuthRedirect } from '@/components/cached-page'
import FriendsView from './friends-view'

// /friends renders from the cached friend graph (warmed at login), so the
// bottom-nav tab opens instantly.
export default function FriendsClient() {
  const friends = useFriends()
  const me = useMe()
  useAuthRedirect(friends.error, me.error)

  if (!friends.data || !me.data) return <PageSkeleton />
  return (
    <FriendsView
      myUsername={me.data.profile?.username ?? null}
      initialFriends={friends.data.friends}
      initialIncoming={friends.data.incoming}
      initialSent={friends.data.sent}
    />
  )
}
