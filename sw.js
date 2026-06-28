// KOMISIYONERI — Service Worker v4.0
// Multi-tier caching strategy for optimal performance on 4G + low-end Android

const SHELL_CACHE  = 'km-shell-v4';   // App shell: HTML, manifest, icons
const SDK_CACHE    = 'km-sdk-v4';     // Firebase + emailjs CDN (StaleWhileRevalidate)
const FONT_CACHE   = 'km-fonts-v4';   // Google Fonts (CacheFirst — immutable)
const IMAGE_CACHE  = 'km-img-v4';     // Unsplash property images (CacheFirst, 50-item LRU)

const ALL_CACHES = [SHELL_CACHE, SDK_CACHE, FONT_CACHE, IMAGE_CACHE];

const PRECACHE_URLS = ['/', '/index.html', '/manifest.json'];

// Domains that must NEVER be intercepted (live data APIs)
const NETWORK_ONLY_PATTERNS = [
  'firestore.googleapis.com',
  'firebaseio.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'storage.googleapis.com',
  'firebasestorage.app',
  'sentry-cdn.com',
  'posthog.com',
  'google-analytics.com',
  'googletagmanager.com',
  'accounts.google.com',
  'emailjs.com'
];

// CDN scripts cached with StaleWhileRevalidate
const SDK_PATTERNS = [
  'www.gstatic.com/firebasejs/',
  'cdn.jsdelivr.net/npm/@emailjs/'
];

// Font CDNs cached with CacheFirst
const FONT_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// INSTALL — precache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE — prune old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => ALL_CACHES.indexOf(k) === -1).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH — multi-tier strategy
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = req.url;

  if (req.method !== 'GET') return;
  if (url.startsWith('chrome-extension')) return;

  // 1. NetworkOnly — live Firebase data, analytics (never intercept)
  if (NETWORK_ONLY_PATTERNS.some(p => url.includes(p))) return;

  // 2. CacheFirst — Google Fonts (immutable once fetched)
  if (FONT_PATTERNS.some(p => url.includes(p))) {
    e.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(req).then(hit => {
          if (hit) return hit;
          return fetch(req).then(res => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // 3. StaleWhileRevalidate — Firebase SDK + emailjs CDN
  if (SDK_PATTERNS.some(p => url.includes(p))) {
    e.respondWith(
      caches.open(SDK_CACHE).then(cache =>
        cache.match(req).then(cached => {
          const networkFetch = fetch(req).then(res => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          });
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // 4. CacheFirst (LRU-limited to 50) — property images from Unsplash / Firebase Storage
  if (req.destination === 'image') {
    e.respondWith(
      caches.open(IMAGE_CACHE).then(cache =>
        cache.match(req).then(hit => {
          if (hit) return hit;
          return fetch(req).then(res => {
            if (res && res.status === 200) {
              // Evict oldest entries if cache exceeds 50 images
              cache.keys().then(keys => {
                if (keys.length >= 50) cache.delete(keys[0]);
              });
              cache.put(req, res.clone());
            }
            return res;
          }).catch(() =>
            new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect width="200" height="150" fill="#e8f0fb"/><text x="100" y="80" text-anchor="middle" fill="#0D3B8C" font-size="11" font-family="sans-serif">KOMISIYONERI</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            )
          );
        })
      )
    );
    return;
  }

  // 5. NetworkFirst — HTML / SPA navigation (always fresh, cache as fallback)
  if (url.startsWith(self.location.origin)) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          caches.open(SHELL_CACHE).then(c => c.put(req, res.clone()));
        }
        return res;
      }).catch(() =>
        caches.match(req).then(cached => cached || caches.match('/index.html'))
      )
    );
  }
});

// PUSH NOTIFICATIONS
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'KOMISIYONERI', body: 'Amakuru mashya!' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'KOMISIYONERI', {
      body: data.body || 'Fungura platform ubone amakuru mashya',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: 'komisiyoneri',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || '/'));
});

console.log('[KOMISIYONERI SW v3] Loaded ✅');
