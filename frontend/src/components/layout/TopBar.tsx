'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, CalendarPlus, Mail, Menu, Mic, ShieldCheck } from 'lucide-react';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';

const MANUAL_COOLDOWN_MS = 15 * 1000; // 15s between manual force syncs

function formatLastSynced(iso: string | undefined): string {
  if (!iso) return 'Not synced yet';
  const time = new Date(iso).getTime();
  if (isNaN(time)) return 'Not synced yet';
  const diff = Date.now() - time;
  if (diff < 0) return 'just now';
  const secs = Math.floor(diff / 1000);
  if (secs < 30) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1m ago';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return '1h ago';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

interface TopBarProps {
  userPreview?: boolean;
  onNewEvent: () => void;
  onComposeMail: () => void;
  onMobileMenuOpen: () => void;
  onOpenVoiceCopilot?: () => void;
}

export function TopBar({ userPreview = false, onNewEvent, onComposeMail, onMobileMenuOpen, onOpenVoiceCopilot }: TopBarProps) {
  const { access } = useAuth();
  const { syncing, isAutoSyncing, lastSyncedAt, sourceHealth, triggerSync } = useSyncStatus();
  const [refreshing, setRefreshing] = useState(false);
  const [cooldownMsg, setCooldownMsg] = useState('');
  const lastRefreshRef = useRef<number>(0);
  const [, setTick] = useState(0);

  // Auto-tick every 30s so "just now" / "1m ago" stays live
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const hasWarning =
    sourceHealth &&
    Object.values(sourceHealth).some((s) => s?.status === 'warning' || s?.status === 'error');

  const handleRefresh = useCallback(async () => {
    const currentTime = Date.now();
    const timeSinceLast = currentTime - lastRefreshRef.current;
    if (timeSinceLast < MANUAL_COOLDOWN_MS) {
      const remainingSecs = Math.ceil((MANUAL_COOLDOWN_MS - timeSinceLast) / 1000);
      setCooldownMsg(`Wait ${remainingSecs}s`);
      setTimeout(() => setCooldownMsg(''), 2500);
      return;
    }
    lastRefreshRef.current = currentTime;
    setRefreshing(true);
    setCooldownMsg('');
    try {
      await triggerSync({ force: true, silent: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setCooldownMsg(msg.includes('rate-limited') || msg.includes('recently') ? 'Synced recently' : msg);
      setTimeout(() => setCooldownMsg(''), 3000);
    } finally {
      setRefreshing(false);
    }
  }, [triggerSync]);

  const isSyncActive = syncing || isAutoSyncing || refreshing;

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-[#1A1A1A] bg-[#0A0A0A] px-4 gap-3">
      {/* Left: mobile menu + date */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMobileMenuOpen}
          aria-label="Open navigation menu"
          className="flex md:hidden h-8 w-8 items-center justify-center rounded text-gray-500 hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="truncate text-sm font-medium text-gray-300 hidden sm:block">
          {dateStr}
        </span>
      </div>

      {/* Right: Sync Status Log + Sync Button (Unified Pill) + Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {access?.isAdmin && !userPreview && (
          <Link
            href="/admin/access"
            aria-label="Open access control"
            className="flex items-center gap-1.5 rounded-md border border-[#3b341a] bg-[#211d0d] px-3 py-1.5 text-xs font-semibold text-[#f7d344] hover:bg-[#2b2510] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden lg:inline">Access</span>
          </Link>
        )}
        {/* Unified Sync Pill: Status Log & Sync Button paired side-by-side */}
        <div className="flex items-center rounded-lg border border-[#262626] bg-[#141414] px-2 sm:px-2.5 py-1 text-xs gap-1.5 sm:gap-2 shadow-xs transition-colors hover:border-[#333]">
          {isSyncActive ? (
            <div className="flex items-center gap-1.5 text-[#f7d344]">
              <LoadingSpinner size="sm" />
              <span className="font-medium hidden sm:inline">{isAutoSyncing ? 'Auto-syncing...' : 'Syncing...'}</span>
            </div>
          ) : cooldownMsg ? (
            <span className="text-amber-400 font-medium text-[11px] animate-in fade-in duration-150 hidden sm:inline">
              {cooldownMsg}
            </span>
          ) : hasWarning ? (
            <div className="flex items-center gap-1.5 text-amber-400">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
              <span className="font-medium hidden sm:inline">Warning</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${lastSyncedAt ? 'bg-emerald-500' : 'bg-gray-500'}`}
                aria-hidden="true"
              />
              <span className="text-gray-300 font-medium whitespace-nowrap hidden sm:inline">
                {lastSyncedAt ? `Synced ${formatLastSynced(lastSyncedAt)}` : 'Not synced yet'}
              </span>
            </div>
          )}

          {/* Micro divider between status and action */}
          <div className="h-3 w-[1px] bg-[#2A2A2A]" />

          {/* Sync Button */}
          <button
            onClick={handleRefresh}
            disabled={isSyncActive}
            title={
              lastSyncedAt
                ? `Auto-sync is enabled. Last synced at ${new Date(lastSyncedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}. Click to force sync now.`
                : 'Click to sync with Google'
            }
            aria-label="Sync with Google"
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-[#222] hover:text-white disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isSyncActive ? 'animate-spin text-[#f7d344]' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Action Buttons */}
        {onOpenVoiceCopilot && (
          <button
            onClick={onOpenVoiceCopilot}
            aria-label="Open AI Voice Copilot"
            className="flex items-center gap-1.5 rounded-md border border-purple-500/40 bg-purple-950/30 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-900/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 transition-colors shadow-xs"
          >
            <Mic className="h-3.5 w-3.5 text-purple-400" aria-hidden="true" />
            <span className="hidden sm:inline">Voice Copilot</span>
          </button>
        )}
      </div>
    </header>
  );
}
