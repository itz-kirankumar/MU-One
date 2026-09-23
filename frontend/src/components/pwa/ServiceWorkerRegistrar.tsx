'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // Cached Next.js chunks can survive edits in a local dev server and keep
    // rendering an old dashboard (including an outdated sidebar).
    if (process.env.NODE_ENV !== 'production' || ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      void navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(
          registrations
            .filter((registration) => new URL(registration.scope).origin === window.location.origin)
            .map((registration) => registration.unregister())
        ))
        .catch((error) => console.warn('[SW] Local cleanup failed:', error));
      if ('caches' in window) {
        void caches.keys()
          .then((keys) => Promise.all(keys.filter((key) => key.startsWith('mu-one-')).map((key) => caches.delete(key))))
          .catch((error) => console.warn('[SW] Local cache cleanup failed:', error));
      }
      return;
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        // Check for updates every 60 minutes
        setInterval(() => reg.update(), 60 * 60 * 1000);
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  }, []);

  return null;
}
