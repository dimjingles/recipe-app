const CACHE = 'mise-v1'
// Content-hashed build assets (JS, CSS, fonts): immutable, so cache-first. Kept
// across deploys (new builds get new names) and trimmed to the newest entries.
const STATIC_CACHE = 'mise-static-v1'
const STATIC_MAX_ENTRIES = 300
const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== STATIC_CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  // Never intercept API, auth, or Supabase requests — these must always be live.
  const url = new URL(req.url)
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/auth') ||
    url.hostname !== self.location.hostname
  ) return

  // Hashed build assets: serve from cache, fetch + store on a miss.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) {
          event.waitUntil(cache.put(req, res.clone()).then(() => trimCache(cache)))
        }
        return res
      })
    )
    return
  }

  // Navigation requests: network-first, fall back to offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    )
  }
})

async function trimCache(cache) {
  const keys = await cache.keys()
  // Oldest first (insertion order); drop the overflow.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_MAX_ENTRIES)).map((k) => cache.delete(k)))
}
