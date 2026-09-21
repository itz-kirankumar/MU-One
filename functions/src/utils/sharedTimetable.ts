import type { NormalizedEvent } from "./eventParsing";

export interface CalendarAccess {
  primary: boolean;
  accessRole: string;
}

/** Personal primary calendars and user-owned secondary calendars are private. */
export function isSharedCalendar(source: CalendarAccess): boolean {
  return !source.primary && ["reader", "writer", "freeBusyReader"].includes(source.accessRole);
}

/** Remove source identifiers and people fields before publishing an event. */
export function toPublicTimetableEvent(event: NormalizedEvent) {
  const safeEvent: Partial<NormalizedEvent> = { ...event };
  delete safeEvent.sourceCalendarId;
  delete safeEvent.faculty;
  delete safeEvent.organizerName;
  delete safeEvent.organizerEmail;
  return {
    ...safeEvent,
    subject: event.course || event.subject || "General",
    course: event.course || event.subject || "General",
    sectionCode: event.sectionCode,
    sectionLabel: `Section ${event.sectionCode}`,
    sharedTimetable: true,
  };
}
