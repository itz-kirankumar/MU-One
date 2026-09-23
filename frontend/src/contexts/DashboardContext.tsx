'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';
import { subscribeToDashboard, subscribeToPersonalTasks, updateCompletedMailIds } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { syncDashboard } from '@/lib/functions';
import type { DashboardData, PersonalTask, SyncStatus, SourceHealth, UserProfile } from '@/types';

function toIsoString(val: unknown): string | undefined {
  if (!val) return undefined;
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val.toISOString();
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    try {
      const d = (val as { toDate: () => Date }).toDate();
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    } catch {
      return undefined;
    }
  }
  if (typeof (val as { seconds?: number }).seconds === 'number') {
    const d = new Date((val as { seconds: number }).seconds * 1000);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  return undefined;
}

function normalizeHealthItem(
  raw: unknown,
  defaultConnected: boolean,
  lastSyncedAt?: string
): SourceHealth | undefined {
  if (typeof raw === 'string') {
    const s = raw.toLowerCase();
    if (s === 'ok' || s === 'warning' || s === 'error') {
      return { status: s, lastSyncedAt };
    }
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const status = typeof obj.status === 'string' ? obj.status.toLowerCase() : 'ok';
    if (status === 'ok' || status === 'warning' || status === 'error') {
      return {
        status: status as 'ok' | 'warning' | 'error',
        lastSyncedAt: toIsoString(obj.lastSyncedAt) ?? lastSyncedAt,
        message: typeof obj.message === 'string' ? obj.message : undefined,
      };
    }
  }
  if (defaultConnected) {
    return { status: 'ok', lastSyncedAt };
  }
  return undefined;
}

function deriveSyncStatus(
  dashboardData: DashboardData | null,
  profile: UserProfile | null,
  googleConnected: boolean
): SyncStatus | null {
  if (!dashboardData && !profile) return null;

  const rawSync = (dashboardData as Record<string, unknown> | null)?.sync as Record<string, unknown> | undefined;
  const rawSyncStatus = dashboardData?.syncStatus;

  // Resolve lastSyncedAt from all possible sources
  const rawLastSync =
    rawSync?.lastCompletedAt ??
    rawSyncStatus?.lastSyncedAt ??
    (dashboardData as Record<string, unknown> | null)?.syncedAt ??
    (dashboardData as Record<string, unknown> | null)?.updatedAt ??
    (profile?.googleConnection as Record<string, unknown> | undefined)?.lastSyncAt ??
    rawSync?.startedAt;

  const lastSyncedAt = toIsoString(rawLastSync);

  // Resolve nextSyncAt
  const rawNextSync = rawSync?.nextScheduledSyncAt ?? rawSyncStatus?.nextSyncAt;
  const nextSyncAt = toIsoString(rawNextSync);

  // Resolve syncing
  const isSyncing = Boolean(
    rawSync?.status === 'syncing' ||
    rawSync?.status === 'running' ||
    rawSyncStatus?.syncing
  );

  // Check if Google account is connected
  const isGoogleConnected = googleConnected;
  const deadlinesArr = (dashboardData as Record<string, unknown> | null)?.deadlines;
  const importantMailArr = (dashboardData as Record<string, unknown> | null)?.importantMail;

  const hasCalendarData = Boolean(
    dashboardData?.events?.length ||
    (Array.isArray(deadlinesArr) && deadlinesArr.length > 0) ||
    Boolean((dashboardData as Record<string, unknown> | null)?.connectedCalendars)
  );
  const hasMailData = Boolean(
    dashboardData?.mailSignals?.length ||
    (Array.isArray(importantMailArr) && importantMailArr.length > 0)
  );
  const hasTasksData = Boolean(dashboardData?.googleTasks?.length);

  // Resolve source health
  const rawHealth =
    ((dashboardData as Record<string, unknown> | null)?.sourceHealth as Record<string, unknown> | undefined) ??
    rawSyncStatus?.sourceHealth ??
    ((rawSync?.sourceHealth as Record<string, unknown> | undefined) ?? {});

  const healthMap = rawHealth as Record<string, unknown>;

  const calendarHealth = normalizeHealthItem(
    healthMap?.calendar,
    isGoogleConnected || hasCalendarData,
    lastSyncedAt
  );

  const mailHealth = normalizeHealthItem(
    healthMap?.gmail ?? healthMap?.mail,
    isGoogleConnected || hasMailData,
    lastSyncedAt
  );

  const tasksHealth = normalizeHealthItem(
    healthMap?.tasks,
    isGoogleConnected || hasTasksData,
    lastSyncedAt
  );

  return {
    syncing: isSyncing,
    lastSyncedAt,
    nextSyncAt,
    sourceHealth: {
      calendar: calendarHealth,
      gmail: mailHealth,
      tasks: tasksHealth,
    },
  };
}

