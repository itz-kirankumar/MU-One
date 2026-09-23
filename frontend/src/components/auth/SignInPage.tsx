'use client';

import React from 'react';
import Image from 'next/image';
import { Calendar, Mail, CheckSquare, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const PERMISSIONS = [
  {
    icon: Calendar,
    text: "We'll connect your Google Calendar to surface classes, deadlines, and sessions",
  },
  {
    icon: Mail,
    text: "We'll read important Masters' Union emails about assignments and opportunities",
  },
  {
    icon: CheckSquare,
    text: "We'll sync your Google Tasks so you can manage them from one place",
  },
  {
    icon: ShieldCheck,
    text: "You can disconnect at any time from your dashboard",
  },
];

export function SignInPage() {
  const { signIn, authError, loading } = useAuth();
  const [signingIn, setSigningIn] = React.useState(false);

  async function handleSignIn() {
    setSigningIn(true);
    try {
      await signIn();
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-4 py-12">
      {/* Card */}
      <div className="w-full max-w-md rounded-xl border border-[#222] bg-[#161616] p-8 shadow-2xl">

        {/* Branding */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative h-10 w-10">
            <Image
              src="/assets/mulogo.webp"
              alt="Masters' Union"
              fill
              sizes="40px"
              className="object-contain"
              priority
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white">MU One</h1>
            <p className="mt-1 text-sm text-gray-400">Student Command Center</p>
          </div>
        </div>

        {/* Permissions explanation */}
        <div className="mb-8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            What we&apos;ll access
          </p>
          <ul className="space-y-3">
            {PERMISSIONS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 text-[#f7d344]">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <span className="text-sm text-gray-300 leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Error message */}
        {authError && (
          <div className="mb-4 rounded-lg border border-red-800/40 bg-red-900/20 px-4 py-3">
            <p className="text-sm text-red-400">{authError}</p>
          </div>
        )}

        {/* Sign-in button */}
        <button
          onClick={handleSignIn}
          disabled={signingIn || loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#f7d344] px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#161616]"
        >
          {signingIn ? (
            <LoadingSpinner size="sm" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          {signingIn ? 'Signing in…' : 'Sign in with Google'}
        </button>

        {/* Domain restriction notice */}
        <p className="mt-5 text-center text-xs text-gray-500">
          Only{' '}
          <span className="font-medium text-gray-400">@mastersunion.org</span>{' '}
          accounts can sign in
        </p>
      </div>
    </div>
  );
}
