// KOMISIYONERI — Service Worker v2.0
// Caches platform for offline use

const CACHE_NAME = 'komisiyoneri-v2';
const OFFLINE_URL = '/';

// Files to cache immediately
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ═══════════════════════════════
// INSTALL — Cache core files
// ═══════════════════════════════
self.addEventListener('install', function(event) {
  console.log('[SW] Installing KOMISIYONERI Service Worker v2');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS).catch(function(err) {
        console.log('[SW] Pre-cache failed (normal on first run):', err.message);
        return Promise.resolve();
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ═══════════════════════════════
// ACTIVATE — Clean old caches
// ═══════════════════════════════
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating KOMISIYONERI Service Worker v2');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ═══════════════════════════════
// FETCH — Network first, cache fallback
// ═══════════════════════════════
self.addEventListener('fetch', function(event) {
  // Skip non-GET and external requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  
  // Skip API calls — always use network
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    // Try network first
    fetch(event.request)
      .then(function(networkResponse) {
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
          var responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(function() {
        // Network failed — try cache
        return caches.match(event.request).then(function(cachedResponse) {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return main page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/') || caches.match('/index.html');
          }
          // Return offline page for images
          if (event.request.destination === 'image') {
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect width="200" height="150" fill="#f0f5ff"/><text x="100" y="80" text-anchor="middle" fill="#0D3B8C" font-size="14">KOMISIYONERI</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          }
        });
      })
  );
});

// ═══════════════════════════════
// PUSH NOTIFICATIONS (future)
// ═══════════════════════════════
self.addEventListener('push', function(event) {
  if (!event.data) return;
  var data = {};
  try { data = event.data.json(); } catch(e) { data = { title: 'KOMISIYONERI', body: event.data.text() }; }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'KOMISIYONERI', {
      body: data.body || 'Amakuru mashya ari hano!',
      icon: '/manifest.json',
      badge: '/manifest.json',
      tag: 'komisiyoneri-notification',
      data: data.url || '/',
      actions: [
        { action: 'open', title: 'Fungura' },
        { action: 'close', title: 'Funga' }
      ]
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data || '/'));
  }
});

console.log('[SW] KOMISIYONERI Service Worker loaded ✅');
