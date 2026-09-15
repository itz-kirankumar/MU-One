'use client';

import React, { useState } from 'react';
import { CalendarDays, Mail, CheckSquare, AlertCircle, CheckCircle2, MinusCircle, Loader2 } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { disconnectGoogleAccount } from '@/lib/functions';
import type { SourceHealth } from '@/types';

function StatusBadge({ status }: { status?: 'ok' | 'warning' | 'error' }) {
  // No health data at all means no sync has ever reported on this source.
  // Claiming "Connected" here is actively misleading — it is the exact state
  // a user sees when the backend has never run.
  if (!status) {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-500">
        <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Not connected
      </span>
    );
  }
  if (status === 'ok') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-400">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Connected
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="flex items-center gap-1 text-xs text-yellow-400">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Warning
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-400">
      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
      Error
    </span>
  );
}

interface SourceRowProps {
  icon: React.ElementType;
  name: string;
  health?: SourceHealth;
}

function SourceRow({ icon: Icon, name, health }: SourceRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[#1A1A1A] border border-[#2A2A2A]">
        <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-200">{name}</span>
          <StatusBadge status={health?.status} />
        </div>
        {health?.message && (
          <p className="mt-0.5 text-xs text-gray-500">{health.message}</p>
        )}
        {health?.status === 'error' && (
          <p className="mt-0.5 text-xs text-gray-500">
            {name} temporarily unavailable — other data is still shown
          </p>
        )}
        {health?.lastSyncedAt && (
          <p className="mt-0.5 text-[10px] text-gray-600">
            Last synced:{' '}
            {new Date(health.lastSyncedAt).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  );
}

export function ConnectedSources() {
  const { syncStatus, dashboardData } = useDashboard();
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [disconnectError, setDisconnectError] = useState('');
  const [disconnectSuccess, setDisconnectSuccess] = useState(false);

  const rawHealth =
    syncStatus?.sourceHealth ??
    (dashboardData as { sourceHealth?: Record<string, SourceHealth> })?.sourceHealth;

  const calendarHealth: SourceHealth | undefined =
    rawHealth?.calendar ??
    (dashboardData?.events?.length || (dashboardData as { deadlines?: unknown[] })?.deadlines?.length
      ? { status: 'ok' }
      : undefined);

  const mailHealth: SourceHealth | undefined =
    rawHealth?.gmail ??
    (rawHealth as Record<string, SourceHealth | undefined>)?.mail ??
    (dashboardData?.mailSignals?.length || (dashboardData as { importantMail?: unknown[] })?.importantMail?.length
      ? { status: 'ok' }
      : undefined);

  const tasksHealth: SourceHealth | undefined =
    rawHealth?.tasks ??
    (dashboardData?.googleTasks?.length
      ? { status: 'ok' }
      : undefined);

  async function handleDisconnect() {
    setDisconnecting(true);
    setDisconnectError('');
    try {
      await disconnectGoogleAccount();
      setDisconnectSuccess(true);
      setShowConfirm(false);
    } catch (err: unknown) {
      setDisconnectError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <>
      <section className="rounded-xl border border-[#222] bg-[#161616] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1A1A1A]">
          <h3 className="text-sm font-semibold text-white">Connected Sources</h3>
        </div>

        <div className="px-2 py-2 divide-y divide-[#1A1A1A]">
          <SourceRow icon={CalendarDays} name="Google Calendar" health={calendarHealth} />
          <SourceRow icon={Mail} name="MU Mail" health={mailHealth} />
          <SourceRow icon={CheckSquare} name="Google Tasks" health={tasksHealth} />
        </div>

        <div className="border-t border-[#1A1A1A] px-5 py-4">
          {disconnectSuccess ? (
            <p className="text-sm text-green-400">Google account disconnected.</p>
          ) : (
            <>
              <button
                onClick={() => setShowConfirm(true)}
                className="text-sm text-red-400 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344] rounded"
              >
                Disconnect Google Account
              </button>
              {disconnectError && (
                <p className="mt-1.5 text-xs text-red-400">{disconnectError}</p>
              )}
            </>
          )}
        </div>
      </section>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm disconnect"
        >
          <div className="w-full max-w-sm rounded-xl border border-[#2A2A2A] bg-[#161616] p-5 space-y-4">
            <h4 className="text-sm font-semibold text-white">Disconnect Google Account?</h4>
            <p className="text-sm text-gray-400">
              This will revoke access to your Google Calendar, Gmail, and Tasks. You can
              reconnect at any time.
            </p>
            {disconnectError && <p className="text-xs text-red-400">{disconnectError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-md border border-[#2A2A2A] px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 rounded-md bg-red-900/60 border border-red-800/40 px-3 py-1.5 text-xs font-medium text-red-300 disabled:opacity-50 hover:bg-red-900/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
              >
                {disconnecting && <Loader2 className="h-3 w-3 animate-spin" />}
                Yes, disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
