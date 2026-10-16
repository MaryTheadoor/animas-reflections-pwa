/* Service worker — offline shell + stale-while-revalidate assets.
 *
 * v3 fixes a defect that broke the admin after every deploy: the handler was
 * cache-first for EVERYTHING, navigations included. So a returning visit was
 * served the PREVIOUS build's HTML, which references JS chunks named by a hash —
 * and the new deploy had already removed those files from the CDN. The chunk
 * request 404'd, the page rendered "This page couldn't load", and only a hard
 * refresh (or clearing site data) recovered it. It cost several rounds of
 * "the deploy didn't work" before it was diagnosed on 2026-10-16.
 *
 * The strategy now depends on what is being fetched, because those three kinds
 * of request have genuinely different rules:
 *
 *   - Navigations (the HTML): NETWORK FIRST. The document must belong to the
 *     build that is actually deployed. Cache is only an offline fallback.
 *   - /_next/static/*: CACHE FIRST. Next names these by content hash, so a
 *     cached copy always matches what the HTML asked for, and revalidation
 *     would only cost time.
 *   - Everything else same-origin (images, manifest, fonts): stale-while-
 *     revalidate, as before.
 *
 * Cross-origin requests (Firestore, Firebase Storage, Square, fonts) are left
 * alone entirely — a service worker has no business proxying them, and the old
 * handler would have tried to cache opaque responses.
 *
 * Cache version: bump CACHE_NAME whenever this file's strategy changes, so an
 * existing client purges the old cache on activate. This release moves v2 -> v3.
 */
const CACHE_NAME = "animas-reflections-v3";
/** Cached so the site still opens with no network. */
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL).catch(() => {}))
  );
  // Take over as soon as possible: the previous cache-first worker is the thing
  // being fixed, so waiting for every tab to close would leave the bug in place.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Leave other origins (Firestore, Storage, Square, Google Fonts) to the browser.
  if (url.origin !== self.location.origin) return;

  // 1. The document: always try the network, so the HTML matches the deploy.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(OFFLINE_URL, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // 2. Content-hashed build output: a cached copy is correct by construction.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // 3. Everything else: serve the cache, refresh it in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached || network;
    })
  );
});