// ─── Context shape ────────────────────────────────────────────────────────────

interface DashboardContextValue {
  dashboardData: DashboardData | null;
  personalTasks: PersonalTask[];
  syncStatus: SyncStatus | null;
  loading: boolean;
  error: string | null;
  /** True once a dashboard snapshot has been written by a sync at least once. */
  hasSynced: boolean;
  /** True when a background auto-sync is currently running. */
  isAutoSyncing: boolean;
  /** Manually or silently trigger a sync. */
  triggerSync: (options?: { silent?: boolean; force?: boolean }) => Promise<void>;
  /** IDs of emails marked as completed. */
  completedMailIds: string[];
  /** Mark an email as completed and remove from active list. */
  markMailCompleted: (messageId: string) => Promise<void>;
  /** Restore / unmark a completed email. */
  unmarkMailCompleted: (messageId: string) => Promise<void>;
}

export const DashboardContext = createContext<DashboardContextValue>({
  dashboardData: null,
  personalTasks: [],
  syncStatus: null,
  loading: true,
  error: null,
  hasSynced: false,
  isAutoSyncing: false,
  triggerSync: async () => {},
  completedMailIds: [],
  markMailCompleted: async () => {},
  unmarkMailCompleted: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user, profile, googleConnected } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [personalTasks, setPersonalTasks] = useState<PersonalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSynced, setHasSynced] = useState(false);

  // Real-time dashboard listener
  useEffect(() => {
    if (!user) {
      setDashboardData(null);
      setHasSynced(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const unsubDashboard = subscribeToDashboard(
      user.uid,
      (data) => {
        setDashboardData(data);
        // A snapshot that resolves — even to null — means the listener works.
        // null simply means no sync has written the document yet.
        setHasSynced(data !== null);
        setError(data?.error ?? null);
        setLoading(false);
      },
      (err) => {
        // Listener failure: keep any previously loaded data on screen rather
        // than blanking the dashboard, but surface the problem.
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubDashboard();
  }, [user]);

  // Real-time personal tasks listener
  useEffect(() => {
    if (!user) {
      setPersonalTasks([]);
      return;
    }

    const unsubTasks = subscribeToPersonalTasks(user.uid, (tasks) => {
      setPersonalTasks(tasks);
    });

    return () => unsubTasks();
  }, [user]);

  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const lastSyncAttemptRef = useRef<number>(0);
  const isSyncingRef = useRef<boolean>(false);
  const syncStatus = deriveSyncStatus(dashboardData, profile, googleConnected);

  const triggerSync = useCallback(
    async (options?: { silent?: boolean; force?: boolean }) => {
      if (!user) return;
      const silent = options?.silent ?? false;
      const force = options?.force ?? false;
      const now = Date.now();
      const minInterval = force ? 15_000 : 60_000;
      const lastCompletedAt = Date.parse(syncStatus?.lastSyncedAt ?? '');
      const freshnessWindow = force ? 15_000 : 5 * 60_000;

      // The scheduled server sync also updates this timestamp. Do not re-sync
      // just because this tab was focused or opened after another tab synced.
      if (Number.isFinite(lastCompletedAt) && now - lastCompletedAt < freshnessWindow) {
        if (!silent && force) throw new Error('Synced recently. Please wait a moment.');
        return;
      }

      const storageKey = `muone.dashboardSyncAttempt.${user.uid}`;
      let lastAttempt = lastSyncAttemptRef.current;
      try {
        lastAttempt = Math.max(lastAttempt, Number(localStorage.getItem(storageKey)) || 0);
      } catch {
        // Storage can be unavailable in private browsing; the in-tab guard still works.
      }

      if (now - lastAttempt < minInterval) {
        if (!silent) {
          const waitSecs = Math.ceil((minInterval - (now - lastAttempt)) / 1000);
          throw new Error(`Synced recently. Please wait ${waitSecs}s.`);
        }
        return;
      }

      if (isSyncingRef.current || syncStatus?.syncing) return;

      isSyncingRef.current = true;
      setIsAutoSyncing(true);
      lastSyncAttemptRef.current = now;
      try {
        localStorage.setItem(storageKey, String(now));
      } catch {
        // See the storage fallback above.
      }

      try {
        await syncDashboard(force);
      } catch (err: unknown) {
        if (!silent) {
          throw err;
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          console.debug('[auto-sync] Background sync deferred:', msg);
        }
      } finally {
        isSyncingRef.current = false;
        setIsAutoSyncing(false);
      }
    },
    [user, syncStatus?.lastSyncedAt, syncStatus?.syncing]
  );

  // 1. Auto-sync on window focus / tab visibility change (e.g. user added event or received email)
  useEffect(() => {
    if (!user || !googleConnected || loading) return;

    function handleActivity() {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        triggerSync({ silent: true }).catch(() => {});
      }
    }

    window.addEventListener('focus', handleActivity);
    document.addEventListener('visibilitychange', handleActivity);

    return () => {
      window.removeEventListener('focus', handleActivity);
      document.removeEventListener('visibilitychange', handleActivity);
    };
  }, [user, googleConnected, loading, triggerSync]);

  // 2. Periodic background auto-sync every 2.5 minutes while the dashboard is open
  useEffect(() => {
    if (!user || !googleConnected || loading) return;

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        triggerSync({ silent: true }).catch(() => {});
      }
    }, 150_000);

    return () => clearInterval(interval);
  }, [user, googleConnected, loading, triggerSync]);

  // 3. Initial mount check: wait for the first dashboard snapshot before deciding.
  useEffect(() => {
    if (!user || !googleConnected || loading) return;

    const timer = setTimeout(() => {
      triggerSync({ silent: true }).catch(() => {});
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, googleConnected, loading, triggerSync]);

  // Completed mail tracking (local storage + Firestore profile sync)
  const [completedMailIds, setCompletedMailIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('mu_completed_mail_ids');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return [];
  });

  useEffect(() => {
    const remoteIds = (profile as Record<string, unknown> | null)?.completedMailIds;
    if (Array.isArray(remoteIds)) {
      setCompletedMailIds((prev) => {
        const merged = Array.from(new Set([...prev, ...(remoteIds as string[])]));
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('mu_completed_mail_ids', JSON.stringify(merged));
          } catch {}
        }
        return merged;
      });
    }
  }, [profile]);

  const markMailCompleted = useCallback(
    async (messageId: string) => {
      const next = Array.from(new Set([...completedMailIds, messageId]));
      setCompletedMailIds(next);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('mu_completed_mail_ids', JSON.stringify(next));
        } catch {}
      }
      if (user) {
        await updateCompletedMailIds(user.uid, next).catch(() => {});
      }
    },
    [user, completedMailIds]
  );

  const unmarkMailCompleted = useCallback(
    async (messageId: string) => {
      const next = completedMailIds.filter((id) => id !== messageId);
      setCompletedMailIds(next);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('mu_completed_mail_ids', JSON.stringify(next));
        } catch {}
      }
      if (user) {
        await updateCompletedMailIds(user.uid, next).catch(() => {});
      }
    },
    [user, completedMailIds]
  );

  // Filter out completed emails from active dashboard view
  const activeDashboardData = useMemo(() => {
    if (!dashboardData) return null;
    const completedSet = new Set(completedMailIds);
    const filterMail = (list?: any[]) =>
      (list ?? []).filter(
        (m) =>
          !completedSet.has(m?.id) &&
          !completedSet.has(m?.messageId)
      );

    return {
      ...dashboardData,
      mailSignals: filterMail(dashboardData.mailSignals),
      importantMail: filterMail((dashboardData as any).importantMail),
    };
  }, [dashboardData, completedMailIds]);

  return (
    <DashboardContext.Provider
      value={{
        dashboardData: activeDashboardData,
        personalTasks,
        syncStatus,
        loading,
        error,
        hasSynced,
        isAutoSyncing,
        triggerSync,
        completedMailIds,
        markMailCompleted,
        unmarkMailCompleted,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboard(): DashboardContextValue {
  return useContext(DashboardContext);
}
