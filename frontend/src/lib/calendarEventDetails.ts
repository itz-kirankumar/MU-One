import type { NormalizedEvent } from '@/types';

export const NOT_PROVIDED = 'Not provided';

function cleanText(value: string | undefined): string {
  return (value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function fieldFromDescription(description: string | undefined, labels: string[]): string {
  const text = cleanText(description);
  const escaped = labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const match = text.match(
    new RegExp(`(?:^|\\n)\\s*(?:${escaped.join('|')})\\s*[:\\-]\\s*([^\\n|;]+)`, 'i')
  );
  return match?.[1]?.trim() ?? '';
}

function eventDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatClock(value: string): string {
  const date = eventDate(value);
  if (!date) return NOT_PROVIDED;
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export interface CalendarEventDetails {
  title: string;
  course: string;
  date: string;
  time: string;
  venue: string;
  faculty: string;
  activity: string;
  source: string;
  meetingLink: string;
}

export function getCalendarEventDetails(event: NormalizedEvent): CalendarEventDetails {
  const start = eventDate(event.startIso);
  const allDay = Boolean(event.allDay || event.isAllDay || !event.startIso?.includes('T'));
  const description = event.descriptionExcerpt || event.description;
  const source = event.sourceCalendarName || event.calendarName || NOT_PROVIDED;
  const meetingLink = event.meetingLink || '';

  const course =
    event.course ||
    fieldFromDescription(description, ['Course', 'Subject', 'Module', 'Programme', 'Program']) ||
    event.subject ||
    source;
  const venue =
    event.location ||
    fieldFromDescription(description, ['Venue', 'Location', 'Room', 'Classroom']) ||
    (meetingLink ? 'Online' : NOT_PROVIDED);
  const faculty =
    event.faculty ||
    fieldFromDescription(description, ['Faculty', 'Professor', 'Instructor', 'Facilitator', 'Speaker', 'Mentor']) ||
    event.organizerName ||
    event.organizerEmail ||
    NOT_PROVIDED;

  return {
    title: cleanText(event.title) || 'Untitled calendar event',
    course: cleanText(course) || NOT_PROVIDED,
    date: start
      ? start.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : NOT_PROVIDED,
    time: allDay
      ? 'All day'
      : `${formatClock(event.startIso)}${event.endIso ? ` – ${formatClock(event.endIso)}` : ''}`,
    venue: cleanText(venue) || NOT_PROVIDED,
    faculty: cleanText(faculty) || NOT_PROVIDED,
    activity: event.activityType || (/\bsession\b/i.test(event.title) ? 'Session' : 'Calendar event'),
    source: cleanText(source) || NOT_PROVIDED,
    meetingLink,
  };
}

