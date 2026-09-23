'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { CalendarDays, Mail, ListChecks } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const PERMISSIONS = [
  { icon: CalendarDays, name: 'Google Calendar', detail: 'Classes, sessions and deadlines' },
  { icon: Mail, name: 'MU Mail', detail: 'Important messages and opportunities' },
  { icon: ListChecks, name: 'Google Tasks', detail: 'Your tasks in one place' },
];

const disclaimer = 'MU One is an independent, student-developed initiative. It is not an official Masters’ Union platform.';

export function SignInPage() {
  const { signIn, authError, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [agreed, setAgreed] = useState(false);

  async function handleSignIn() {
    if (!agreed) return;
    setSigningIn(true);
    try {
      await signIn();
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-[#0b0b0b] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-[#f7d344]/[0.07] blur-[100px]" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f7d344]/70 to-transparent" />

      <div className="relative mx-auto grid min-h-dvh w-full max-w-7xl grid-cols-1 items-start gap-7 px-5 pb-8 pt-8 sm:px-8 sm:pt-12 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-12 lg:py-16 xl:gap-24">
        <section className="min-w-0 lg:pr-4" aria-labelledby="welcome-heading">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black ring-1 ring-white/10 sm:h-11 sm:w-11">
              <Image src="/logo.png" alt="" fill sizes="44px" className="object-contain p-1" priority />
            </div>
            <div>
              <p className="text-lg font-bold leading-none tracking-tight sm:text-xl">MU One</p>
            </div>
          </div>

          <div className="mt-8 max-w-xl sm:mt-12 lg:mt-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f7d344]">Your student command center</p>
            <h1 id="welcome-heading" className="mt-3 text-[2.15rem] font-semibold leading-[1.08] tracking-[-0.04em] text-balance sm:text-5xl xl:text-[4rem]">
              Your MU day, <span className="text-[#f7d344]">all in one place.</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#a8abb3] sm:mt-6 sm:text-base sm:leading-7">
              See classes, deadlines, important mail and tasks together, so you can focus on what comes next.
            </p>
          </div>

          <p className="mt-10 hidden max-w-lg border-l-2 border-[#f7d344]/60 pl-4 text-xs leading-5 text-[#8e929b] lg:block">
            {disclaimer}
          </p>
        </section>

        <section aria-labelledby="sign-in-heading" className="w-full min-w-0 rounded-2xl border border-white/10 bg-[#191919] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-8 lg:ml-auto lg:max-w-[470px]">
          <h2 id="sign-in-heading" className="text-[25px] font-semibold leading-tight tracking-tight">Sign in to MU One</h2>
          <p className="mt-2 text-sm leading-6 text-[#a8abb3]">Use your Masters’ Union Google account.</p>

          <div className="mt-7 border-t border-white/10 pt-6">
            <h3 className="text-xs font-medium text-[#a8abb3]">With your permission, MU One connects to</h3>
            <ul className="mt-4 space-y-4">
              {PERMISSIONS.map(({ icon: Icon, name, detail }) => (
                <li key={name} className="flex min-w-0 items-start gap-3">
                  <Icon className="mt-0.5 h-[17px] w-[17px] shrink-0 text-[#f7d344]" strokeWidth={1.8} aria-hidden="true" />
                  <p className="min-w-0 text-[13px] leading-5 text-[#a8abb3]"><span className="font-medium text-[#ececec]">{name}</span><span aria-hidden="true"> · </span>{detail}</p>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-5 text-[#8e929b]">You can disconnect Google at any time.</p>
          </div>

          {authError && <p role="alert" className="mt-5 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-300">{authError}</p>}

          <div className="mt-6 flex items-start gap-3 border-t border-white/10 pt-6">
            <input
              id="sign-in-consent"
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#f7d344]"
            />
            <label htmlFor="sign-in-consent" className="cursor-pointer text-xs leading-5 text-[#a8abb3]">
              I agree to the <a href="/privacy" className="font-medium text-[#f7d344] underline-offset-2 hover:underline">Privacy Policy</a> and <a href="/terms" className="font-medium text-[#f7d344] underline-offset-2 hover:underline">Terms of Service</a>.
            </label>
          </div>

          <button
            type="button"
            onClick={handleSignIn}
            disabled={signingIn || loading || !agreed}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-[#f7d344] px-4 py-3 text-sm font-semibold text-[#15120a] transition-colors hover:bg-[#ffe071] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d344] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {signingIn ? <LoadingSpinner size="sm" /> : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {signingIn ? 'Signing in…' : 'Continue with Google'}
          </button>
          <p className="mt-3 text-center text-[11px] text-[#8e929b]">Only verified <span className="font-medium text-[#c6c8cd]">@mastersunion.org</span> accounts can sign in.</p>
        </section>

        <p className="text-[11px] leading-5 text-[#777c86] lg:hidden">{disclaimer}</p>
      </div>
    </main>
  );
}
