import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/db/profile'
import OnboardingWizard from './onboarding-wizard'

export default async function OnboardingPage() {
  const profile = await getProfile()

  if (profile?.onboarding_completed) {
    redirect('/')
  }

  return <OnboardingWizard />
}
