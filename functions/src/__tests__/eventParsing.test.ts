/**
 * Tests for eventParsing utilities.
 */

import {
  normalizeEvent,
  extractDescriptionField,
  extractSubject,
  extractActivityType,
  isDeadlineEvent,
  extractSectionNumber,
  extractSectionCode,
} from "../utils/eventParsing";

describe("extractDescriptionField", () => {
  it("reads labeled values from plain text and HTML descriptions", () => {
    const description = "<div>Course Name: Brand Strategy</div><div>Faculty: Prof. Mehta</div>\nRoom: C-204";
    expect(extractDescriptionField(description, ["Course Name", "Course", "Subject"])).toBe("Brand Strategy");
    expect(extractDescriptionField(description, ["Faculty", "Instructor"])).toBe("Prof. Mehta");
    expect(extractDescriptionField(description, ["Venue", "Room"])).toBe("C-204");
  });
});

describe("extractSectionCode and extractSectionNumber", () => {
  it("parses standard 'Section A' through 'Section H'", () => {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    letters.forEach((letter) => {
      expect(extractSectionCode(`Term 1 - Section ${letter}`)).toBe(letter);
      expect(extractSectionCode(`Section ${letter.toLowerCase()}`)).toBe(letter);
    });
  });

  it("parses abbreviated 'Sec A' through 'Sec H'", () => {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    letters.forEach((letter) => {
      expect(extractSectionCode(`Term 2 - Sec ${letter}`)).toBe(letter);
    });
  });

  it("parses dotted abbreviation 'Sec. A' through 'Sec. H' and attached 'Sec.A'", () => {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    letters.forEach((letter) => {
      expect(extractSectionCode(`PGP TBM - Sec. ${letter} - Classroom`)).toBe(letter);
      expect(extractSectionCode(`Sec.${letter}`)).toBe(letter);
    });
  });

  it("parses various delimiters: 'Section: A', 'Sec-A', 'Section #A', 'Section - B'", () => {
    expect(extractSectionCode("Section: A")).toBe("A");
    expect(extractSectionCode("Sec-B")).toBe("B");
    expect(extractSectionCode("Section #C")).toBe("C");
    expect(extractSectionCode("Section - D")).toBe("D");
    expect(extractSectionCode("Sec: E")).toBe("E");
  });

  it("parses legacy letter prefix: 'Legacy A' through 'Legacy H'", () => {
    expect(extractSectionCode("Legacy A")).toBe("A");
    expect(extractSectionCode("Cohort - Legacy B")).toBe("B");
    expect(extractSectionCode("Legacy H")).toBe("H");
  });

  it("maps numeric sections 'Section 1' through 'Section 8' to A-H", () => {
    const mapping: Record<number, string> = {
      1: "A", 2: "B", 3: "C", 4: "D", 5: "E", 6: "F", 7: "G", 8: "H",
    };
    Object.entries(mapping).forEach(([num, letter]) => {
      expect(extractSectionCode(`Cohort 2026 - Section ${num}`)).toBe(letter);
      expect(extractSectionNumber(`Cohort 2026 - Section ${num}`)).toBe(Number(num));
    });
  });

  it("maps abbreviated numeric 'Sec 1' through 'Sec 8' and dotted 'Sec. 1' through 'Sec. 8'", () => {
    expect(extractSectionCode("Sec 1")).toBe("A");
    expect(extractSectionCode("Sec. 2")).toBe("B");
    expect(extractSectionCode("Sec.3")).toBe("C");
    expect(extractSectionCode("Sec-4")).toBe("D");
    expect(extractSectionCode("Sec 8")).toBe("H");
  });

  it("maps 'Legacy 1' through 'Legacy 8' to A-H", () => {
    expect(extractSectionCode("Legacy 1")).toBe("A");
    expect(extractSectionCode("Legacy 5")).toBe("E");
    expect(extractSectionCode("Legacy 8")).toBe("H");
    expect(extractSectionNumber("Legacy 8")).toBe(8);
  });

  it("operates consistently across all 4 programs: TBM, YLC, HR & OS, SMG", () => {
    expect(extractSectionCode("PGP TBM - Section A - Term 1")).toBe("A");
    expect(extractSectionCode("PGP TBM · Term 2 · Sec 1")).toBe("A");
    expect(extractSectionCode("YLC Programme - Section D")).toBe("D");
    expect(extractSectionCode("YLC - Sec. B")).toBe("B");
    expect(extractSectionCode("HR & OS - Sec E")).toBe("E");
    expect(extractSectionCode("HR & OS Sec 3")).toBe("C");
    expect(extractSectionCode("HR&OS Sec. 6")).toBe("F");
    expect(extractSectionCode("SMG Section D")).toBe("D");
    expect(extractSectionCode("SMG - Section 7")).toBe("G");
    expect(extractSectionCode("SMG Sec. 8")).toBe("H");
  });

  it("rejects invalid sections, out-of-range numbers, and non-section words", () => {
    expect(extractSectionCode("Section 0")).toBeNull();
    expect(extractSectionCode("Section 9")).toBeNull();
    expect(extractSectionCode("Sec 12")).toBeNull();
    expect(extractSectionCode("Section Z")).toBeNull();
    expect(extractSectionCode("Section I")).toBeNull();
    expect(extractSectionCode("Legacy 9")).toBeNull();
    expect(extractSectionCode("Legacy 0")).toBeNull();
    expect(extractSectionCode("Secondary A")).toBeNull();
    expect(extractSectionCode("Security B")).toBeNull();
    expect(extractSectionCode("Second C")).toBeNull();
    expect(extractSectionCode("Room 914", "Term 2")).toBeNull();
    expect(extractSectionCode("No section info here")).toBeNull();
    expect(extractSectionNumber("Room 914", "Term 2")).toBeNull();
    expect(extractSectionNumber("Section 9")).toBeNull();
  });
});

