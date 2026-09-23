'use client';

import React, { useEffect, useState } from 'react';
import { X, Download, Share } from 'lucide-react';

// BeforeInstallPromptEvent is not in lib.dom.d.ts by default
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'android' | 'ios' | null;

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return null;
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  // Exclude desktops: must be a touch-capable device AND narrow-ish viewport
  const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  const isNarrow = window.innerWidth <= 1024;
  return hasTouch && isNarrow;
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

const DISMISS_KEY = 'mu-one-pwa-banner-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [platform] = useState<Platform>(detectPlatform);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  useEffect(() => {
    // Desktop/laptop — never show
    if (!isMobileDevice()) return;

    // Don't show if already installed as standalone
    if (isInStandaloneMode()) return;

    // Don't show if recently dismissed
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed, 10) < DISMISS_DURATION_MS) return;

    // Android: listen for the native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS: show manual guidance after a small delay (Safari doesn't fire beforeinstallprompt)
    if (platform === 'ios') {
      const timer = setTimeout(() => setShow(true), 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [platform]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
    setShowIOSSteps(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  }

  if (!show) return null;

  // ── iOS banner ─────────────────────────────────────────────────────────────
  if (platform === 'ios') {
    return (
      <div
        role="dialog"
        aria-label="Install MU One"
        className="fixed bottom-20 left-3 right-3 z-50 animate-in slide-in-from-bottom-4 duration-300"
      >
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#111] shadow-2xl overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            {/* App icon */}
            <img
              src="/icons/icon-72.png"
              alt="MU One icon"
              className="h-12 w-12 rounded-xl flex-shrink-0 border border-[#2A2A2A]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Add MU One to Home Screen</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                Access your dashboard instantly — no browser needed.
              </p>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss install banner"
              className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full bg-[#222] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {!showIOSSteps ? (
            <div className="border-t border-[#1E1E1E] flex">
              <button
                onClick={() => setShowIOSSteps(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-[#f7d344] hover:bg-[#1A1A1A] transition-colors"
              >
                <Share className="h-4 w-4" />
                How to install
              </button>
              <div className="w-px bg-[#1E1E1E]" />
              <button
                onClick={dismiss}
                className="flex-1 py-3 text-sm text-gray-500 hover:bg-[#1A1A1A] transition-colors"
              >
                Not now
              </button>
            </div>
          ) : (
            <div className="border-t border-[#1E1E1E] p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Follow these steps in Safari
              </p>
              {[
                { step: '1', text: 'Tap the Share button', sub: 'Bottom centre of Safari' },
                { step: '2', text: 'Scroll down and tap', sub: '"Add to Home Screen"' },
                { step: '3', text: 'Tap "Add" to confirm', sub: 'App icon appears on Home Screen' },
              ].map(({ step, text, sub }) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="flex-shrink-0 h-6 w-6 rounded-full bg-[#1E1E1E] border border-[#2A2A2A] flex items-center justify-center text-[10px] font-bold text-[#f7d344]">
                    {step}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-gray-200">{text}</p>
                    <p className="text-[10px] text-gray-500">{sub}</p>
                  </div>
                </div>
              ))}
              <button
                onClick={dismiss}
                className="w-full mt-2 py-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Got it
              </button>
            </div>
          )}
        </div>

        {/* iOS-style tooltip arrow pointing down */}
        <div className="mx-auto w-4 h-2 overflow-hidden">
          <div className="w-4 h-4 border border-[#2A2A2A] bg-[#111] rotate-45 translate-y-[-8px] mx-auto" />
        </div>
      </div>
    );
  }

  // ── Android banner (beforeinstallprompt) ────────────────────────────────────
  if (platform === 'android' || deferredPrompt) {
    return (
      <div
        role="dialog"
        aria-label="Install MU One"
        className="fixed bottom-20 left-3 right-3 z-50 animate-in slide-in-from-bottom-4 duration-300"
      >
        <div className="rounded-2xl border border-[#2A2A2A] bg-[#111] shadow-2xl p-4">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon-72.png"
              alt="MU One icon"
              className="h-11 w-11 rounded-xl flex-shrink-0 border border-[#2A2A2A]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Install MU One</p>
              <p className="text-xs text-gray-400 mt-0.5">Add to Home Screen for quick access</p>
            </div>
            <button
              onClick={dismiss}
              aria-label="Dismiss install banner"
              className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-full bg-[#222] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              disabled={installing || !deferredPrompt}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#f7d344] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#ffe36c] disabled:opacity-60 active:scale-95 transition-all"
            >
              <Download className="h-4 w-4" />
              {installing ? 'Installing…' : 'Install App'}
            </button>
            <button
              onClick={dismiss}
              className="px-4 py-2.5 rounded-xl border border-[#2A2A2A] text-sm text-gray-500 hover:bg-[#1A1A1A] hover:text-gray-300 transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
