// KOMISIYONERI — Service Worker v4.0
// PWA: Offline support + Tiered caching strategy

const CACHE_SHELL   = 'km-shell-v4';
const CACHE_FONTS   = 'km-fonts-v4';
const CACHE_FIREBASE = 'km-firebase-v4';

const SHELL_FILES = ['/', '/index.html', '/manifest.json', '/icon-192.svg', '/icon-512.svg'];

// INSTALL — precache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_SHELL)
      .then(c => c.addAll(SHELL_FILES).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE — purge old caches
self.addEventListener('activate', e => {
  const VALID = new Set([CACHE_SHELL, CACHE_FONTS, CACHE_FIREBASE]);
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !VALID.has(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// FETCH — tiered caching strategy
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;

  const url = e.request.url;

  // Fonts — cache-first (fonts never change)
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(CACHE_FONTS).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res && res.status === 200) cache.put(e.request, res.clone());
            return res;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // Firebase SDK — stale-while-revalidate (versioned URLs, safe to cache)
  if (url.includes('gstatic.com/firebasejs') || url.includes('cdn.jsdelivr.net')) {
    e.respondWith(
      caches.open(CACHE_FIREBASE).then(cache =>
        cache.match(e.request).then(cached => {
          const fetchPromise = fetch(e.request).then(res => {
            if (res && res.status === 200) cache.put(e.request, res.clone());
            return res;
          });
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // App shell & local assets — network-first, cache fallback
  if (!url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_SHELL).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(cached => {
          if (cached) return cached;
          if (e.request.mode === 'navigate') return caches.match('/');
          if (e.request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect width="200" height="150" fill="#e8f0fb"/><text x="100" y="75" text-anchor="middle" fill="#0D3B8C" font-size="12" font-family="sans-serif">KOMISIYONERI</text><text x="100" y="95" text-anchor="middle" fill="#6b7280" font-size="10" font-family="sans-serif">Offline</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
        })
      )
  );
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

console.log('[KOMISIYONERI SW v4] Loaded — tiered cache strategy active');
