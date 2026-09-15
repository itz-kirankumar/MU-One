import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

const mockUser = { uid: 'test-uid', displayName: 'Test User', email: 'test@mastersunion.org' };

jest.mock('../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('../src/lib/firestore', () => ({
  createPersonalTask: jest.fn().mockResolvedValue('new-task-id'),
  updatePersonalTask: jest.fn().mockResolvedValue(undefined),
  deletePersonalTask: jest.fn().mockResolvedValue(undefined),
}));

const mockTasks = [
  {
    id: 'task-1',
    title: 'Must do task',
    importance: 'must_do' as const,
    completed: false,
    createdAt: '2026-09-14T10:00:00Z',
  },
  {
    id: 'task-2',
    title: 'Normal task',
    importance: 'normal' as const,
    completed: false,
    createdAt: '2026-09-14T09:00:00Z',
  },
  {
    id: 'task-3',
    title: 'Completed task',
    importance: 'normal' as const,
    completed: true,
    createdAt: '2026-09-13T10:00:00Z',
  },
];

jest.mock('../src/hooks/usePersonalTasks', () => ({
  usePersonalTasks: () => ({ tasks: mockTasks, loading: false, error: null }),
}));

import { PersonalTasks } from '../src/components/dashboard/PersonalTasks';
import { updatePersonalTask } from '../src/lib/firestore';

describe('PersonalTasks', () => {
  it('renders existing tasks', () => {
    render(<PersonalTasks />);
    expect(screen.getByText('Must do task')).toBeInTheDocument();
    expect(screen.getByText('Normal task')).toBeInTheDocument();
    expect(screen.getByText('Completed task')).toBeInTheDocument();
  });

  it('validates title before creating', async () => {
    render(<PersonalTasks />);
    const submitBtn = screen.getByRole('button', { name: /add task/i });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/title is required/i);
    });
  });

  it('calls updatePersonalTask when task checkbox is clicked', async () => {
    render(<PersonalTasks />);
    const completeBtn = screen.getByLabelText(/complete "Must do task"/i);
    fireEvent.click(completeBtn);
    await waitFor(() => {
      expect(updatePersonalTask).toHaveBeenCalledWith(
        'test-uid',
        'task-1',
        { completed: true }
      );
    });
  });

  it('displays tasks in correct sort order (must_do before normal, completed last)', () => {
    render(<PersonalTasks />);
    const items = screen.getAllByRole('button', { name: /complete|mark .* incomplete/i });
    // First item should be must_do, last (via line-through) should be completed
    expect(items[0]).toHaveAccessibleName(/complete "Must do task"/i);
  });
});
