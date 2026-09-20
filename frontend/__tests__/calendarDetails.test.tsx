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

const longDescription = 'Motivation and decision making helps students understand why customers choose products and how teams can turn those insights into stronger market propositions.';
const longEvent: NormalizedEvent = {
  ...currentEvent,
  descriptionExcerpt: `Description: ${longDescription}\nCourse Name: Consumer Behaviour\nMode: offline\nVenue: Room C-204`,
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
  render(<CalendarEventCard event={longEvent} onAddTask={jest.fn()} />);
  expect(screen.getByText('Consumer Behaviour')).toBeVisible();
  expect(screen.getByText(currentEvent.title)).toBeVisible();
  expect(screen.getByText('In class')).toBeVisible();
  expect(screen.queryByText(/Prof\. Asha Rao/)).not.toBeInTheDocument();
  expect(screen.queryByText('Date')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add to tasks' })).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
  expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.queryByText('Date')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Show less' }).closest('p')).toHaveTextContent(longDescription);
});

test('calendar defaults to a compact month grid and saves the selected view', () => {
  window.localStorage.clear();
  render(<AgendaList />);
  expect(screen.getByRole('button', { name: 'month' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'day' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getAllByText('Consumer Behaviour').length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole('button', { name: 'day' }));
  expect(screen.getByRole('button', { name: 'day' })).toHaveAttribute('aria-pressed', 'true');
  expect(window.localStorage.getItem('muone.calendarView')).toBe('day');
  expect(screen.getByText(currentEvent.title)).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'timeline' }));
  expect(screen.getByRole('button', { name: 'timeline' })).toHaveAttribute('aria-pressed', 'true');
  expect(window.localStorage.getItem('muone.calendarView')).toBe('timeline');
  expect(screen.getByText(currentEvent.title)).toBeVisible();
  expect(screen.getAllByTestId('timeline-event')[0]).not.toHaveClass('rounded-xl');
  expect(screen.getAllByTestId('timeline-event')[0]).not.toHaveClass('bg-[#15140f]');
});
