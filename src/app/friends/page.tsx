import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFriends, getPendingRequests, getSentRequests } from '@/lib/db/social'
import FriendsView from './friends-view'

export default async function FriendsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, friends, incoming, sent] = await Promise.all([
    supabase.from('profiles').select('username').eq('id', user.id).single(),
    getFriends(),
    getPendingRequests(),
    getSentRequests(),
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
