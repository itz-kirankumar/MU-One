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
import type { DashboardData, PersonalTask, SyncStatus } from '@/types';

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
  const { user } = useAuth();
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

  const syncStatus = dashboardData?.syncStatus ?? null;

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
