import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TestmailLab } from '../src/components/dashboard/TestmailLab';
import { testmailApi } from '../src/lib/testmail';

jest.mock('../src/lib/testmail', () => ({
  testmailApi: { address: jest.fn(), list: jest.fn() },
  testmailError: (error: Error) => error.message,
}));
const api = jest.mocked(testmailApi);

beforeEach(() => {
  jest.clearAllMocks();
  api.address.mockResolvedValue({ address: 'muone.deadlines@inbox.testmail.app' });
  api.list.mockResolvedValue({ count: 1, limit: 20, offset: 0, messages: [{
    id: 'email-1', tag: 'deadlines', from: 'Faculty', to: 'muone.deadlines@inbox.testmail.app',
    subject: 'Assignment due 18 Sep', text: 'Submit before 11:59 PM.', receivedAt: '2026-09-18T12:00:00Z',
    dueDate: '2026-09-18', attachments: [],
  }] });
});

test('opens a tagged inbox and displays parsed due dates without exposing credentials', async () => {
  render(<TestmailLab />);
  fireEvent.change(screen.getByLabelText('Inbox tag'), { target: { value: 'deadlines' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open inbox' }));
  expect(await screen.findByText('muone.deadlines@inbox.testmail.app')).toBeVisible();
  expect(screen.getByText('Assignment due 18 Sep')).toBeVisible();
  expect(screen.getByText('Due 18 Sept')).toBeVisible();
  expect(api.list).toHaveBeenCalledWith({ tag: 'deadlines', offset: 0, limit: 20, liveQuery: false });
  expect(document.body.textContent).not.toContain('API_KEY');
});

test('validates tags before calling the provider', () => {
  render(<TestmailLab />);
  fireEvent.change(screen.getByLabelText('Inbox tag'), { target: { value: '../unsafe' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open inbox' }));
  expect(screen.getByRole('alert')).toHaveTextContent('letters, numbers, hyphens, or underscores');
  expect(api.list).not.toHaveBeenCalled();
});

test('shows administrator access failures', async () => {
  api.address.mockRejectedValue(new Error('This inbox is restricted to configured Email QA administrators.'));
  render(<TestmailLab />);
  fireEvent.click(screen.getByRole('button', { name: 'Open inbox' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('restricted'));
});
