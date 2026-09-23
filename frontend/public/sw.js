// MU One Service Worker
// Handles install prompt, offline fallback, and cache-first for static assets

const CACHE_NAME = 'mu-one-v1';
const OFFLINE_URL = '/';

// Assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
  '/logo-mu-one.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // Non-fatal: pre-cache best-effort
      });
    })
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first, offline fallback ───────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests for same-origin or CDN assets
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip Firebase, Google APIs, and internal Next.js HMR
  if (
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('firebase') ||
    url.pathname.startsWith('/_next/webpack-hmr') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Static assets (_next/static) — cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navigation requests — network-first, fallback to cached root
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached || caches.match(OFFLINE_URL)
          )
        )
    );
    return;
  }
});
