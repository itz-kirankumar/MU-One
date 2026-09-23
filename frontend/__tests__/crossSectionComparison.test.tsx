import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CrossSectionComparison } from '../src/components/dashboard/CrossSectionComparison';
import { AgendaList } from '../src/components/dashboard/AgendaList';
import type { DashboardData, NormalizedEvent } from '../src/types';
import type { PlatformAccessStatus } from '../src/lib/functions';

const mockSharedEvents: NormalizedEvent[] = [
  {
    id: 'ev-secA-1',
    googleEventId: 'gid-secA-1',
    title: 'Session 1: Introduction to Consumer Choice',
    course: 'Consumer Behaviour',
    subject: 'Consumer Behaviour',
    startIso: '2026-09-22T09:00:00+05:30',
    endIso: '2026-09-22T11:00:00+05:30',
    location: 'LT-1',
    mode: 'offline',
    sectionCode: 'A',
    description: 'Foundations of consumer psychology',
    sharedTimetable: true,
  },
  {
    id: 'ev-secB-1',
    googleEventId: 'gid-secB-1',
    title: 'Session 1: Introduction to Consumer Choice',
    course: 'Consumer Behaviour',
    subject: 'Consumer Behaviour',
    startIso: '2026-09-22T11:30:00+05:30',
    endIso: '2026-09-22T13:30:00+05:30',
    location: 'LT-2',
    mode: 'offline',
    sectionCode: 'B',
    description: 'Foundations of consumer psychology',
    sharedTimetable: true,
  },
  {
    id: 'ev-secC-1',
    googleEventId: 'gid-secC-1',
    title: 'Session 1: Introduction to Consumer Choice',
    course: 'Consumer Behaviour',
    subject: 'Consumer Behaviour',
    startIso: '2026-09-23T14:00:00+05:30',
    endIso: '2026-09-23T16:00:00+05:30',
    location: 'LT-3',
    mode: 'hybrid',
    sectionCode: 'C',
    description: 'Foundations of consumer psychology',
    sharedTimetable: true,
  },
  {
    id: 'ev-secD-1',
    googleEventId: 'gid-secD-1',
    title: 'Session 2: Brand Positioning',
    course: 'Brand Strategy',
    subject: 'Brand Strategy',
    startIso: '2026-09-24T10:00:00+05:30',
    endIso: '2026-09-24T12:00:00+05:30',
    location: 'LT-4',
    mode: 'online',
    sectionCode: 'D',
    description: 'Brand positioning and identity',
    sharedTimetable: true,
  },
];

