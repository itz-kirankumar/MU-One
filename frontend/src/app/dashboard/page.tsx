'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { WaitlistGate } from '@/components/access/WaitlistGate';

export default function DashboardPage() {
  const { user, loading, access, accessLoading } = useAuth();
  const router = useRouter();
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    const previewMode = new URLSearchParams(window.location.search).get('preview');
    setIsPreview(previewMode === 'waitlist' || previewMode === 'waitlist_joined');
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading || (user && accessLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <LoadingSpinner size="lg" label="Loading dashboard…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <LoadingSpinner size="lg" label="Redirecting…" />
      </div>
    );
  }

  if (isPreview || !access?.hasAccess) return <WaitlistGate />;

  return (
    <DashboardProvider>
      <DashboardShell />
    </DashboardProvider>
  );
}
