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
  description: string;
  date: string;
  time: string;
  venue: string;
  venueLabel: string;
  source: string;
  meetingLink: string;
}

function firstNarrativeLine(description: string | undefined): string {
  const metadata = /^(?:course(?: name)?|subject|module|programme|program|mode|venue|location|room|classroom|faculty|professor|instructor|facilitator|speaker|mentor)\s*[:\-]/i;
  return cleanText(description).split('\n').map(line => line.trim()).find(line => line && !metadata.test(line)) ?? '';
}

function formatVenueLabel(mode: string, venue: string, hasMeetingLink: boolean): string {
  const normalized = mode.trim().toLowerCase();
  if (/offline|in[ -]?class|classroom|campus/.test(normalized)) return 'In class';
  if (/online|virtual|remote/.test(normalized)) return 'Online';
  if (/hybrid/.test(normalized)) return 'Hybrid';
  if (mode.trim()) return mode.trim();
  if (hasMeetingLink) return 'Online';
  if (venue !== NOT_PROVIDED) return 'In class';
  return 'Venue TBA';
}

export function getCalendarEventDetails(event: NormalizedEvent): CalendarEventDetails {
  const start = eventDate(event.startIso);
  const allDay = Boolean(event.allDay || event.isAllDay || !event.startIso?.includes('T'));
  const description = event.descriptionExcerpt || event.description;
  const source = event.sourceCalendarName || event.calendarName || NOT_PROVIDED;
  const meetingLink = event.meetingLink || '';

  const course =
    fieldFromDescription(description, ['Course Name', 'Course', 'Subject', 'Module', 'Programme', 'Program']) ||
    event.course ||
    event.subject ||
    source;
  const sessionDescription =
    event.sessionDescription ||
    fieldFromDescription(description, ['Description', 'Session Description', 'Topic']) ||
    firstNarrativeLine(description);
  const mode = event.mode || fieldFromDescription(description, ['Mode', 'Delivery Mode', 'Format']);
  const venue =
    event.location ||
    fieldFromDescription(description, ['Venue', 'Location', 'Room', 'Classroom']) ||
    (meetingLink ? 'Online' : NOT_PROVIDED);

  return {
    title: cleanText(event.title) || 'Untitled calendar event',
    course: cleanText(course) || NOT_PROVIDED,
    description: cleanText(sessionDescription) || 'No description provided.',
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
    venueLabel: formatVenueLabel(mode, venue, Boolean(meetingLink)),
    source: cleanText(source) || NOT_PROVIDED,
    meetingLink,
  };
}
