// ════════════════════════════════════════════════════════
//  SERVICE WORKER — Full offline support
// ════════════════════════════════════════════════════════

// Bumped manually, not tied to js/modules/version.js: this file is
// registered as a classic (non-module) script, so it can't `import` that
// module, and browsers only re-run install()/re-check for updates when
// sw.js's OWN bytes change — not when app.js/css change. In practice this
// matters less than it sounds: the fetch handler below is network-first for
// same-origin requests, so the cache is only ever an offline fallback, not
// something actively serving stale content while online. The real gap this
// used to paper over (a tab left open across a deploy keeps running its
// already-evaluated JS in memory) is handled by app.js's
// _initVersionWatch()/_checkForNewVersion() instead — it prompts a reload
// when the server's VERSION no longer matches what's running, independent
// of this cache. Bump this string on structural changes to LOCAL_ASSETS.
const CACHE_NAME = 'todo-v5-changelog';

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
  '/js/modules/supabase.js',
  '/js/modules/sync.js',
  '/js/modules/storage.js',
  '/js/modules/version.js',
  '/js/modules/changelog.json',
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js',
  'https://esm.sh/@supabase/supabase-js@2',
];

// Only these CDN prefixes are intercepted by the SW.
const CDN_PREFIXES = [
  'https://esm.sh/@supabase/',
  'https://cdn.jsdelivr.net/npm/gsap',
];

// ── Helpers ───────────────────────────────────────────────
async function precacheCDN(cache) {
  // Fetch each CDN asset explicitly with cors mode and cache it.
  // Failures are caught individually so one bad URL can't block the rest.
  await Promise.allSettled(CDN_ASSETS.map(async url => {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) await cache.put(url, res);
  }));
}

// ── Install ───────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(LOCAL_ASSETS); // must all succeed
      await precacheCDN(cache);         // best-effort
    }).then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────
// After claiming clients, push a message to every open tab so app.js's
// message listener can show the "reload" toast immediately — the same
// prompt _checkForNewVersion()'s polling shows, just without waiting for
// the next visibility/focus/30min tick. Still only reaches tabs whose
// currently-loaded JS has that listener; a tab stuck on JS old enough to
// predate this mechanism entirely has no code path that could act on it —
// that one genuinely needs a manual reload once, there's no way around it.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
  );
});

// ── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.port === '3333') return; // local API — skip

  const isSameOrigin = url.origin === self.location.origin;
  const isCDN = CDN_PREFIXES.some(p => request.url.startsWith(p));

  // Pass through anything outside our known set (Supabase API, Auth endpoints…)
  if (!isSameOrigin && !isCDN) return;

  // CDN → cache-first (immutable versioned assets)
  if (isCDN) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request, { mode: 'cors' }).then(res => {
          if (res && res.ok) {
            const cloned = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, cloned));
          }
          return res;
        }).catch(() => caches.match(request));
      })
    );
    return;
  }

  // Same-origin (including navigate) → network-first, cache fallback if offline
  event.respondWith(
    fetch(request).then(res => {
      if (res && res.ok) {
        const cloned = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, cloned));
      }
      return res;
    }).catch(() => caches.match(request))
  );
});
