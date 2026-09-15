'use client';

import React from 'react';
import { Calendar, Mail, CheckSquare, CalendarDays } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';

function HealthDot({ status }: { status?: 'ok' | 'warning' | 'error' }) {
  const colors = {
    ok: 'bg-green-500',
    warning: 'bg-yellow-400',
    error: 'bg-red-500',
    undefined: 'bg-gray-600',
  };
  const label = { ok: 'Connected', warning: 'Warning', error: 'Error', undefined: 'Unknown' };
  const s = status ?? 'undefined';
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[s]}`}
      aria-label={label[s]}
      title={label[s]}
    />
  );
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  healthStatus?: 'ok' | 'warning' | 'error';
  loading?: boolean;
}

function MetricCard({ icon: Icon, label, value, healthStatus, loading }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] px-4 py-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-gray-500" aria-hidden="true" />
        <HealthDot status={healthStatus} />
      </div>
      {loading ? (
        <div className="h-8 w-16 animate-pulse rounded bg-[#2A2A2A]" />
      ) : (
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      )}
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export function SourceMetrics() {
  const { dashboardData, syncStatus, loading } = useDashboard();

  const calendarCount = dashboardData?.connectedCalendars ?? 0;
  const eventCount = dashboardData?.events?.length ?? 0;
  const mailCount = dashboardData?.mailSignals?.length ?? 0;
  const taskCount = dashboardData?.googleTasks?.filter((t) => !t.completed).length ?? 0;

  const health = syncStatus?.sourceHealth;
  const lastSynced = syncStatus?.lastSyncedAt;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          icon={CalendarDays}
          label="Connected Calendars"
          value={calendarCount}
          healthStatus={health?.calendar?.status}
          loading={loading}
        />
        <MetricCard
          icon={Calendar}
          label="Upcoming Events"
          value={eventCount}
          healthStatus={health?.calendar?.status}
          loading={loading}
        />
        <MetricCard
          icon={Mail}
          label="Important Mail"
          value={mailCount}
          healthStatus={health?.gmail?.status}
          loading={loading}
        />
        <MetricCard
          icon={CheckSquare}
          label="Google Tasks"
          value={taskCount}
          healthStatus={health?.tasks?.status}
          loading={loading}
        />
      </div>
      {lastSynced && (
        <p className="text-right text-[10px] text-gray-600">
          Last synced:{' '}
          {new Date(lastSynced).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  );
}