describe("extractActivityType", () => {
  it("extracts activity type from parentheses in title", () => {
    expect(extractActivityType("Finance (Quiz)")).toBe("Quiz");
    expect(extractActivityType("Operations Management (Exam)")).toBe("Exam");
    expect(extractActivityType("Marketing (Case Study)")).toBe("Case Study");
  });

  it("returns empty string when no parentheses", () => {
    expect(extractActivityType("Regular Class")).toBe("");
  });

  it("infers Quiz from title keyword without parentheses", () => {
    expect(extractActivityType("Finance Quiz")).toBe("Quiz");
  });

  it("infers Exam from title keyword", () => {
    expect(extractActivityType("Mid-Term Exam")).toBe("Exam");
  });

  it("infers Deadline from 'due' keyword", () => {
    expect(extractActivityType("Assignment Due")).toBe("Deadline");
  });
});

describe("extractSubject", () => {
  it("extracts subject from 'Finance (Quiz)' title pattern", () => {
    expect(extractSubject("Finance (Quiz)", "")).toBe("Finance");
  });

  it("extracts subject from description 'Subject: Operations Management'", () => {
    expect(
      extractSubject("Some Title", "Subject: Operations Management\nDetails below")
    ).toBe("Operations Management");
  });

  it("extracts subject from description 'Course: Finance'", () => {
    expect(extractSubject("Random", "Course: Finance")).toBe("Finance");
  });

  it("extracts subject from description 'Module: Strategy'", () => {
    expect(extractSubject("Random", "Module: Strategy")).toBe("Strategy");
  });

  it("falls back to cleaned title when no pattern found", () => {
    const result = extractSubject("Lecture on Leadership", "");
    // Should remove 'lecture' keyword and clean up
    expect(result.toLowerCase()).not.toContain("lecture");
  });
});

describe("isDeadlineEvent", () => {
  it("returns true for title containing 'deadline'", () => {
    expect(isDeadlineEvent("Project Deadline", "Class Calendar", "")).toBe(true);
  });

  it("returns true for title containing 'quiz'", () => {
    expect(isDeadlineEvent("Finance Quiz", "Class Calendar", "")).toBe(true);
  });

  it("returns true for title containing 'submission'", () => {
    expect(isDeadlineEvent("Assignment Submission", "Class Calendar", "")).toBe(true);
  });

  it("returns true for title containing 'exam'", () => {
    expect(isDeadlineEvent("Mid Term Exam", "Primary", "")).toBe(true);
  });

  it("returns true for calendar name containing 'coach' (LMS calendar)", () => {
    expect(isDeadlineEvent("Guest Lecture", "Coach LMS", "")).toBe(true);
  });

  it("returns true for calendar name containing 'lms'", () => {
    expect(isDeadlineEvent("Assignment", "MU LMS", "")).toBe(true);
  });

  it("returns false for a normal class event", () => {
    expect(isDeadlineEvent("Strategy Class", "Primary Calendar", "")).toBe(false);
  });

  it("returns false for a regular meeting", () => {
    expect(isDeadlineEvent("Team Meeting", "Work", "Discussion about roadmap")).toBe(false);
  });

  it("returns true when description contains 'due'", () => {
    expect(
      isDeadlineEvent("Class", "Primary", "Please submit your paper due Friday")
    ).toBe(true);
  });
});

