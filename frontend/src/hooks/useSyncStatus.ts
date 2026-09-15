'use client';

import { useDashboard } from '@/contexts/DashboardContext';
import type { SyncStatus, SourceHealth } from '@/types';

interface SyncStatusResult {
  syncing: boolean;
  lastSyncedAt: string | undefined;
  sourceHealth: SyncStatus['sourceHealth'] | undefined;
  nextSyncAt: string | undefined;
}

/**
 * Derived from DashboardContext — returns sync state only.
 */
export function useSyncStatus(): SyncStatusResult {
  const { syncStatus } = useDashboard();

  return {
    syncing: syncStatus?.syncing ?? false,
    lastSyncedAt: syncStatus?.lastSyncedAt,
    sourceHealth: syncStatus?.sourceHealth,
    nextSyncAt: syncStatus?.nextSyncAt,
  };
}