describe('CrossSectionComparison Component Unit Tests', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <CrossSectionComparison
        isOpen={false}
        onClose={jest.fn()}
        currentSubject="Consumer Behaviour"
        sharedEvents={mockSharedEvents}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal dialog with accessible attributes when isOpen is true', () => {
    render(
      <CrossSectionComparison
        isOpen={true}
        onClose={jest.fn()}
        currentSubject="Consumer Behaviour"
        sharedEvents={mockSharedEvents}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Cross-Section Comparison')).toBeInTheDocument();
  });

  it('invokes onClose when Close button is clicked', () => {
    const onCloseMock = jest.fn();
    render(
      <CrossSectionComparison
        isOpen={true}
        onClose={onCloseMock}
        currentSubject="Consumer Behaviour"
        sharedEvents={mockSharedEvents}
      />
    );
    const closeBtn = screen.getByLabelText('Close comparison');
    fireEvent.click(closeBtn);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose when backdrop is clicked', () => {
    const onCloseMock = jest.fn();
    render(
      <CrossSectionComparison
        isOpen={true}
        onClose={onCloseMock}
        currentSubject="Consumer Behaviour"
        sharedEvents={mockSharedEvents}
      />
    );
    const dialogBackdrop = screen.getByRole('dialog');
    fireEvent.click(dialogBackdrop);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose when Escape key is pressed', () => {
    const onCloseMock = jest.fn();
    render(
      <CrossSectionComparison
        isOpen={true}
        onClose={onCloseMock}
        currentSubject="Consumer Behaviour"
        sharedEvents={mockSharedEvents}
      />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('renders section headers for all Sections A through H', () => {
    render(
      <CrossSectionComparison
        isOpen={true}
        onClose={jest.fn()}
        currentSubject="Consumer Behaviour"
        sharedEvents={mockSharedEvents}
      />
    );
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(sec => {
      expect(screen.getByText(`Section ${sec}`)).toBeInTheDocument();
    });
  });

  it('correctly maps sessions to their respective sections', () => {
    render(
      <CrossSectionComparison
        isOpen={true}
        onClose={jest.fn()}
        currentSubject="Consumer Behaviour"
        sharedEvents={mockSharedEvents}
      />
    );
    // Sections A, B, C have sessions
    expect(screen.getByText('LT-1')).toBeInTheDocument();
    expect(screen.getByText('LT-2')).toBeInTheDocument();
    expect(screen.getByText('LT-3')).toBeInTheDocument();

    // Section D has no Consumer Behaviour session
    // Sections D, E, F, G, H show "No scheduled sessions"
    const placeholders = screen.getAllByText('No scheduled sessions');
    expect(placeholders.length).toBe(5); // D, E, F, G, H
  });

  it('displays empty state message when no sessions exist for the subject across all sections', () => {
    render(
      <CrossSectionComparison
        isOpen={true}
        onClose={jest.fn()}
        currentSubject="Nonexistent Course"
        sharedEvents={mockSharedEvents}
      />
    );
    expect(
      screen.getByText('No sessions found for this subject across sections.')
    ).toBeInTheDocument();
  });

  it('handles case-insensitive subject filtering correctly', () => {
    render(
      <CrossSectionComparison
        isOpen={true}
        onClose={jest.fn()}
        currentSubject="consumer behaviour"
        sharedEvents={mockSharedEvents}
      />
    );
    expect(screen.getByText('LT-1')).toBeInTheDocument();
    expect(screen.getByText('LT-2')).toBeInTheDocument();
    expect(screen.getByText('LT-3')).toBeInTheDocument();
  });
});

// Mock Firestore & Contexts for AgendaList Integration Tests
const defaultAccess: PlatformAccessStatus = {
  email: 'student@mastersunion.org',
  isAdmin: false,
  hasAccess: true,
  section: 'A',
  program: 'TBM',
  waitlistStatus: null,
};

const mockAuth = {
  user: { uid: 'u1', email: 'student@mastersunion.org' },
  profile: null,
  access: { ...defaultAccess },
  loading: false,
  profileLoading: false,
  googleConnected: true,
  authError: null,
  accessLoading: false,
  refreshAccess: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

const mockDashboard: { dashboardData: DashboardData; loading: boolean } = {
  dashboardData: { uid: 'u1', events: [] },
  loading: false,
};

jest.mock('@/contexts/DashboardContext', () => ({
  useDashboard: () => mockDashboard,
}));

jest.mock('@/lib/firestore', () => ({
  subscribeToSharedTimetable: jest.fn((_from: string, _to: string, cb: any) => {
    cb(mockSharedEvents);
    return jest.fn();
  }),
}));

describe('AgendaList Integration with CrossSectionComparison', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders "Compare across sections" button in the filter toolbar', () => {
    render(<AgendaList />);
    const compareBtn = screen.getByRole('button', { name: /compare across sections/i });
    expect(compareBtn).toBeInTheDocument();
  });

  it('opens CrossSectionComparison modal upon clicking the Compare button', () => {
    render(<AgendaList />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const compareBtn = screen.getByRole('button', { name: /compare across sections/i });
    fireEvent.click(compareBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Cross-Section Comparison')).toBeInTheDocument();
  });

  it('closes CrossSectionComparison modal when close is clicked inside the modal', () => {
    render(<AgendaList />);
    const compareBtn = screen.getByRole('button', { name: /compare across sections/i });
    fireEvent.click(compareBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Close comparison');
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('F9 verification: Changing subject filter does NOT reset section filter to all', () => {
    render(<AgendaList />);
    const sectionSelect = screen.getByLabelText('Section');
    const subjectSelect = screen.getByLabelText('Subject');

    // Select Section D
    fireEvent.change(sectionSelect, { target: { value: 'D' } });
    expect(sectionSelect).toHaveValue('D');

    // Change subject filter
    fireEvent.change(subjectSelect, { target: { value: 'Brand Strategy' } });

    // Section filter must strictly remain 'D'
    expect(sectionSelect).toHaveValue('D');
  });
});
