// ════════════════════════════════════════════════════════
//  SERVICE WORKER — Full offline support
//  Strategy:
//   - Local assets  → cache-first (precached on install)
//   - CDN assets    → cache-first with network fallback
//   - API calls     → network-only (skip /todos, /backup)
//   - Navigate      → serve cached index.html
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

  // Skip non-GET and API calls (localhost:3333)
  if (request.method !== 'GET') return;
  if (url.port === '3333') return;

  // Navigate → always serve index.html from cache
  if (request.mode === 'navigate') {
    event.respondWith(caches.match('/index.html'));
    return;
  }

  // CDN assets → cache-first, cache on miss
  const isCDN = CDN_PREFIXES.some(p => request.url.startsWith(p));
  if (isCDN) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Local assets → cache-first
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
