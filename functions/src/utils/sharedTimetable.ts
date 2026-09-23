import { createHash } from "node:crypto";
import type { NormalizedEvent } from "./eventParsing";

export interface CalendarAccess {
  primary: boolean;
  accessRole: string;
}

export interface RawGoogleEvent {
  id?: string | null;
  status?: string | null;
  visibility?: string | null;
  eventType?: string | null;
  updated?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  hangoutLink?: string | null;
  [key: string]: unknown;
}

/**
 * Strict 10-Field Sanitized Public Shared Timetable Schema.
 * Stored at /sharedCalendarEvents/{fingerprint}.
 *
 * Core 10 Fields:
 *  1. section (string 'A'–'H')
 *  2. course (string)
 *  3. title (string)
 *  4. description (string, max 200 chars, no personal data, no emails/notes)
 *  5. date (string YYYY-MM-DD)
 *  6. startIso & endIso (ISO datetimes)
 *  7. venue & location & meetingLink (venue/link)
 *  8. mode ('offline' | 'online' | 'hybrid')
 *  9. eventType ('Session')
 * 10. sourceUpdateTime (ISO RFC 3339 from Google event.updated)
 *
 * Additional UI compatibility fields:
 * - sectionCode: matches section ('A'–'H')
 * - sectionLabel: formatted label (e.g. 'Section A')
 * - subject: matches course
 * - activityType: matches eventType ('Session')
 * - sharedTimetable: boolean true
 */
export interface SanitizedSharedEvent {
  section: string;
  sectionCode: string;
  sectionLabel: string;
  course: string;
  subject: string;
  title: string;
  description: string;
  date: string;
  startIso: string;
  endIso: string;
  venue: string;
  location: string;
  meetingLink: string;
  mode: string;
  eventType: string;
  activityType: string;
  sourceUpdateTime: string;
  sharedTimetable: true;
}

/** Personal primary calendars and user-owned secondary calendars are private. */
export function isSharedCalendar(source: CalendarAccess): boolean {
  return !source.primary && ["reader", "writer", "freeBusyReader"].includes(source.accessRole);
}

/**
 * Multi-layer filtering to determine if an event is eligible for the shared timetable.
 * Filters out:
 *  1. Primary calendars (cal.primary === true) and user-owned calendars (accessRole === 'owner')
 *  2. Cancelled events (status === 'cancelled')
 *  3. Private or confidential meetings (visibility === 'private' | 'confidential')
 *  4. Non-default Google event types (outOfOffice, focusTime, workingLocation, reminders)
 *  5. Assessment and deadline events (quizzes, submissions, exams)
 *  6. Events lacking a recognized Section A through H
 */
export function isSharedEventEligible(
  calendar: CalendarAccess,
  rawEvent: {
    visibility?: string | null;
    eventType?: string | null;
    status?: string | null;
  },
  normalized: {
    sectionCode?: string | null;
    isDeadline?: boolean;
  }
): boolean {
  // Calendar layer: Reject primary and user-owned calendars
  if (!isSharedCalendar(calendar)) {
    return false;
  }

  // Status layer: Reject cancelled events
  if (rawEvent.status === "cancelled") {
    return false;
  }

  // Visibility layer: Reject private and confidential meetings
  const visibility = (rawEvent.visibility || "").toLowerCase().trim();
  if (visibility === "private" || visibility === "confidential") {
    return false;
  }

  // Event type layer: Reject non-default Google events (outOfOffice, focusTime, workingLocation, reminders)
  const eventType = (rawEvent.eventType || "").trim();
  if (eventType && eventType !== "default") {
    return false;
  }

  // Assessment/deadline layer: Reject assignments, quizzes, exams, submissions
  if (normalized.isDeadline) {
    return false;
  }

  // Section layer: Only events with a valid parsed section code (A-H) can be published
  if (!normalized.sectionCode || !/^[A-H]$/.test(normalized.sectionCode.trim().toUpperCase())) {
    return false;
  }

  return true;
}

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const URL_REGEX = /https?:\/\/[^\s]+/g;
const METADATA_LINE = /^(?:course(?: name)?|subject|module|programme|program|mode|venue|location|room|classroom|faculty|professor|instructor|facilitator|speaker|mentor|contact|notes|private notes|attendees?|organizer)\s*[:\-]/i;

