import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TopBar } from '../src/components/layout/TopBar';

const mockTriggerSync = jest.fn().mockResolvedValue(undefined);
let mockSyncState = {
  syncing: false,
  isAutoSyncing: false,
  lastSyncedAt: new Date().toISOString(),
  sourceHealth: undefined,
  nextSyncAt: undefined,
  triggerSync: mockTriggerSync,
};

jest.mock('../src/hooks/useSyncStatus', () => ({
  useSyncStatus: () => mockSyncState,
}));

describe('Auto-Sync UI and Interaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncState = {
      syncing: false,
      isAutoSyncing: false,
      lastSyncedAt: new Date().toISOString(),
      sourceHealth: undefined,
      nextSyncAt: undefined,
      triggerSync: mockTriggerSync,
    };
  });

  it('renders "Synced just now" when idle and synced recently', () => {
    render(
      <TopBar
        onNewEvent={jest.fn()}
        onComposeMail={jest.fn()}
        onMobileMenuOpen={jest.fn()}
      />
    );
    expect(screen.getByText(/Synced just now/i)).toBeInTheDocument();
  });

  it('displays "Auto-syncing..." when isAutoSyncing is true', () => {
    mockSyncState.isAutoSyncing = true;
    mockSyncState.syncing = true;

    render(
      <TopBar
        onNewEvent={jest.fn()}
        onComposeMail={jest.fn()}
        onMobileMenuOpen={jest.fn()}
      />
    );
    expect(screen.getByText('Auto-syncing...')).toBeInTheDocument();
  });

  it('calls triggerSync with force:true when manual refresh button is clicked', async () => {
    render(
      <TopBar
        onNewEvent={jest.fn()}
        onComposeMail={jest.fn()}
        onMobileMenuOpen={jest.fn()}
      />
    );

    const refreshBtn = screen.getByRole('button', { name: /Sync with Google/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(mockTriggerSync).toHaveBeenCalledWith({ force: true, silent: false });
    });
  });
});
