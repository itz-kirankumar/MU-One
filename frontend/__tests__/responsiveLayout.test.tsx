import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-uid', displayName: 'Test User', email: 'test@mastersunion.org' },
    profile: null,
    loading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../src/contexts/DashboardContext', () => ({
  useDashboard: () => ({
    dashboardData: null,
    personalTasks: [],
    syncStatus: null,
    loading: false,
    error: null,
  }),
  DashboardProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../src/hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    syncing: false,
    lastSyncedAt: undefined,
    sourceHealth: undefined,
    nextSyncAt: undefined,
  }),
}));

jest.mock('../src/hooks/usePersonalTasks', () => ({
  usePersonalTasks: () => ({ tasks: [], loading: false, error: null }),
}));

jest.mock('../src/lib/functions', () => ({
  syncDashboard: jest.fn(),
  createGoogleTask: jest.fn(),
  completeGoogleTask: jest.fn(),
  importTodaySuggestion: jest.fn(),
  getFullMailMessage: jest.fn(),
  disconnectGoogleAccount: jest.fn(),
  createCalendarEvent: jest.fn(),
  sendMail: jest.fn(),
}));

jest.mock('../src/lib/firestore', () => ({
  subscribeToFocus: jest.fn(() => () => {}),
  updateFocus: jest.fn(),
  createPersonalTask: jest.fn(),
  updatePersonalTask: jest.fn(),
  deletePersonalTask: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/dashboard',
}));

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

import { DashboardShell } from '../src/components/layout/DashboardShell';

describe('DashboardShell', () => {
  it('renders without horizontal overflow', () => {
    const { container } = render(<DashboardShell />);
    const root = container.firstChild as HTMLElement;
    expect(root).toBeTruthy();
    // The root element should have overflow-hidden class
    expect(root.className).toContain('overflow-hidden');
  });

  it('sidebar is not visible as mobile drawer by default', () => {
    const { queryByRole } = render(<DashboardShell />);
    // Mobile drawer is conditionally rendered
    const mobileDrawer = queryByRole('navigation', { name: /mobile/i });
    expect(mobileDrawer).toBeNull();
  });
});
