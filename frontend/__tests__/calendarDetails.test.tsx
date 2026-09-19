import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AgendaList } from '../src/components/dashboard/AgendaList';
import { CalendarEventCard } from '../src/components/dashboard/CalendarEventCard';
import { getCalendarEventDetails } from '../src/lib/calendarEventDetails';
import type { DashboardData, NormalizedEvent } from '../src/types';

const today = new Date();
const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const future = new Date(today);
future.setDate(today.getDate() + 21);
const futureIso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;

const currentEvent: NormalizedEvent = {
  id: 'event-1',
  title: 'Session 3: Market entry strategy',
  startIso: `${todayIso}T09:00:00+05:30`,
  endIso: `${todayIso}T11:00:00+05:30`,
  sourceCalendarName: 'PGP TBM · Term 2',
  descriptionExcerpt: 'Description: Motivation and decision making\nCourse Name: Consumer Behaviour\nFaculty: Prof. Asha Rao\nMode: offline\nVenue: Room C-204',
  activityType: 'Session',
  htmlLink: 'https://calendar.google.com/event?eid=event-1',
};

const futureEvent: NormalizedEvent = {
  ...currentEvent,
  id: 'event-2',
  title: 'Venture finance workshop',
  startIso: `${futureIso}T14:00:00+05:30`,
  endIso: `${futureIso}T16:00:00+05:30`,
};

const mockDashboard: { dashboardData: DashboardData; loading: boolean } = {
  dashboardData: { uid: 'test-user', events: [currentEvent, futureEvent] },
  loading: false,
};

jest.mock('../src/contexts/DashboardContext', () => ({
  useDashboard: () => mockDashboard,
}));

test('keeps course name separate from session title without exposing faculty', () => {
  const details = getCalendarEventDetails(currentEvent);
  expect(details).toMatchObject({
    title: 'Session 3: Market entry strategy',
    course: 'Consumer Behaviour',
    description: 'Motivation and decision making',
    venue: 'Room C-204',
    venueLabel: 'In class',
    source: 'PGP TBM · Term 2',
  });
  expect(details).not.toHaveProperty('faculty');
  expect(details.date).not.toBe('Not provided');
  expect(details.time).toContain('09:00');
});

test('event cards show the compact hierarchy and expand on request', () => {
  render(<CalendarEventCard event={currentEvent} onAddTask={jest.fn()} />);
  expect(screen.getByText('Consumer Behaviour')).toBeVisible();
  expect(screen.getByText(currentEvent.title)).toBeVisible();
  expect(screen.getByText('Motivation and decision making')).toBeVisible();
  expect(screen.getByText('In class')).toBeVisible();
  expect(screen.queryByText(/Prof\. Asha Rao/)).not.toBeInTheDocument();
  expect(screen.queryByText('Date')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add to tasks' })).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
  expect(screen.getByText('Date')).toBeVisible();
  expect(screen.getByText('Calendar')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
});

test('weekly calendar uses one clear control for the complete schedule', () => {
  render(<AgendaList />);
  expect(screen.getAllByRole('button', { name: 'Open full calendar' })).toHaveLength(1);
  expect(screen.queryByText(/collapse/i)).not.toBeInTheDocument();
  expect(screen.queryByText(futureEvent.title)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Open full calendar' }));
  expect(screen.getByText(futureEvent.title)).toBeVisible();
  expect(screen.getByRole('button', { name: 'This week' })).toHaveAttribute('aria-expanded', 'true');
});
