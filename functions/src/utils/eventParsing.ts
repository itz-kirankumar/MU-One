/**
 * Event parsing utilities, ported from Flask app.py.
 * Normalizes raw Google Calendar events into a consistent MU One schema.
 */

export interface NormalizedEvent {
  googleEventId: string;
  iCalUID: string;
  title: string;
  descriptionExcerpt: string;
  sourceCalendarId: string;
  sourceCalendarName: string;
  startIso: string;
  endIso: string;
  isAllDay: boolean;
  htmlLink: string | null;
  subject: string;
  activityType: string;
  course: string;
  sessionDescription: string;
  mode: string;
  location: string;
  faculty: string;
  organizerName: string;
  organizerEmail: string;
  meetingLink: string;
  isDeadline: boolean;
  dateFormatted: string;
  timeFormatted: string;
  sectionNumber: number | null;
  sectionCode: string | null;
  sharedTimetable?: boolean;
}

function cleanDescription(description: string): string {
  return description
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function extractDescriptionField(
  description: string,
  labels: string[]
): string {
  const text = cleanDescription(description);
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const match = text.match(
    new RegExp(`(?:^|\\n)\\s*(?:${escaped.join("|")})\\s*[:\\-]\\s*([^\\n|;]+)`, "i")
  );
  return match?.[1]?.trim() ?? "";
}

/**
 * Extract the shared academic section. MU uses eight common sections (A-H)
 * across programmes. Legacy numeric labels are mapped 1=A through 8=H so
 * already-connected calendars continue to work while their source labels are
 * being corrected.
 */
export function extractSectionCode(...values: string[]): string | null {
  const text = values.filter(Boolean).join("\n");
  const letterMatch = text.match(/\b(?:section|sec)\s*[-:#]?\s*([A-H])\b/i);
  if (letterMatch) return letterMatch[1].toUpperCase();

  const numberMatch = text.match(/\b(?:section|sec)\s*[-:#]?\s*([1-8])\b/i);
  if (!numberMatch) return null;
  return String.fromCharCode(64 + Number(numberMatch[1]));
}

/** Legacy numeric representation retained for existing dashboard snapshots. */
export function extractSectionNumber(...values: string[]): number | null {
  const code = extractSectionCode(...values);
  return code ? code.charCodeAt(0) - 64 : null;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const DEADLINE_TERMS = [
  "deadline",
  "due",
  "submit",
  "submission",
  "assignment",
  "quiz",
  "assessment",
  "deliverable",
  "exam",
];

const DEADLINE_CALENDAR_TERMS = ["lms", "coach", "moodle", "assignment"];

/**
 * Normalizes a raw Google Calendar event object into a NormalizedEvent.
 */
export function normalizeEvent(
  event: Record<string, unknown>,
  calendarName: string,
  calendarId: string
): NormalizedEvent {
  const title =
    typeof event["summary"] === "string" ? event["summary"].trim() : "Untitled";
  const description =
    typeof event["description"] === "string" ? event["description"] : "";
  const descriptionExcerpt = cleanDescription(description).slice(0, 600);

  const startObj = event["start"] as Record<string, string> | undefined;
  const endObj = event["end"] as Record<string, string> | undefined;

  const isAllDay = Boolean(startObj && startObj["date"] && !startObj["dateTime"]);

  const startIso = isAllDay
    ? (startObj?.["date"] ?? "")
    : (startObj?.["dateTime"] ?? "");
  const endIso = isAllDay
    ? (endObj?.["date"] ?? "")
    : (endObj?.["dateTime"] ?? "");

  const subject = extractSubject(title, description);
  const activityType = extractActivityType(title);
  const course =
    extractDescriptionField(description, ["Course Name", "Course", "Subject", "Module", "Programme", "Program"]) ||
    subject;
  const sessionDescription = extractDescriptionField(description, [
    "Description",
    "Session Description",
    "Topic",
  ]);
  const mode = extractDescriptionField(description, ["Mode", "Delivery Mode", "Format"]);
  const location =
    stringField(event["location"]) ||
    extractDescriptionField(description, ["Venue", "Location", "Room", "Classroom"]);
  const faculty = extractDescriptionField(description, [
    "Faculty",
    "Professor",
    "Instructor",
    "Facilitator",
    "Speaker",
    "Mentor",
  ]);
  const organizer = event["organizer"] as Record<string, unknown> | undefined;
  const organizerName = stringField(organizer?.["displayName"]);
  const organizerEmail = stringField(organizer?.["email"]);
  const conferenceData = event["conferenceData"] as Record<string, unknown> | undefined;
  const entryPoints = Array.isArray(conferenceData?.["entryPoints"])
    ? conferenceData["entryPoints"] as Array<Record<string, unknown>>
    : [];
  const videoEntry = entryPoints.find((entry) => entry["entryPointType"] === "video");
  const meetingLink = stringField(event["hangoutLink"]) || stringField(videoEntry?.["uri"]);
  const isDeadline = isDeadlineEvent(title, calendarName, description);
  const sectionCode = extractSectionCode(calendarName, title, description);
  const sectionNumber = sectionCode ? sectionCode.charCodeAt(0) - 64 : null;

  const startDate = new Date(startIso);
  const dateFormatted = isNaN(startDate.getTime())
    ? ""
    : formatDate(startDate, isAllDay);
  const timeFormatted =
    isAllDay || isNaN(startDate.getTime()) ? "All day" : formatTime(startDate);

  return {
    googleEventId: typeof event["id"] === "string" ? event["id"] : "",
    iCalUID: typeof event["iCalUID"] === "string" ? event["iCalUID"] : "",
    title,
    descriptionExcerpt,
    sourceCalendarId: calendarId,
    sourceCalendarName: calendarName,
    startIso,
    endIso,
    isAllDay,
    htmlLink:
      typeof event["htmlLink"] === "string" ? event["htmlLink"] : null,
    subject,
    activityType,
    course,
    sessionDescription,
    mode,
    location,
    faculty,
    organizerName,
    organizerEmail,
    meetingLink,
    isDeadline,
    dateFormatted,
    timeFormatted,
    sectionNumber,
    sectionCode,
  };
}

/**
 * Extracts the subject from the event title or description.
 * Priority:
 *  1. "Subject:", "Course:", or "Module:" label in description.
 *  2. Prefix before the activity type in the title, e.g. "Finance (Quiz)" → "Finance".
 *  3. Falls back to the cleaned title.
 */
export function extractSubject(title: string, description: string): string {
  // Check description for explicit labels
  const descLabelMatch = description.match(
    /(?:Subject|Course|Module)\s*:\s*([^\n\r,]+)/i
  );
  if (descLabelMatch) {
    return descLabelMatch[1].trim();
  }

  // Extract prefix before parenthetical activity type in title
  const titleParenMatch = title.match(/^([^(]+)\s*\([^)]+\)/);
  if (titleParenMatch) {
    return titleParenMatch[1].trim();
  }

  // Strip known activity type suffixes from title
  const cleanTitle = title
    .replace(/\b(quiz|exam|deadline|assignment|submission|assessment|deliverable|lecture|class|session|workshop|seminar|webinar|tutorial|lab|presentation|case|discussion|review)\b/gi, "")
    .replace(/[-–—|:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleanTitle || title;
}

/**
 * Extracts the activity type from parentheses in a title.
 * E.g. "Finance (Quiz)" → "Quiz"
 * Returns empty string if no parenthetical found.
 */
export function extractActivityType(title: string): string {
  const match = title.match(/\(([^)]+)\)/);
  if (match) {
    return match[1].trim();
  }
  // Infer from title keywords
  const lower = title.toLowerCase();
  if (lower.includes("quiz")) return "Quiz";
  if (lower.includes("exam")) return "Exam";
  if (lower.includes("deadline") || lower.includes("due") || lower.includes("submission")) return "Deadline";
  if (lower.includes("assignment")) return "Assignment";
  if (lower.includes("workshop")) return "Workshop";
  if (lower.includes("seminar")) return "Seminar";
  if (lower.includes("lab")) return "Lab";
  if (lower.includes("presentation")) return "Presentation";
  return "";
}

/**
 * Determines whether an event is a deadline/assessment event.
 */
export function isDeadlineEvent(
  title: string,
  calendarName: string,
  description: string
): boolean {
  const lower = title.toLowerCase();
  const calLower = calendarName.toLowerCase();
  const descLower = description.toLowerCase();

  // Check title for deadline terms
  if (DEADLINE_TERMS.some((term) => lower.includes(term))) {
    return true;
  }

  // Check calendar name for LMS/Coach type calendars
  if (DEADLINE_CALENDAR_TERMS.some((term) => calLower.includes(term))) {
    return true;
  }

  // Check description for deadline terms
  if (DEADLINE_TERMS.some((term) => descLower.includes(term))) {
    return true;
  }

  return false;
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatDate(date: Date, isAllDay: boolean): string {
  if (isAllDay) {
    // For all-day events the date string is already local; parse carefully
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes.toString().padStart(2, "0");
  return `${displayHours}:${displayMinutes} ${ampm}`;
}
