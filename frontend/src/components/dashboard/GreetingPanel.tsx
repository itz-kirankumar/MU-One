'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function GreetingPanel() {
  const { user, profile } = useAuth();
  const { dashboardData, loading } = useDashboard();

  const firstName =
    (profile?.displayName ?? user?.displayName ?? 'Student').split(' ')[0];

  const eventCount = dashboardData?.events?.length ?? 0;
  const mailCount = dashboardData?.mailSignals?.length ?? 0;
  const taskCount = dashboardData?.googleTasks?.filter((t) => !t.completed).length ?? 0;
  const calCount = dashboardData?.connectedCalendars ?? 0;
  const syncedAt = dashboardData?.syncedAt;

  function formatSyncTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] px-5 py-4">
      <h2 className="text-xl font-bold text-white">
        {getGreeting()}, {firstName}
      </h2>
      <p className="mt-1.5 text-sm text-gray-400">
        {loading ? (
          <span className="inline-block h-4 w-56 animate-pulse rounded bg-[#2A2A2A]" />
        ) : syncedAt ? (
          <>
            All sources connected · Last synced at{' '}
            <span className="text-gray-300">{formatSyncTime(syncedAt)}</span>
          </>
        ) : (
          <>
            {calCount > 0 && `Syncing ${calCount} calendar${calCount !== 1 ? 's' : ''} · `}
            {eventCount > 0 && `${eventCount} event${eventCount !== 1 ? 's' : ''} · `}
            {mailCount > 0 && `${mailCount} mail${mailCount !== 1 ? 's' : ''} · `}
            {taskCount > 0 && `${taskCount} task${taskCount !== 1 ? 's' : ''}`}
            {!calCount && !eventCount && !mailCount && !taskCount && 'Connect Google to get started'}
          </>
        )}
      </p>
    </div>
  );
}
