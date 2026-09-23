import {
  isSharedCalendar,
  isSharedEventEligible,
  toPublicTimetableEvent,
  extractOneLineDescription,
  computeSessionFingerprint,
  shouldOverwriteSession,
} from "../utils/sharedTimetable";
import type { NormalizedEvent } from "../utils/eventParsing";

describe("shared timetable privacy and sanitization", () => {
  describe("Calendar Layer Filtering (isSharedCalendar)", () => {
    it("accepts shared calendars and rejects primary or user-owned calendars", () => {
      expect(isSharedCalendar({ primary: false, accessRole: "reader" })).toBe(true);
      expect(isSharedCalendar({ primary: false, accessRole: "writer" })).toBe(true);
      expect(isSharedCalendar({ primary: false, accessRole: "freeBusyReader" })).toBe(true);

      // Rejects primary calendars regardless of access role
      expect(isSharedCalendar({ primary: true, accessRole: "owner" })).toBe(false);
      expect(isSharedCalendar({ primary: true, accessRole: "writer" })).toBe(false);
      expect(isSharedCalendar({ primary: true, accessRole: "reader" })).toBe(false);

      // Rejects user-owned secondary calendars
      expect(isSharedCalendar({ primary: false, accessRole: "owner" })).toBe(false);

      // Rejects unknown roles
      expect(isSharedCalendar({ primary: false, accessRole: "none" })).toBe(false);
    });
  });

  describe("Multi-Layer Event Filtering (isSharedEventEligible)", () => {
    const validCal = { primary: false, accessRole: "reader" };
    const validRawEvent = {
      visibility: "default",
      eventType: "default",
      status: "confirmed",
    };
    const validNormalized = {
      sectionCode: "B",
      isDeadline: false,
    };

    it("accepts valid institutional class session events", () => {
      expect(isSharedEventEligible(validCal, validRawEvent, validNormalized)).toBe(true);
    });

    it("rejects primary calendar events", () => {
      expect(
        isSharedEventEligible({ primary: true, accessRole: "owner" }, validRawEvent, validNormalized)
      ).toBe(false);
    });

    it("rejects user-owned calendar events", () => {
      expect(
        isSharedEventEligible({ primary: false, accessRole: "owner" }, validRawEvent, validNormalized)
      ).toBe(false);
    });

    it("rejects cancelled events", () => {
      expect(
        isSharedEventEligible(validCal, { ...validRawEvent, status: "cancelled" }, validNormalized)
      ).toBe(false);
    });

    it("rejects private and confidential visibility events", () => {
      expect(
        isSharedEventEligible(validCal, { ...validRawEvent, visibility: "private" }, validNormalized)
      ).toBe(false);
      expect(
        isSharedEventEligible(validCal, { ...validRawEvent, visibility: "confidential" }, validNormalized)
      ).toBe(false);
    });

    it("rejects non-default Google event types (outOfOffice, focusTime, workingLocation, reminders)", () => {
      expect(
        isSharedEventEligible(validCal, { ...validRawEvent, eventType: "outOfOffice" }, validNormalized)
      ).toBe(false);
      expect(
        isSharedEventEligible(validCal, { ...validRawEvent, eventType: "focusTime" }, validNormalized)
      ).toBe(false);
      expect(
        isSharedEventEligible(validCal, { ...validRawEvent, eventType: "workingLocation" }, validNormalized)
      ).toBe(false);
      expect(
        isSharedEventEligible(validCal, { ...validRawEvent, eventType: "reminder" }, validNormalized)
      ).toBe(false);
    });

    it("rejects deadline and assessment events", () => {
      expect(
        isSharedEventEligible(validCal, validRawEvent, { ...validNormalized, isDeadline: true })
      ).toBe(false);
    });

    it("rejects events without valid section codes A-H", () => {
      expect(
        isSharedEventEligible(validCal, validRawEvent, { ...validNormalized, sectionCode: null })
      ).toBe(false);
      expect(
        isSharedEventEligible(validCal, validRawEvent, { ...validNormalized, sectionCode: "I" })
      ).toBe(false);
      expect(
        isSharedEventEligible(validCal, validRawEvent, { ...validNormalized, sectionCode: "Z" })
      ).toBe(false);
      expect(
        isSharedEventEligible(validCal, validRawEvent, { ...validNormalized, sectionCode: "" })
      ).toBe(false);
    });
  });

  describe("Description Sanitization (extractOneLineDescription)", () => {
    it("strips emails from description", () => {
      const input = "Discussion on strategy. Contact: prof@mastersunion.org or ta@mu.org";
      const cleaned = extractOneLineDescription(input);
      expect(cleaned).not.toContain("prof@mastersunion.org");
      expect(cleaned).not.toContain("ta@mu.org");
      expect(cleaned).toContain("Discussion on strategy.");
    });

    it("strips HTML tags and entities", () => {
      const input = "<div>Session topic: <b>Pricing models</b> &amp; value creation</div>";
      const cleaned = extractOneLineDescription(input);
      expect(cleaned).toBe("Pricing models & value creation");
    });

    it("strips URLs", () => {
      const input = "Meeting link: https://meet.google.com/xyz-abc Session details follow";
      const cleaned = extractOneLineDescription(input);
      expect(cleaned).not.toContain("https://");
    });

    it("extracts labeled description and ignores metadata lines", () => {
      const input = "Course: Finance\nFaculty: Dr. Kumar\nVenue: Room 101\nDescription: Capital structure and debt ratios";
      const cleaned = extractOneLineDescription(input);
      expect(cleaned).toBe("Capital structure and debt ratios");
    });

    it("bounds description to maximum 200 characters", () => {
      const longText = "A".repeat(300);
      const cleaned = extractOneLineDescription(longText);
      expect(cleaned.length).toBeLessThanOrEqual(200);
    });
  });

  describe("10-Field Strict Sanitization (toPublicTimetableEvent)", () => {
    const rawEvent = {
      googleEventId: "event-1",
      iCalUID: "event-1@example.com",
      title: "Session 4: Consumer choices",
      descriptionExcerpt: "Course Name: Consumer Behaviour\nSection 5",
      sourceCalendarId: "private-calendar-id@example.com",
      sourceCalendarName: "Consumer Behaviour",
      startIso: "2026-09-22T09:00:00+05:30",
      endIso: "2026-09-22T11:00:00+05:30",
      isAllDay: false,
      htmlLink: "https://calendar.google.com/event?eid=abc",
      subject: "Consumer Behaviour",
      activityType: "Session",
      course: "Consumer Behaviour",
      sessionDescription: "Consumer choices and decision making models.",
      mode: "offline",
      location: "Room 204",
      faculty: "Faculty Name",
      organizerName: "Calendar Owner",
      organizerEmail: "owner@example.com",
      meetingLink: "https://meet.google.com/abc-def-ghi",
      isDeadline: false,
      dateFormatted: "22 Sep 2026",
      timeFormatted: "9:00 AM",
      sectionNumber: 5,
      sectionCode: "E",
      sharedTimetable: true,
      sourceUpdateTime: "2026-09-21T14:00:00Z",
    } satisfies NormalizedEvent;

    it("emits strictly the required timetable fields and compatibility aliases", () => {
      const published = toPublicTimetableEvent(rawEvent, "2026-09-21T15:00:00Z");

      // 10 Conceptual Fields:
      expect(published.section).toBe("E");
      expect(published.course).toBe("Consumer Behaviour");
      expect(published.title).toBe("Session 4: Consumer choices");
      expect(published.description).toBe("Consumer choices and decision making models.");
      expect(published.date).toBe("2026-09-22");
      expect(published.startIso).toBe("2026-09-22T09:00:00+05:30");
      expect(published.endIso).toBe("2026-09-22T11:00:00+05:30");
      expect(published.venue).toBe("Room 204");
      expect(published.mode).toBe("offline");
      expect(published.eventType).toBe("Session");
      expect(published.sourceUpdateTime).toBe("2026-09-21T15:00:00Z");

      // Compatibility fields
      expect(published.sectionCode).toBe("E");
      expect(published.sectionLabel).toBe("Section E");
      expect(published.subject).toBe("Consumer Behaviour");
      expect(published.location).toBe("Room 204");
      expect(published.meetingLink).toBe("https://meet.google.com/abc-def-ghi");
      expect(published.activityType).toBe("Session");
      expect(published.sharedTimetable).toBe(true);
    });

    it("STRIPS all personal identifiers and sensitive internal metadata", () => {
      const published = toPublicTimetableEvent(rawEvent);

      // Must NOT contain personal or raw Google data
      expect(published).not.toHaveProperty("organizerName");
      expect(published).not.toHaveProperty("organizerEmail");
      expect(published).not.toHaveProperty("faculty");
      expect(published).not.toHaveProperty("attendees");
      expect(published).not.toHaveProperty("sourceCalendarId");
      expect(published).not.toHaveProperty("sourceCalendarName");
      expect(published).not.toHaveProperty("googleEventId");
      expect(published).not.toHaveProperty("iCalUID");
      expect(published).not.toHaveProperty("htmlLink");
      expect(published).not.toHaveProperty("descriptionExcerpt");
      expect(published).not.toHaveProperty("sessionDescription");
    });
  });

  describe("Deterministic SHA-256 Fingerprint Deduplication (computeSessionFingerprint)", () => {
    const baseParams = {
      section: "B",
      course: "Consumer Behaviour",
      title: "Session 3: Decision Making",
      startIso: "2026-09-24T09:00:00+05:30",
      endIso: "2026-09-24T11:00:00+05:30",
      venue: "Room C-204",
    };

    it("computes deterministic 64-character SHA-256 hash", () => {
      const fp1 = computeSessionFingerprint(baseParams);
      const fp2 = computeSessionFingerprint(baseParams);
      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(fp1)).toBe(true);
    });

    it("is resilient to casing and extra whitespace", () => {
      const fp1 = computeSessionFingerprint(baseParams);
      const fpVariant = computeSessionFingerprint({
        ...baseParams,
        section: "b",
        course: "  CONSUMER BEHAVIOUR  ",
        title: "Session 3: Decision Making",
        venue: "  Room C-204  ",
      });
      expect(fpVariant).toBe(fp1);
    });

    it("produces distinct fingerprints when intrinsic attributes differ", () => {
      const fpOriginal = computeSessionFingerprint(baseParams);
      const fpDiffSection = computeSessionFingerprint({ ...baseParams, section: "C" });
      const fpDiffCourse = computeSessionFingerprint({ ...baseParams, course: "Brand Management" });
      const fpDiffTitle = computeSessionFingerprint({ ...baseParams, title: "Session 4: Pricing" });
      const fpDiffTime = computeSessionFingerprint({ ...baseParams, startIso: "2026-09-24T14:00:00+05:30" });
      const fpDiffVenue = computeSessionFingerprint({ ...baseParams, venue: "Auditorium" });

      expect(fpOriginal).not.toBe(fpDiffSection);
      expect(fpOriginal).not.toBe(fpDiffCourse);
      expect(fpOriginal).not.toBe(fpDiffTitle);
      expect(fpOriginal).not.toBe(fpDiffTime);
      expect(fpOriginal).not.toBe(fpDiffVenue);
    });
  });

  describe("Conflict Resolution (shouldOverwriteSession)", () => {
    it("overwrites existing session when incoming sourceUpdateTime is strictly newer", () => {
      expect(
        shouldOverwriteSession("2026-09-20T10:00:00Z", "2026-09-21T15:00:00Z")
      ).toBe(true);
      expect(
        shouldOverwriteSession("2026-09-21T09:00:00+05:30", "2026-09-21T10:00:00+05:30")
      ).toBe(true);
    });

    it("rejects stale incoming update when incoming sourceUpdateTime is older", () => {
      expect(
        shouldOverwriteSession("2026-09-22T08:00:00Z", "2026-09-21T12:00:00Z")
      ).toBe(false);
    });

    it("rejects overwrite when timestamps are identical", () => {
      expect(
        shouldOverwriteSession("2026-09-21T10:00:00Z", "2026-09-21T10:00:00Z")
      ).toBe(false);
    });

    it("allows overwrite when existing record has no timestamp", () => {
      expect(shouldOverwriteSession(undefined, "2026-09-21T10:00:00Z")).toBe(true);
      expect(shouldOverwriteSession(null, "2026-09-21T10:00:00Z")).toBe(true);
      expect(shouldOverwriteSession("", "2026-09-21T10:00:00Z")).toBe(true);
    });

    it("rejects overwrite when incoming candidate has no timestamp", () => {
      expect(shouldOverwriteSession("2026-09-21T10:00:00Z", undefined)).toBe(false);
      expect(shouldOverwriteSession("2026-09-21T10:00:00Z", null)).toBe(false);
      expect(shouldOverwriteSession("2026-09-21T10:00:00Z", "")).toBe(false);
    });
  });
});
