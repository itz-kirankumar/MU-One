'use client';

import { useState, useSyncExternalStore } from 'react';

const NOTICE_VERSION = '2026-09';

function subscribeToStorage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

export function DevelopmentNotice({ userId, enabled, preview = false }: { userId?: string; enabled: boolean; preview?: boolean }) {
  const [dismissedKey, setDismissedKey] = useState('');
  const storageKey = userId ? `muone:development-notice:${NOTICE_VERSION}:${userId}` : '';
  const seen = useSyncExternalStore(subscribeToStorage, () => {
    if (!storageKey) return true;
    try {
      return window.localStorage.getItem(storageKey) === 'seen';
    } catch {
      return false;
    }
  }, () => true);
  const open = enabled && Boolean(storageKey) && dismissedKey !== storageKey && (preview || !seen);

  function dismiss() {
    if (!preview) {
      try {
        window.localStorage.setItem(storageKey, 'seen');
      } catch {
        // The notice can still be dismissed when browser storage is unavailable.
      }
    }
    setDismissedKey(storageKey);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="development-notice-title"
      aria-describedby="development-notice-description"
      onKeyDown={(event) => {
        if (event.key === 'Escape') dismiss();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-[#333] bg-[#181818] p-6 shadow-2xl">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f7d344]">Beta notice</span>
        <h2 id="development-notice-title" className="mt-3 text-xl font-semibold text-white">We’re still building MU One</h2>
        <p id="development-notice-description" className="mt-3 text-sm leading-6 text-gray-300">
          The platform and more features are under development. Some tools may be incomplete or may not work as expected while we improve the beta.
        </p>
        <button
          type="button"
          autoFocus
          onClick={dismiss}
          className="mt-6 w-full rounded-lg bg-[#f7d344] px-4 py-2.5 text-sm font-semibold text-[#17140a] hover:bg-[#ffe071] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d344]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
