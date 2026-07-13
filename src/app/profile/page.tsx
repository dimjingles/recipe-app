import { redirect } from 'next/navigation'
import { createClient, getUser } from '@/lib/supabase/server'
import ProfileEditor from './profile-editor'

export default async function ProfilePage() {
  const supabase = await createClient()
  const user = await getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <ProfileEditor
      initial={{
        username: profile?.username ?? '',
        display_name: profile?.display_name ?? '',
        avatar_url: profile?.avatar_url ?? '',
      }}
      email={user.email ?? ''}
    />
  )
}
