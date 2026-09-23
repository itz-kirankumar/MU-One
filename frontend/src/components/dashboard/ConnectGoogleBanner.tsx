'use client';

import React, { useState } from 'react';
import { Link2, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getGoogleAuthUrl } from '@/lib/functions';

/**
 * Prompts the student to authorize Google access.
 *
 * Signing in with Firebase only proves identity — it does not grant MU One the
 * offline access needed to sync on the student's behalf. That requires a
 * separate server-side OAuth code exchange, which starts here. Without this
 * step no refresh token is ever stored and every sync returns empty.
 */
export function ConnectGoogleBanner() {
  const { googleConnected, profileLoading } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');

  if (googleConnected) return null;

  if (profileLoading) {
    return (
      <div
        className="rounded-xl border border-[#292929] bg-[#151515] px-5 py-4 text-sm text-gray-400"
        role="status"
        aria-live="polite"
      >
        Restoring your Google connection…
      </div>
    );
  }

  async function handleConnect() {
    setConnecting(true);
    setError('');
    try {
      const { authUrl } = await getGoogleAuthUrl();
      if (!authUrl) throw new Error('No authorization URL returned.');
      // Full-page redirect into Google's consent screen.
      window.location.assign(authUrl);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start Google authorization. Please try again.'
      );
      setConnecting(false);
    }
  }

  return (
    <section
      className="rounded-xl border border-[#f7d344]/30 bg-[#1A1710] px-5 py-4"
      aria-labelledby="connect-google-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3
            id="connect-google-heading"
            className="text-sm font-semibold text-[#f7d344]"
          >
            Connect your Google account
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            MU One needs your permission to read your Masters&rsquo; Union calendar
            and mail, and to manage your Google Tasks. Until you connect, your
            dashboard will stay empty.
          </p>
          <ul className="mt-2 space-y-0.5 text-[11px] text-gray-500">
            <li>Calendar — read your classes, deadlines and sessions, and add events</li>
            <li>Gmail — read important @mastersunion.org mail, and send mail you compose</li>
            <li>Tasks — read and update your Google Tasks</li>
          </ul>
        </div>

        <button
          onClick={handleConnect}
          disabled={connecting}
          className="flex flex-shrink-0 items-center justify-center gap-2 rounded-md bg-[#f7d344] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#ffe066] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
        >
          {connecting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Link2 className="h-4 w-4" aria-hidden="true" />
          )}
          {connecting ? 'Redirecting…' : 'Connect Google'}
        </button>
      </div>

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-red-400" role="alert">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </section>
  );
}
