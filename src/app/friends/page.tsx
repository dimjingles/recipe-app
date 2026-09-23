import { redirect } from 'next/navigation'
import { createClient, getUser } from '@/lib/supabase/server'
import { getFriendGraph } from '@/lib/db/social'
import FriendsView from './friends-view'

export default async function FriendsPage() {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { friends, incoming, sent }] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).single(),
    getFriendGraph(),
  ])

  return (
    <FriendsView
      myUsername={profile?.username ?? null}
      initialFriends={friends}
      initialIncoming={incoming}
      initialSent={sent}
    />
  )
}
