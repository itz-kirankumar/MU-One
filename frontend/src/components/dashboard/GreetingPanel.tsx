'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { Calendar, CheckCircle2, Mail } from 'lucide-react';

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
  const syncedAt = dashboardData?.syncedAt;

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#2a2a2a] bg-gradient-to-br from-[#1c1c1c] to-[#121212] px-6 py-6 shadow-md">
      {/* Subtle decorative mesh/glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#f7d344]/5 blur-[80px]" />
      
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-[#f7d344]/80">
            {today}
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {getGreeting()}, {firstName}.
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {loading ? (
              <span className="inline-block h-4 w-48 animate-pulse rounded bg-[#2A2A2A]" />
            ) : !syncedAt ? (
              'Connect your Google account to see your daily summary.'
            ) : (
              'Here is what is happening across your workspace today.'
            )}
          </p>
        </div>

        {/* Dynamic stat pills */}
        {!loading && syncedAt && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#111]/60 px-3.5 py-2.5 backdrop-blur-sm shadow-sm">
              <Calendar className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-gray-200">
                {eventCount} {eventCount === 1 ? 'event' : 'events'}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#111]/60 px-3.5 py-2.5 backdrop-blur-sm shadow-sm">
              <CheckCircle2 className="h-4 w-4 text-[#f7d344]" />
              <span className="text-sm font-medium text-gray-200">
                {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#111]/60 px-3.5 py-2.5 backdrop-blur-sm shadow-sm">
              <Mail className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-gray-200">
                {mailCount} {mailCount === 1 ? 'email' : 'emails'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
