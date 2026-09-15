import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mock contexts ────────────────────────────────────────────────────────────

const mockDashboard = {
  dashboardData: null,
  personalTasks: [],
  syncStatus: null,
  loading: true,
  error: null,
};

jest.mock('../src/contexts/DashboardContext', () => ({
  useDashboard: () => mockDashboard,
  DashboardProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-uid', displayName: 'Test User', email: 'test@mastersunion.org' },
    profile: null,
    loading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}));

jest.mock('../src/hooks/usePersonalTasks', () => ({
  usePersonalTasks: () => ({ tasks: [], loading: false, error: null }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

import { SourceMetrics } from '../src/components/dashboard/SourceMetrics';

describe('SourceMetrics', () => {
  it('shows loading skeleton before data arrives', () => {
    mockDashboard.loading = true;
    mockDashboard.dashboardData = null;
    const { container } = render(<SourceMetrics />);
    // Skeleton elements have animate-pulse class
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows counts when data is available', () => {
    mockDashboard.loading = false;
    mockDashboard.dashboardData = {
      uid: 'test-uid',
      connectedCalendars: 3,
      events: [
        { id: '1', title: 'Event 1', startIso: '2026-09-15T10:00:00Z' },
        { id: '2', title: 'Event 2', startIso: '2026-09-16T10:00:00Z' },
      ],
      mailSignals: [
        { id: 'm1', messageId: 'msg1', from: 'Admin', fromEmail: 'admin@mu.org', subject: 'Test', snippet: '', receivedAt: '2026-09-14T10:00:00Z' },
      ],
      googleTasks: [
        { id: 't1', title: 'Task 1', taskListId: 'list1', completed: false },
        { id: 't2', title: 'Task 2', taskListId: 'list1', completed: true },
      ],
    } as any;

    render(<SourceMetrics />);
    // Should show "3", "2", "1", "1" (active tasks only)
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getAllByText('1')).toHaveLength(2);
  });
});

import { DeadlinesList } from '../src/components/dashboard/DeadlinesList';

describe('DeadlinesList', () => {
  it('shows empty state when no deadlines', () => {
    mockDashboard.loading = false;
    mockDashboard.dashboardData = { uid: 'test-uid', deadlines: [] } as any;

    render(<DeadlinesList />);
    expect(screen.getByText(/no upcoming deadlines/i)).toBeInTheDocument();
  });

  it('does not crash when one source has error and other panels are fine', () => {
    mockDashboard.loading = false;
    mockDashboard.syncStatus = {
      syncing: false,
      sourceHealth: {
        calendar: { status: 'error', message: 'Calendar API error' },
        gmail: { status: 'ok' },
        tasks: { status: 'ok' },
      },
    } as any;
    mockDashboard.dashboardData = { uid: 'test-uid', deadlines: [] } as any;

    const { container } = render(<DeadlinesList />);
    expect(container).toBeTruthy();
  });
});