describe("normalizeEvent", () => {
  const baseEvent = {
    id: "evt-001",
    iCalUID: "evt-001@google.com",
    summary: "Finance (Quiz)",
    description: "Subject: Corporate Finance\nPlease prepare chapters 1-5.",
    start: { dateTime: "2024-09-15T10:00:00+05:30" },
    end: { dateTime: "2024-09-15T11:00:00+05:30" },
    htmlLink: "https://calendar.google.com/event?eid=evt-001",
  };

  it("normalizes basic event fields", () => {
    const result = normalizeEvent(baseEvent, "My Calendar", "primary");
    expect(result.googleEventId).toBe("evt-001");
    expect(result.iCalUID).toBe("evt-001@google.com");
    expect(result.title).toBe("Finance (Quiz)");
    expect(result.sourceCalendarId).toBe("primary");
    expect(result.sourceCalendarName).toBe("My Calendar");
    expect(result.isAllDay).toBe(false);
    expect(result.htmlLink).toBe("https://calendar.google.com/event?eid=evt-001");
    expect(result.sectionNumber).toBeNull();
  });

  it("extracts subject 'Corporate Finance' from description label", () => {
    const result = normalizeEvent(baseEvent, "My Calendar", "primary");
    expect(result.subject).toBe("Corporate Finance");
  });

  it("extracts activityType 'Quiz' from title parentheses", () => {
    const result = normalizeEvent(baseEvent, "My Calendar", "primary");
    expect(result.activityType).toBe("Quiz");
  });

  it("marks a quiz event as a deadline", () => {
    const result = normalizeEvent(baseEvent, "My Calendar", "primary");
    expect(result.isDeadline).toBe(true);
  });

  it("handles all-day events", () => {
    const allDayEvent = {
      ...baseEvent,
      start: { date: "2024-09-15" },
      end: { date: "2024-09-16" },
    };
    const result = normalizeEvent(allDayEvent, "My Calendar", "primary");
    expect(result.isAllDay).toBe(true);
    expect(result.timeFormatted).toBe("All day");
    expect(result.startIso).toBe("2024-09-15");
  });

  it("marks a normal class as not a deadline", () => {
    const classEvent = {
      id: "class-001",
      iCalUID: "class-001@google.com",
      summary: "Strategy Class",
      description: "Regular lecture session",
      start: { dateTime: "2024-09-15T09:00:00+05:30" },
      end: { dateTime: "2024-09-15T10:30:00+05:30" },
    };
    const result = normalizeEvent(classEvent, "Primary", "primary");
    expect(result.isDeadline).toBe(false);
  });

  it("preserves detailed location, faculty, organizer, and meeting metadata", () => {
    const detailedEvent = {
      ...baseEvent,
      description: "Description: Pricing and portfolio decisions\nCourse Name: Corporate Finance\nFaculty: Prof. Asha Rao\nMode: offline\nVenue: fallback room",
      location: "Room C-204",
      organizer: { displayName: "Academic Office", email: "academics@mastersunion.org" },
      hangoutLink: "https://meet.google.com/abc-defg-hij",
    };
    const result = normalizeEvent(detailedEvent, "Term 2", "calendar-2");
    expect(result).toMatchObject({
      course: "Corporate Finance",
      sessionDescription: "Pricing and portfolio decisions",
      mode: "offline",
      location: "Room C-204",
      faculty: "Prof. Asha Rao",
      organizerName: "Academic Office",
      organizerEmail: "academics@mastersunion.org",
      meetingLink: "https://meet.google.com/abc-defg-hij",
      sourceCalendarName: "Term 2",
    });
  });

  it("captures a section from an event description", () => {
    const result = normalizeEvent(
      { ...baseEvent, description: "Course Name: Consumer Behaviour\nSection 5 - Term 3 - PGPTBMYLC2" },
      "Consumer Behaviour",
      "shared-calendar"
    );
    expect(result.sectionNumber).toBe(5);
    expect(result.sectionCode).toBe("E");
  });

  it("keeps the shared calendar's section when event text names a different section", () => {
    const result = normalizeEvent(
      { ...baseEvent, description: "Course Name: Consumer Behaviour\nSection A" },
      "Section 5 - Term 3 - PGPTBMYLC2",
      "shared-calendar"
    );
    expect(result.sectionCode).toBe("E");
    expect(result.sectionNumber).toBe(5);
  });

  it("leaves unlabelled events without a section", () => {
    const result = normalizeEvent(baseEvent, "Shared academic calendar", "shared-calendar");
    expect(result.sectionCode).toBeNull();
  });

  it("captures sourceUpdateTime from Google event updated property", () => {
    const timestamp = "2026-09-21T15:30:00.000Z";
    const result = normalizeEvent(
      { ...baseEvent, updated: timestamp },
      "Term 1",
      "cal-1"
    );
    expect(result.sourceUpdateTime).toBe(timestamp);
  });
});
