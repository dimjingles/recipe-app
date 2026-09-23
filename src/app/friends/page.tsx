import FriendsClient from './friends-client'

// Zero-await shell: static, prefetchable, and rendered from the client cache.
// The proxy already redirects signed-out visitors.
export default function FriendsPage() {
  return <FriendsClient />
}
