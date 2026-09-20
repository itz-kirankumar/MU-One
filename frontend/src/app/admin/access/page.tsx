'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AccessControl } from '@/components/access/AccessControl';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function AccessControlPage() {
  const { user, loading, access, accessLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !accessLoading && (!user || !access?.isAdmin)) router.replace('/dashboard');
  }, [user, loading, access, accessLoading, router]);

  if (loading || accessLoading || !user || !access?.isAdmin) {
    return <div className="grid min-h-screen place-items-center bg-[#090909]"><LoadingSpinner size="lg" label="Verifying administrator…" /></div>;
  }

  return <AccessControl />;
}
