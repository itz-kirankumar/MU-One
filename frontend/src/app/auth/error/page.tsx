'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

function ErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  const isDomainRejection =
    !reason || reason.toLowerCase().includes('domain') || reason.toLowerCase().includes('mastersunion');

  return (
    <div className="w-full max-w-md rounded-xl border border-[#222] bg-[#161616] p-8 text-center space-y-4">
      <div className="flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-900/30 border border-red-800/40">
          <ShieldAlert className="h-6 w-6 text-red-400" aria-hidden="true" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-lg font-bold text-white">Access Denied</h1>
        <p className="text-sm text-gray-400">
          {isDomainRejection
            ? "Only Masters' Union student accounts can access MU One."
            : reason ?? 'An authentication error occurred.'}
        </p>
      </div>

      {reason && !isDomainRejection && (
        <p className="text-xs text-gray-600 font-mono">{reason}</p>
      )}

      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 text-sm text-gray-300 hover:bg-[#222] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344] transition-colors"
      >
        Back to sign in
      </Link>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-xl border border-[#222] bg-[#161616] p-8 text-center">
            <p className="text-gray-400 text-sm">Loading…</p>
          </div>
        }
      >
        <ErrorContent />
      </Suspense>
    </div>
  );
}
