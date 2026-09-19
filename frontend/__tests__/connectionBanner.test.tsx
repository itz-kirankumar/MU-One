import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConnectGoogleBanner } from '../src/components/dashboard/ConnectGoogleBanner';

const mockAuthState = {
  googleConnected: false,
  profileLoading: true,
};

jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../src/lib/functions', () => ({
  getGoogleAuthUrl: jest.fn(),
}));

describe('ConnectGoogleBanner', () => {
  beforeEach(() => {
    mockAuthState.googleConnected = false;
    mockAuthState.profileLoading = true;
  });

  it('does not tell a returning member to reconnect while their profile is restoring', () => {
    render(<ConnectGoogleBanner />);
    expect(screen.getByRole('status')).toHaveTextContent('Restoring your Google connection');
    expect(screen.queryByRole('button', { name: 'Connect Google' })).not.toBeInTheDocument();
  });

  it('stays hidden when the cached or current profile says Google is connected', () => {
    mockAuthState.googleConnected = true;
    const { container } = render(<ConnectGoogleBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers connection only after a loaded profile confirms it is disconnected', () => {
    mockAuthState.profileLoading = false;
    render(<ConnectGoogleBanner />);
    expect(screen.getByRole('button', { name: 'Connect Google' })).toBeVisible();
  });
});
