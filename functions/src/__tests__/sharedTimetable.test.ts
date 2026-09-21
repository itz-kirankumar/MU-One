import { isSharedCalendar, toPublicTimetableEvent } from "../utils/sharedTimetable";
import type { NormalizedEvent } from "../utils/eventParsing";

describe("shared timetable privacy", () => {
  it("accepts shared calendars and rejects primary or user-owned calendars", () => {
    expect(isSharedCalendar({ primary: false, accessRole: "reader" })).toBe(true);
    expect(isSharedCalendar({ primary: false, accessRole: "writer" })).toBe(true);
    expect(isSharedCalendar({ primary: true, accessRole: "owner" })).toBe(false);
    expect(isSharedCalendar({ primary: false, accessRole: "owner" })).toBe(false);
  });

  it("strips private source and people fields from public records", () => {
    const event = {
      googleEventId: "event-1",
      iCalUID: "event-1@example.com",
      title: "Session 4: Consumer choices",
      descriptionExcerpt: "Course Name: Consumer Behaviour\nSection 5",
      sourceCalendarId: "private-calendar-id@example.com",
      sourceCalendarName: "Consumer Behaviour",
      startIso: "2026-09-22T09:00:00+05:30",
      endIso: "2026-09-22T11:00:00+05:30",
      isAllDay: false,
      htmlLink: null,
      subject: "Consumer Behaviour",
      activityType: "Session",
      course: "Consumer Behaviour",
      sessionDescription: "Consumer choices",
      mode: "offline",
      location: "Room 204",
      faculty: "Faculty Name",
      organizerName: "Calendar Owner",
      organizerEmail: "owner@example.com",
      meetingLink: "",
      isDeadline: false,
      dateFormatted: "22 Sep 2026",
      timeFormatted: "9:00 AM",
      sectionNumber: 5,
      sectionCode: "E",
      sharedTimetable: true,
    } satisfies NormalizedEvent;

    const published = toPublicTimetableEvent(event);
    expect(published).toMatchObject({ subject: "Consumer Behaviour", sectionCode: "E", sectionLabel: "Section E" });
    expect(published).not.toHaveProperty("sourceCalendarId");
    expect(published).not.toHaveProperty("faculty");
    expect(published).not.toHaveProperty("organizerName");
    expect(published).not.toHaveProperty("organizerEmail");
  });
});
