import { redirect } from 'next/navigation'
import { createClient, getUser } from '@/lib/supabase/server'
import ProfileView from './profile-view'

export default async function ProfilePage() {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, created_at')
    .eq('id', user.id)
    .single()

  // Formatted here so server and client render the same string. UTC keeps the
  // month stable regardless of where the server runs.
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
