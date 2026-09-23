import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DevelopmentNotice } from '../src/components/dashboard/DevelopmentNotice';

describe('DevelopmentNotice', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows once for an enabled user and remembers dismissal', async () => {
    const { unmount } = render(<DevelopmentNotice userId="member-123" enabled />);
    const dialog = await screen.findByRole('dialog', { name: 'We’re still building MU One' });
    expect(dialog).toHaveTextContent('Some tools may be incomplete');

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();

    render(<DevelopmentNotice userId="member-123" enabled />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not show for admins when disabled', () => {
    render(<DevelopmentNotice userId="admin-123" enabled={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows again in admin preview without saving its dismissal', async () => {
    const { unmount } = render(<DevelopmentNotice userId="admin-123" enabled preview />);
    expect(await screen.findByRole('dialog', { name: 'We’re still building MU One' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(window.localStorage.length).toBe(0);
    unmount();

    render(<DevelopmentNotice userId="admin-123" enabled preview />);
    expect(await screen.findByRole('dialog', { name: 'We’re still building MU One' })).toBeInTheDocument();
  });
});
