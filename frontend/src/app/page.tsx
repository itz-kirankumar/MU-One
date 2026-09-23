'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { SignInPage } from '@/components/auth/SignInPage';
import { PlatformLoader } from '@/components/ui/PlatformLoader';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <PlatformLoader label="Loading MU One" />
      </div>
    );
  }

  if (user) {
    // Redirect in progress
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <PlatformLoader label="Redirecting" />
      </div>
    );
  }

  return <SignInPage />;
}
