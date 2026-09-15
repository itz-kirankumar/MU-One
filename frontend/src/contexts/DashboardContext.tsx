'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { subscribeToDashboard, subscribeToPersonalTasks } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';
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
  profile: UserProfile | null
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
  const isGoogleConnected = Boolean(profile?.googleConnection?.connected);
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
}

export const DashboardContext = createContext<DashboardContextValue>({
  dashboardData: null,
  personalTasks: [],
  syncStatus: null,
  loading: true,
  error: null,
  hasSynced: false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
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

  const syncStatus = deriveSyncStatus(dashboardData, profile);

  return (
    <DashboardContext.Provider
      value={{ dashboardData, personalTasks, syncStatus, loading, error, hasSynced }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboard(): DashboardContextValue {
  return useContext(DashboardContext);
}
