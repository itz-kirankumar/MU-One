import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConnectedSources } from '../src/components/dashboard/ConnectedSources';
import { founderApi } from '../src/lib/founder';
import { useAuth } from '../src/contexts/AuthContext';
import { disconnectGoogleAccount } from '../src/lib/functions';

jest.mock('../src/contexts/DashboardContext', () => ({
  useDashboard: () => ({ syncStatus: null, dashboardData: null }),
}));
jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));
jest.mock('../src/lib/functions', () => ({ disconnectGoogleAccount: jest.fn() }));
jest.mock('../src/lib/founder', () => ({
  founderApi: { connectionStatus: jest.fn() },
}));

const connectionStatus = founderApi.connectionStatus as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockDisconnect = disconnectGoogleAccount as jest.Mock;

describe('Connected Sources LinkedIn status', () => {
  beforeEach(() => {
    connectionStatus.mockReset();
    mockDisconnect.mockReset();
    mockUseAuth.mockReturnValue({ user: { uid: 'member-123' }, googleConnected: false });
  });

  it('uses the authorized callable to show a linked account', async () => {
    connectionStatus.mockResolvedValue({ linkedinConnection: { name: 'Member', linkedAt: '2026-09-23T10:00:00Z' } });
    render(<ConnectedSources inSidebar />);
    await waitFor(() => expect(screen.getByText('LinkedIn').closest('div.rounded-lg')).toHaveTextContent('Connected'));
    expect(connectionStatus).toHaveBeenCalledTimes(1);
  });

  it('shows a quiet status message if the callable fails', async () => {
    connectionStatus.mockRejectedValue(new Error('permission-denied'));
    render(<ConnectedSources inSidebar />);
    expect(await screen.findByText(/LinkedIn status unavailable/)).toBeInTheDocument();
  });

  it('requires typed confirmation before disconnecting Google', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'member-123' }, googleConnected: true });
    connectionStatus.mockResolvedValue({ linkedinConnection: null });
    mockDisconnect.mockResolvedValue({ success: true });

    render(<ConnectedSources inSidebar />);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Google Account' }));

    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByRole('textbox', { name: /type confirm to disconnect/i });
    const submit = within(dialog).getByRole('button', { name: 'Disconnect Google' });
    expect(submit).toBeDisabled();

    fireEvent.change(input, { target: { value: 'CONFIRM' } });
    expect(submit).toBeDisabled();
    expect(mockDisconnect).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'confirm' } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(mockDisconnect).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Account disconnected.')).toBeInTheDocument();
  });
});
