import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import pkg from '../../../package.json'
import SettingsView from './settings-view'

export default async function SettingsPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  return <SettingsView email={user.email ?? ''} version={pkg.version} />
}
