'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { PlatformLoader } from '@/components/ui/PlatformLoader';
import { WaitlistGate } from '@/components/access/WaitlistGate';

function subscribeToLocation(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

function getPreviewMode() {
  return new URLSearchParams(window.location.search).get('preview');
}

export default function DashboardPage() {
  const { user, loading, access, accessLoading } = useAuth();
  const router = useRouter();
  const previewMode = useSyncExternalStore(subscribeToLocation, getPreviewMode, () => undefined);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading || (user && accessLoading) || previewMode === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <PlatformLoader label="Loading dashboard" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <PlatformLoader label="Redirecting" />
      </div>
    );
  }

  if (previewMode === 'waitlist' || previewMode === 'waitlist_joined' || !access?.hasAccess) return <WaitlistGate />;

  return (
    <DashboardProvider>
      <DashboardShell userPreview={previewMode === 'user' && access.isAdmin === true} />
    </DashboardProvider>
  );
}
