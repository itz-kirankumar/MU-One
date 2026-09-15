'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Cloud Function handles the OAuth code exchange server-side.
// This page just shows feedback and redirects.

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get('error');

  React.useEffect(() => {
    if (error) {
      router.replace(`/auth/error?reason=${encodeURIComponent(error)}`);
      return;
    }
    // Successful callback — redirect to dashboard
    const timer = setTimeout(() => {
      router.replace('/dashboard');
    }, 1500);
    return () => clearTimeout(timer);
  }, [error, router]);

  if (error) {
    return (
      <div className="text-center space-y-2">
        <p className="text-red-400 text-sm">Authentication error</p>
        <p className="text-gray-500 text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <LoadingSpinner size="lg" />
      <p className="text-gray-400 text-sm">Completing sign-in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
      <Suspense fallback={<LoadingSpinner size="lg" label="Loading…" />}>
        <CallbackContent />
      </Suspense>
    </div>
  );
}
