import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import pkg from '../../../package.json'
import SettingsView from './settings-view'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <SettingsView email={user.email ?? ''} version={pkg.version} />
}
