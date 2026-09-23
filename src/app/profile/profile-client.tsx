'use client'

import { useMe } from '@/lib/queries/hooks'
import { PageSkeleton, useAuthRedirect } from '@/components/cached-page'
import ProfileView from './profile-view'

// /profile renders from the cached `me` query — a bottom-nav tap shows it
// instantly instead of waiting on a server render.
export default function ProfileClient() {
  const me = useMe()
  useAuthRedirect(me.error)

  if (!me.data) return <PageSkeleton />
  const profile = me.data.profile
  // UTC keeps the month stable regardless of the viewer's timezone.
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : null

  return (
    <ProfileView
      profile={{
        username: profile?.username ?? '',
        display_name: profile?.display_name ?? '',
        avatar_url: profile?.avatar_url ?? '',
      }}
      memberSince={memberSince}
    />
  )
}
