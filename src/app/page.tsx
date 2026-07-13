import HomeClient from './home-client'

// Zero-await static shell: data comes from the client query cache, so
// client-side navigation here needs no server round-trip. The onboarding
// gate lives in HomeClient (the auth gate stays in the proxy).
export default function HomePage() {
  return <HomeClient />
}
