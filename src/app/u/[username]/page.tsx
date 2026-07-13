import { redirect, notFound } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { getPublicProfile, getFriendRecipes, getFriendCookbooks, getFriendshipStatus, FriendshipStatus } from '@/lib/db/social'
import FriendProfileView from './friend-profile-view'

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const user = await getUser()
  if (!user) redirect(`/login?next=/u/${username}`)

  const profile = await getPublicProfile(username)
  if (!profile) notFound()

  const isSelf = profile.id === user.id
  const [status, recipes, cookbooks] = await Promise.all([
    isSelf ? Promise.resolve<FriendshipStatus>('none') : getFriendshipStatus(profile.id),
    getFriendRecipes(profile.id),
    getFriendCookbooks(profile.id),
  ])

  return (
    <FriendProfileView
      profile={profile}
      isSelf={isSelf}
      initialStatus={status}
      recipes={recipes}
      cookbooks={cookbooks}
    />
  )
}
