'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardProvider } from '@/contexts/DashboardContext';
import { DashboardShell } from '@/components/layout/DashboardShell';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading) {
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

  return (
    <DashboardProvider>
      <DashboardShell />
    </DashboardProvider>
  );
}
