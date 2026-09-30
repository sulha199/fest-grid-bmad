// Story 0.38 (AC1-AC4, AD-21) — a dedicated, narrowly-scoped service worker that
// caches exactly one third-party script (Instagram's `embed.js`) via a
// stale-while-revalidate strategy. This is NOT a general-purpose asset cache:
// every other request within this worker's scope passes through untouched
// (no `event.respondWith(...)` call for anything else).
//
// Deliberately a SEPARATE file/registration from `apps/web/public/firebase-messaging-sw.js`
// (root-scoped, unrelated FCM push delivery) and from `apps/web/public/embed.js`
// (this project's own, same-origin FestDaily widget-embedding script, Epic 6 —
// completely unrelated to Instagram's cross-origin `embed.js`). Registered
// per-locale, scoped to `/${locale}/events/` (AD-21 rule 3), from
// `EventDetailWrapper.tsx`.

const INSTAGRAM_EMBED_CACHE_NAME = 'festdaily-instagram-embed-cache-v1';
const INSTAGRAM_EMBED_HOSTNAME = 'www.instagram.com';
const INSTAGRAM_EMBED_PATHNAME = '/embed.js';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function isInstagramEmbedScriptRequest(request) {
  // AC3 — matched defensively via URL hostname+pathname, never a substring
  // check, so this never accidentally matches this repo's own same-origin
  // `/embed.js` (which wouldn't reach this handler anyway, since it's
  // same-origin, but the explicit check documents the distinction).
  let url;
  try {
    url = new URL(request.url);
  } catch (_err) {
    return false;
  }
  return url.hostname === INSTAGRAM_EMBED_HOSTNAME && url.pathname === INSTAGRAM_EMBED_PATHNAME;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(INSTAGRAM_EMBED_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const networkFetch = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => undefined);

  if (cachedResponse) {
    // Serve the cache immediately; revalidate in the background for next time.
    networkFetch.catch(() => {});
    return cachedResponse;
  }

  // Nothing cached yet — fall through to the network and cache a successful response.
  const networkResponse = await networkFetch;
  if (networkResponse) {
    return networkResponse;
  }
  // Network failed and nothing was cached — surface a real fetch to let the
  // browser's normal error handling take over rather than swallowing it.
  return fetch(request);
}

self.addEventListener('fetch', (event) => {
  if (!isInstagramEmbedScriptRequest(event.request)) {
    // AC4 — every other request (this page's own JS chunks, GraphQL calls,
    // images) is left completely untouched: no `respondWith` call at all.
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});
