'use client';

import React, { useState, useEffect } from 'react';
import { CalendarDays, Mail, CheckSquare, AlertCircle, CheckCircle2, MinusCircle, Loader2 } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { disconnectGoogleAccount } from '@/lib/functions';
import { founderApi } from '@/lib/founder';
import type { SourceHealth } from '@/types';

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <img
      src="/linkedin.png"
      alt="LinkedIn"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}

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
  const { user, googleConnected } = useAuth();
  const [disconnecting, setDisconnecting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [disconnectError, setDisconnectError] = useState('');
  const [disconnectSuccess, setDisconnectSuccess] = useState(false);

  const [linkedinData, setLinkedinData] = useState<{ linkedAt?: string; name?: string } | null>(null);
  const [linkedinStatusError, setLinkedinStatusError] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    let mounted = true;
    founderApi.connectionStatus()
      .then(({ linkedinConnection }) => {
        if (!mounted) return;
        setLinkedinData(linkedinConnection);
        setLinkedinStatusError(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLinkedinData(null);
        setLinkedinStatusError(true);
      });
    return () => { mounted = false; };
  }, [user?.uid]);

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

  const calendarHealth: SourceHealth | undefined = isGoogleConnected ? (
    rawHealth?.calendar ?? (hasCalendar ? { status: 'ok', lastSyncedAt } : undefined)
  ) : undefined;

  const mailHealth: SourceHealth | undefined = isGoogleConnected ? (
    rawHealth?.gmail ?? (hasMail ? { status: 'ok', lastSyncedAt } : undefined)
  ) : undefined;

  const tasksHealth: SourceHealth | undefined = isGoogleConnected ? (
    rawHealth?.tasks ?? (hasTasks ? { status: 'ok', lastSyncedAt } : undefined)
  ) : undefined;

  const linkedinHealth: SourceHealth | undefined = linkedinData ? {
    status: 'ok',
    lastSyncedAt: linkedinData.linkedAt,
  } : undefined;

  function openDisconnectConfirm() {
    setConfirmationText('');
    setDisconnectError('');
    setShowConfirm(true);
  }

  function closeDisconnectConfirm() {
    if (disconnecting) return;
    setShowConfirm(false);
    setConfirmationText('');
    setDisconnectError('');
  }

  async function handleDisconnect() {
    if (confirmationText.trim() !== 'confirm' || disconnecting) return;
    setDisconnecting(true);
    setDisconnectError('');
    try {
      await disconnectGoogleAccount();
      setDisconnectSuccess(true);
      setShowConfirm(false);
      setConfirmationText('');
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
      aria-labelledby="disconnect-title"
      aria-describedby="disconnect-description"
      onKeyDown={(event) => {
        if (event.key === 'Escape') closeDisconnectConfirm();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleDisconnect();
        }}
        className="w-full max-w-sm rounded-xl border border-[#2A2A2A] bg-[#161616] p-5 shadow-2xl"
      >
        <h4 id="disconnect-title" className="text-base font-semibold text-white">Disconnect Google account?</h4>
        <p id="disconnect-description" className="mt-2 text-sm leading-6 text-gray-400">
          MU One will lose access to your Google Calendar, Mail, and Tasks. You can reconnect later.
        </p>
        <label htmlFor="disconnect-confirmation" className="mt-5 block text-xs font-medium text-gray-300">
          Type <strong className="text-white">confirm</strong> to disconnect
        </label>
        <input
          id="disconnect-confirmation"
          type="text"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          maxLength={32}
          value={confirmationText}
          onChange={(event) => setConfirmationText(event.target.value)}
          disabled={disconnecting}
          className="mt-2 w-full rounded-md border border-[#353535] bg-[#101010] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600 focus:border-[#f7d344] disabled:opacity-50"
          placeholder="confirm"
        />
        {disconnectError && <p role="alert" className="mt-3 text-xs text-red-400">{disconnectError}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeDisconnectConfirm}
            disabled={disconnecting}
            className="rounded-md border border-[#2A2A2A] px-3 py-2 text-xs text-gray-300 hover:bg-[#242424] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-white/20"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={confirmationText.trim() !== 'confirm' || disconnecting}
            className="flex items-center gap-1.5 rounded-md border border-red-800/40 bg-red-900/60 px-3 py-2 text-xs font-medium text-red-100 hover:bg-red-900/80 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-white/20"
          >
            {disconnecting && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            Disconnect Google
          </button>
        </div>
      </form>
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
            <div
              className="relative flex h-8 w-8 items-center justify-center rounded-md bg-[#161616] border border-[#242424] cursor-default"
              title={`LinkedIn: ${linkedinHealth?.status === 'ok' ? 'Connected' : 'Offline'}`}
            >
              <LinkedInIcon className="h-4 w-4" />
              <div
                className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-[#0A0A0A] ${
                  linkedinHealth?.status === 'ok' ? 'bg-emerald-500' : 'bg-gray-600'
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

          <div className="max-h-48 space-y-0.5 overflow-y-auto custom-scrollbar">
            <SidebarSourceRow icon={CalendarDays} name="Google Calendar" health={calendarHealth} />
            <SidebarSourceRow icon={Mail} name="MU Mail" health={mailHealth} />
            <SidebarSourceRow icon={CheckSquare} name="Google Tasks" health={tasksHealth} />
            <SidebarSourceRow icon={LinkedInIcon} name="LinkedIn" health={linkedinHealth} />
          </div>

          {linkedinStatusError && <p role="status" className="px-2 text-[10px] text-amber-300">LinkedIn status unavailable. Refresh to retry.</p>}

          <div className="mt-2 border-t border-[#242424] px-1.5 pt-2">
            {disconnectSuccess ? (
              <p className="text-[10px] text-green-400">Account disconnected.</p>
            ) : (
              <button
                type="button"
                onClick={openDisconnectConfirm}
                disabled={!isGoogleConnected}
                className="w-full rounded-md border border-red-900/50 px-2 py-2 text-center text-[11px] font-medium text-red-300 transition-colors hover:bg-red-950/30 disabled:cursor-not-allowed disabled:border-[#242424] disabled:text-gray-600 focus-visible:ring-2 focus-visible:ring-red-400"
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
          <SourceRow icon={LinkedInIcon} name="LinkedIn" health={linkedinHealth} />
        </div>

        {linkedinStatusError && <p role="status" className="px-5 pb-3 text-xs text-amber-300">LinkedIn status unavailable. Refresh to retry.</p>}

        <div className="border-t border-[#1A1A1A] px-5 py-4">
          {disconnectSuccess ? (
            <p className="text-sm text-green-400">Google account disconnected.</p>
          ) : (
            <>
              <button
                onClick={openDisconnectConfirm}
                disabled={!isGoogleConnected}
                className="rounded text-sm text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:text-gray-600 focus-visible:ring-2 focus-visible:ring-white/20"
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