/**
 * Cleans a description string to produce a one-line summary max 200 characters.
 * Strips HTML, email addresses, URLs, attendee lists, faculty contacts, and private notes.
 */
export function extractOneLineDescription(rawDescription: string): string {
  if (!rawDescription) return "";

  // 1. Clean HTML tags and common entities
  const text = rawDescription
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .trim();

  // 2. Look for explicit labeled description line if present
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const labeledLine = lines.find((line) =>
    /^(?:session\s+)?(?:description|topic)\s*[:\-]/i.test(line)
  );

  let candidateText = "";
  if (labeledLine) {
    candidateText = labeledLine.replace(/^(?:session\s+)?(?:description|topic)\s*[:\-]\s*/i, "");
  } else {
    // Pick the first line that is not a metadata label (course, faculty, venue, contact, notes, etc.)
    const narrative = lines.find((line) => !METADATA_LINE.test(line));
    candidateText = narrative || "";
  }

  // 3. Strip emails, web URLs, and normalize whitespace to a single line
  const sanitized = candidateText
    .replace(EMAIL_REGEX, "")
    .replace(URL_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();

  // 4. Bound to maximum 200 characters
  return sanitized.slice(0, 200).trim();
}

/**
 * Computes a deterministic SHA-256 fingerprint for session deduplication.
 * Stable across different users and calendar IDs syncing the same academic session.
 * Formula: sha256(section | course | title | startIso | endIso | venue)
 */
export function computeSessionFingerprint(params: {
  section: string;
  course: string;
  title: string;
  startIso: string;
  endIso: string;
  venue?: string;
}): string {
  const normSection = (params.section || "").trim().toUpperCase();
  const normCourse = (params.course || "").trim().toLowerCase();
  const normTitle = (params.title || "").trim().toLowerCase();
  const normStart = (params.startIso || "").trim();
  const normEnd = (params.endIso || "").trim();
  const normVenue = (params.venue || "").trim().toLowerCase();

  const rawKey = `${normSection}|${normCourse}|${normTitle}|${normStart}|${normEnd}|${normVenue}`;
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * Evaluates whether an incoming session candidate should overwrite an existing session.
 * Returns true if the incoming record is strictly newer than the existing record.
 */
export function shouldOverwriteSession(
  existingSourceUpdateTime: string | undefined | null,
  incomingSourceUpdateTime: string | undefined | null
): boolean {
  if (!existingSourceUpdateTime) return true;
  if (!incomingSourceUpdateTime) return false;

  const existingTime = new Date(existingSourceUpdateTime).getTime();
  const incomingTime = new Date(incomingSourceUpdateTime).getTime();

  if (isNaN(incomingTime)) return false;
  if (isNaN(existingTime)) return true;

  return incomingTime > existingTime;
}

/**
 * Transforms a NormalizedEvent into a strictly sanitized public timetable event.
 * Emits strictly the required 10 conceptual fields (plus UI compatibility fields).
 * STRIPS: organizer name, organizer email, attendee arrays, faculty name,
 * source calendar ID, source calendar name, Google event ID, iCalUID, and direct web links.
 */
export function toPublicTimetableEvent(
  event: NormalizedEvent,
  sourceUpdateTime?: string
): SanitizedSharedEvent {
  const code = (event.sectionCode || "").toUpperCase().trim();
  const rawDesc = event.sessionDescription || event.descriptionExcerpt || "";
  const cleanedDesc = extractOneLineDescription(rawDesc);
  const courseName = (event.course || event.subject || "General").trim();
  const updateTime = sourceUpdateTime || event.sourceUpdateTime || new Date().toISOString();

  return {
    section: code,
    sectionCode: code,
    sectionLabel: code ? `Section ${code}` : "",
    course: courseName,
    subject: courseName,
    title: event.title || "Untitled",
    description: cleanedDesc,
    date: event.startIso ? event.startIso.slice(0, 10) : "",
    startIso: event.startIso || "",
    endIso: event.endIso || "",
    venue: event.location || "",
    location: event.location || "",
    meetingLink: event.meetingLink || "",
    mode: event.mode || "offline",
    eventType: "Session",
    activityType: "Session",
    sourceUpdateTime: updateTime,
    sharedTimetable: true,
  };
}
