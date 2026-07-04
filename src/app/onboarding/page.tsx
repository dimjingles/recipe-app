import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/db/profile'
import OnboardingWizard from './onboarding-wizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profile = user ? await getProfile() : null

  if (profile?.onboarding_completed) {
    redirect('/')
  }

  return <OnboardingWizard isAuthenticated={!!user} />
}
