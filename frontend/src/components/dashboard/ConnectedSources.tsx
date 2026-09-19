'use client';

import React, { useState } from 'react';
import { CalendarDays, Mail, CheckSquare, AlertCircle, CheckCircle2, MinusCircle, Loader2 } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { disconnectGoogleAccount } from '@/lib/functions';
import type { SourceHealth } from '@/types';

function StatusBadge({ status }: { status?: 'ok' | 'warning' | 'error' | string }) {
  const s = typeof status === 'string' ? status.toLowerCase() : '';
  if (s === 'ok' || s === 'connected') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Connected
      </span>
    );
  }
  if (s === 'warning') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        Warning
      </span>
    );
  }
  if (s === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        Error
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
      <MinusCircle className="h-4 w-4" aria-hidden="true" />
      Not connected
    </span>
  );
}

interface SourceRowProps {
  icon: React.ElementType;
  name: string;
  health?: SourceHealth | string;
}

function SourceRow({ icon: Icon, name, health }: SourceRowProps) {
  const status = typeof health === 'string' ? health : health?.status;
  const lastSynced = typeof health === 'object' ? health?.lastSyncedAt : undefined;
  const message = typeof health === 'object' ? health?.message : undefined;

  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[#1A1A1A] border border-[#2A2A2A]">
        <Icon className="h-4 w-4 text-gray-400" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-200">{name}</span>
          <StatusBadge status={status} />
        </div>
        {message && (
          <p className="mt-0.5 text-xs text-gray-500">{message}</p>
        )}
        {status === 'error' && (
          <p className="mt-0.5 text-xs text-gray-500">
            {name} temporarily unavailable — other data is still shown
          </p>
        )}
        {lastSynced && (
          <p className="mt-0.5 text-[10px] text-gray-500">
            Last synced:{' '}
            {new Date(lastSynced).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
    </div>
  );
}

interface ConnectedSourcesProps {
  inSidebar?: boolean;
  collapsed?: boolean;
}

function SidebarSourceRow({
  icon: Icon,
  name,
  health,
}: {
  icon: React.ElementType;
  name: string;
  health?: SourceHealth;
}) {
  const status = health?.status;
  const lastSynced = health?.lastSyncedAt;
  const isConnected = status === 'ok';

  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[#141414] transition-colors group">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-[#181818] border border-[#242424]">
          <Icon className="h-3 w-3 text-gray-400 group-hover:text-white transition-colors" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-gray-200">{name}</p>
          {lastSynced && (
            <p className="text-[10px] text-gray-500 tabular-nums leading-none mt-0.5">
              Synced{' '}
              {new Date(lastSynced).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 ml-1">
        {isConnected ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-[10px]">Connected</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
            <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-[10px]">Offline</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function ConnectedSources({ inSidebar = false, collapsed = false }: ConnectedSourcesProps) {
  const { syncStatus, dashboardData } = useDashboard();
  const { googleConnected } = useAuth();
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [disconnectError, setDisconnectError] = useState('');
  const [disconnectSuccess, setDisconnectSuccess] = useState(false);

  const isGoogleConnected = googleConnected;
  const hasCalendar = Boolean(
    dashboardData?.events?.length ||
    (dashboardData as Record<string, unknown> | null)?.deadlines ||
    (dashboardData as Record<string, unknown> | null)?.connectedCalendars
  );
  const hasMail = Boolean(
    dashboardData?.mailSignals?.length ||
    (dashboardData as Record<string, unknown> | null)?.importantMail
  );
  const hasTasks = Boolean(dashboardData?.googleTasks?.length);

  const lastSyncedAt = syncStatus?.lastSyncedAt;
  const rawHealth = syncStatus?.sourceHealth;

  const calendarHealth: SourceHealth | undefined =
    rawHealth?.calendar ??
    (isGoogleConnected || hasCalendar ? { status: 'ok', lastSyncedAt } : undefined);

  const mailHealth: SourceHealth | undefined =
    rawHealth?.gmail ??
    (isGoogleConnected || hasMail ? { status: 'ok', lastSyncedAt } : undefined);

  const tasksHealth: SourceHealth | undefined =
    rawHealth?.tasks ??
    (isGoogleConnected || hasTasks ? { status: 'ok', lastSyncedAt } : undefined);

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

  // Confirm modal rendered for both sidebar and standalone views
  const confirmModal = showConfirm && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
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
  );

  // Sidebar mode
  if (inSidebar) {
    if (collapsed) {
      return (
        <>
          <div className="flex flex-col items-center gap-2.5 py-1">
            <div
              className="relative flex h-8 w-8 items-center justify-center rounded-md bg-[#161616] border border-[#242424] cursor-default"
              title={`Google Calendar: ${calendarHealth?.status === 'ok' ? 'Connected' : 'Offline'}`}
            >
              <CalendarDays className="h-4 w-4 text-gray-400" />
              <div
                className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-[#0A0A0A] ${
                  calendarHealth?.status === 'ok' ? 'bg-emerald-500' : 'bg-gray-600'
                }`}
              />
            </div>
            <div
              className="relative flex h-8 w-8 items-center justify-center rounded-md bg-[#161616] border border-[#242424] cursor-default"
              title={`MU Mail: ${mailHealth?.status === 'ok' ? 'Connected' : 'Offline'}`}
            >
              <Mail className="h-4 w-4 text-gray-400" />
              <div
                className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-[#0A0A0A] ${
                  mailHealth?.status === 'ok' ? 'bg-emerald-500' : 'bg-gray-600'
                }`}
              />
            </div>
            <div
              className="relative flex h-8 w-8 items-center justify-center rounded-md bg-[#161616] border border-[#242424] cursor-default"
              title={`Google Tasks: ${tasksHealth?.status === 'ok' ? 'Connected' : 'Offline'}`}
            >
              <CheckSquare className="h-4 w-4 text-gray-400" />
              <div
                className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-[#0A0A0A] ${
                  tasksHealth?.status === 'ok' ? 'bg-emerald-500' : 'bg-gray-600'
                }`}
              />
            </div>
          </div>
          {confirmModal}
        </>
      );
    }

    return (
      <>
        <div className="space-y-2">
          <div className="px-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Connected Sources
            </span>
          </div>

          <div className="space-y-0.5">
            <SidebarSourceRow icon={CalendarDays} name="Google Calendar" health={calendarHealth} />
            <SidebarSourceRow icon={Mail} name="MU Mail" health={mailHealth} />
            <SidebarSourceRow icon={CheckSquare} name="Google Tasks" health={tasksHealth} />
          </div>

          <div className="pt-1 px-1.5">
            {disconnectSuccess ? (
              <p className="text-[10px] text-green-400">Account disconnected.</p>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="text-[11px] text-red-400/80 hover:text-red-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344] rounded"
              >
                Disconnect Google Account
              </button>
            )}
            {disconnectError && (
              <p className="mt-1 text-[10px] text-red-400">{disconnectError}</p>
            )}
          </div>
        </div>
        {confirmModal}
      </>
    );
  }

  // Standalone card mode (fallback)
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

      {confirmModal}
    </>
  );
}
