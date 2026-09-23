import ProfileClient from './profile-client'

// Zero-await shell: static, prefetchable, and rendered from the client cache.
// The proxy already redirects signed-out visitors.
export default function ProfilePage() {
  return <ProfileClient />
}
