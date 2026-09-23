import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DashboardProvider, useDashboard } from '../src/contexts/DashboardContext';
import { syncDashboard } from '../src/lib/functions';

let mockDashboardSnapshot: Record<string, unknown> | null = null;

jest.mock('../src/contexts/AuthContext', () => {
  const user = { uid: 'sync-test-user' };
  return {
    useAuth: () => ({ user, profile: null, googleConnected: true }),
  };
});

jest.mock('../src/lib/firestore', () => ({
  subscribeToDashboard: (_uid: string, onData: (data: unknown) => void) => {
    onData(mockDashboardSnapshot);
    return jest.fn();
  },
  subscribeToPersonalTasks: (_uid: string, onData: (data: unknown[]) => void) => {
    onData([]);
    return jest.fn();
  },
  updateCompletedMailIds: jest.fn(),
}));

jest.mock('../src/lib/functions', () => ({
  syncDashboard: jest.fn().mockResolvedValue({ status: 'completed' }),
}));

function SyncControls() {
  const { triggerSync } = useDashboard();
  return <button onClick={() => void triggerSync({ force: true })}>Sync now</button>;
}

describe('dashboard sync scheduling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => jest.useRealTimers());

  it('does not call the sync function after a recent scheduled server sync', async () => {
    mockDashboardSnapshot = { sync: { lastCompletedAt: new Date() } };
    render(<DashboardProvider><SyncControls /></DashboardProvider>);

    await act(async () => {
      jest.advanceTimersByTime(2_100);
      window.dispatchEvent(new Event('focus'));
      jest.advanceTimersByTime(150_000);
    });

    expect(syncDashboard).not.toHaveBeenCalled();
  });

  it('makes one stale automatic request and forwards force for a manual request', async () => {
    mockDashboardSnapshot = { sync: { lastCompletedAt: new Date(Date.now() - 10 * 60_000) } };
    render(<DashboardProvider><SyncControls /></DashboardProvider>);

    await act(async () => {
      jest.advanceTimersByTime(2_100);
    });
    expect(syncDashboard).toHaveBeenCalledTimes(1);
    expect(syncDashboard).toHaveBeenCalledWith(false);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(syncDashboard).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(15_100);
      fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));
    });
    expect(syncDashboard).toHaveBeenLastCalledWith(true);
  });
});
