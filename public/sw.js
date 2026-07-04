const CACHE = 'mise-v1'
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
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
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

  // Navigation requests: network-first, fall back to offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL))
    )
  }
})
