import FeedClient from './feed-client'

// Zero-await static shell: data comes from the client query cache, so
// client-side navigation here needs no server round-trip.
export default function FeedPage() {
  return <FeedClient />
}
