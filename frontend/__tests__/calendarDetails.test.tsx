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
  descriptionExcerpt: 'Course: Business Strategy\nFaculty: Prof. Asha Rao\nVenue: Room C-204',
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

test('derives specific course, venue, faculty, source, date, and time details', () => {
  const details = getCalendarEventDetails(currentEvent);
  expect(details).toMatchObject({
    course: 'Business Strategy',
    venue: 'Room C-204',
    faculty: 'Prof. Asha Rao',
    source: 'PGP TBM · Term 2',
    activity: 'Session',
  });
  expect(details.date).not.toBe('Not provided');
  expect(details.time).toContain('09:00');
});

test('event cards expose every calendar detail with explicit labels', () => {
  render(<CalendarEventCard event={currentEvent} onAddTask={jest.fn()} />);
  for (const label of ['Course', 'Date', 'Time', 'Venue', 'Faculty / host', 'Calendar']) {
    expect(screen.getByText(label)).toBeVisible();
  }
  expect(screen.getByText('Business Strategy')).toBeVisible();
  expect(screen.getByText('Prof. Asha Rao')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Add to tasks' })).toBeVisible();
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

