'use client';

import React, { useState, useCallback, useRef } from 'react';
import { RefreshCw, CalendarPlus, Mail, Menu } from 'lucide-react';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { syncDashboard } from '@/lib/functions';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const THREE_MINUTES_MS = 3 * 60 * 1000;

function formatLastSynced(iso: string | undefined): string {
  if (!iso) return 'Never synced';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

interface TopBarProps {
  onNewEvent: () => void;
  onComposeMail: () => void;
  onMobileMenuOpen: () => void;
}

export function TopBar({ onNewEvent, onComposeMail, onMobileMenuOpen }: TopBarProps) {
  const { syncing, lastSyncedAt, sourceHealth } = useSyncStatus();
  const [refreshing, setRefreshing] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const hasWarning = sourceHealth &&
    Object.values(sourceHealth).some((s) => s?.status === 'warning' || s?.status === 'error');

  const handleRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < THREE_MINUTES_MS) return;
    lastRefreshRef.current = now;
    setRefreshing(true);
    try {
      await syncDashboard();
    } catch {
      // Sync errors handled via Firestore updates
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[#1A1A1A] bg-[#0A0A0A] px-4 gap-3">
      {/* Left: mobile menu + date */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMobileMenuOpen}
          aria-label="Open navigation menu"
          className="flex md:hidden h-8 w-8 items-center justify-center rounded text-gray-500 hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="truncate text-sm font-medium text-gray-300 hidden sm:block">
          {dateStr}
        </span>
      </div>

      {/* Center: sync badge */}
      <div className="flex items-center gap-2 text-xs text-gray-500 flex-shrink-0">
        {syncing || refreshing ? (
          <>
            <LoadingSpinner size="sm" />
            <span className="hidden sm:inline">Syncing…</span>
          </>
        ) : hasWarning ? (
          <span className="text-yellow-400 hidden sm:inline">⚠ Source warning</span>
        ) : (
          <span className="hidden sm:inline">
            {lastSyncedAt ? `Last synced ${formatLastSynced(lastSyncedAt)}` : 'Not synced yet'}
          </span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleRefresh}
          disabled={refreshing || syncing}
          aria-label="Refresh dashboard"
          className="flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-[#1A1A1A] hover:text-gray-300 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
        <button
          onClick={onNewEvent}
          aria-label="New calendar event"
          className="flex items-center gap-1.5 rounded-md border border-[#2A2A2A] bg-[#161616] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#222] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
        >
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Event</span>
        </button>
        <button
          onClick={onComposeMail}
          aria-label="Compose email"
          className="flex items-center gap-1.5 rounded-md border border-[#2A2A2A] bg-[#161616] px-3 py-1.5 text-xs text-gray-300 hover:bg-[#222] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
        >
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Compose</span>
        </button>
      </div>
    </header>
  );
}
