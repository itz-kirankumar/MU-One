import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EmailCenter } from '../src/components/dashboard/EmailCenter';
import { updateMailWorkspace } from '../src/lib/firestore';

jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1' }, profile: null }),
}));

jest.mock('../src/contexts/DashboardContext', () => ({
  useDashboard: () => ({
    loading: false,
    dashboardData: {
      uid: 'user-1',
      mailSignals: [{ messageId: 'mail-1', sender: 'Academic Office', subject: 'Workshop update', snippet: 'Please review the workshop details.', receivedAt: '2026-09-20T09:00:00.000Z' }],
    },
  }),
}));

jest.mock('../src/lib/firestore', () => ({ updateMailWorkspace: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../src/components/dashboard/MailDrawer', () => ({ MailDrawer: () => null }));

const mockedUpdate = updateMailWorkspace as jest.MockedFunction<typeof updateMailWorkspace>;

beforeEach(() => mockedUpdate.mockClear());

test('marking an unlabeled email as read removes it from the inbox view', () => {
  render(<EmailCenter onCompose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Mark Workshop update as read' }));
  expect(screen.queryByText('Workshop update')).not.toBeInTheDocument();
  expect(mockedUpdate).toHaveBeenCalledWith('user-1', expect.objectContaining({ messages: expect.objectContaining({ 'mail-1': expect.objectContaining({ read: true }) }) }));
});

test('creates colored labels and can pin mail', () => {
  render(<EmailCenter onCompose={jest.fn()} />);
  fireEvent.click(screen.getByLabelText('Create label'));
  fireEvent.change(screen.getByLabelText('Label name'), { target: { value: 'Events' } });
  fireEvent.click(screen.getByLabelText('Save label'));
  expect(mockedUpdate).toHaveBeenCalledWith('user-1', expect.objectContaining({ labels: expect.arrayContaining([expect.objectContaining({ name: 'Events' })]) }));

  fireEvent.click(screen.getByRole('button', { name: 'Pin Workshop update' }));
  fireEvent.click(screen.getByRole('button', { name: /^Pinned/ }));
  expect(screen.getByText('Workshop update')).toBeVisible();
});
