// KOMISIYONERI — Service Worker v3.0
// PWA: Offline support + Fast loading

const CACHE = 'komisiyoneri-v3';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icon-192.svg', '/icon-512.svg'];

// INSTALL
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// FETCH — Network first, cache fallback
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(cached => {
          if (cached) return cached;
          if (e.request.mode === 'navigate') return caches.match('/');
          // Offline image placeholder
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

console.log('[KOMISIYONERI SW v3] Loaded ✅');
