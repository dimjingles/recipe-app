import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { getProfile } from '@/lib/db/profile'
import { chefPreferencesFromProfile } from '@/lib/cook/chef-preferences'
import pkg from '../../../package.json'
import SettingsView from './settings-view'

export default async function SettingsPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const profile = await getProfile()

  return (
    <SettingsView
      email={user.email ?? ''}
      version={pkg.version}
      chef={chefPreferencesFromProfile(profile)}
    />
  )
}
