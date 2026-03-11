// ════════════════════════════════════════════════════════
//  SERVICE WORKER — Full offline support
//  Strategy:
//   - Same-origin assets  → cache-first (precached on install)
//   - Known CDN assets    → cache-first with network fallback
//   - Everything else     → pass through (Firestore handles its own offline)
//   - Navigate            → serve cached index.html
// ════════════════════════════════════════════════════════

const CACHE_NAME = 'todo-v1';

const LOCAL_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/favicon.svg',
  '/js/app.js',
  '/js/modules/calendar.js',
  '/js/modules/undo.js',
  '/js/modules/utils.js',
  '/js/modules/projectView.js',
  '/js/modules/config.js',
  '/js/modules/celebrate.js',
  '/js/modules/state.js',
  '/js/modules/render.js',
  '/js/modules/admin.js',
  '/js/modules/events.js',
  '/js/modules/modal.js',
  '/js/modules/auth.js',
  '/js/modules/firebase.js',
  '/js/modules/sync.js',
  '/js/modules/storage.js',
  '/js/modules/version.js',
];

// Only these CDN prefixes are handled by the SW.
// All other external origins (googleapis.com, etc.) are left untouched
// so Firestore's own offline persistence (IndexedDB) can operate normally.
const CDN_PREFIXES = [
  'https://www.gstatic.com/firebasejs/',
  'https://cdn.jsdelivr.net/npm/gsap',
];

// ── Install: precache all local assets ───────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(LOCAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ──────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET
  if (request.method !== 'GET') return;

  // Skip API calls (localhost:3333)
  if (url.port === '3333') return;

  const isSameOrigin = url.origin === self.location.origin;
  const isCDN = CDN_PREFIXES.some(p => request.url.startsWith(p));

  // Pass through anything that isn't same-origin or a known CDN.
  // This lets Firestore, Firebase Auth, and Google APIs manage
  // their own network/offline logic without SW interference.
  if (!isSameOrigin && !isCDN) return;

  // Navigate → always serve index.html from cache (SPA)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then(r => r || fetch(request))
    );
    return;
  }

  // CDN assets → cache-first; cache on miss, fallback to cache if offline
  if (isCDN) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          // Only cache valid non-opaque responses
          if (response && response.status === 200 && response.type !== 'opaque') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => caches.match(request)); // offline fallback
      })
    );
    return;
  }

  // Same-origin assets → cache-first (already precached on install)
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
