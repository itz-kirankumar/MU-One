'use client';

import { useDashboard } from '@/contexts/DashboardContext';
import type { SyncStatus, SourceHealth } from '@/types';

interface SyncStatusResult {
  syncing: boolean;
  isAutoSyncing: boolean;
  lastSyncedAt: string | undefined;
  sourceHealth: SyncStatus['sourceHealth'] | undefined;
  nextSyncAt: string | undefined;
  triggerSync: (options?: { silent?: boolean; force?: boolean }) => Promise<void>;
}

/**
 * Derived from DashboardContext — returns sync state and actions.
 */
export function useSyncStatus(): SyncStatusResult {
  const { syncStatus, isAutoSyncing, triggerSync } = useDashboard();

  return {
    syncing: (syncStatus?.syncing ?? false) || isAutoSyncing,
    isAutoSyncing,
    lastSyncedAt: syncStatus?.lastSyncedAt,
    sourceHealth: syncStatus?.sourceHealth,
    nextSyncAt: syncStatus?.nextSyncAt,
    triggerSync,
  };
}
