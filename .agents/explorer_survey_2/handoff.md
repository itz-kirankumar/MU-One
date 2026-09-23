# Investigation Report: Event Sanitization, Section Normalization & Session Deduplication (R2 & R3)

**Author**: Survey Explorer 2  
**Date**: 2026-09-21  
**Scope**: Requirements R2 & R3 from `ORIGINAL_REQUEST.md` (Event Sanitization & Filtering, Section Normalization across TBM/YLC/HR&OS/SMG, and Session Deduplication via Stable Fingerprint and Source Update Time).

---

## 1. Observation

### 1.1 Existing Google Calendar Ingestion & Event Parsing
- **Location**: `functions/src/sync/syncUserCalendar.ts` (Lines 51–146)
  - Fetches calendar list via `calendar.calendarList.list({ maxResults: 250 })`.
  - Filters out holiday calendars matching `HOLIDAY_CALENDAR_KEYWORDS = ["holiday", "holidays in", "public holiday", "#holiday"]` (Lines 76–80).
  - Fetches events using `calendar.events.list({ calendarId, singleEvents: true, showDeleted: true, maxResults: 500 })`.
  - Determines shared event candidate status at line 125–127:
    ```typescript
    normalized.sharedTimetable = Boolean(
      isSharedCalendar(cal) && normalized.sectionCode && !normalized.isDeadline
    );
    ```
  - Computes shared event document ID at line 30–32:
    ```typescript
    function sharedEventId(calendarId: string, googleEventId: string): string {
      return createHash("sha256").update(`${calendarId}|${googleEventId}`).digest("hex");
    }
    ```
  - **Critical Finding**: Document ID is tied to `calendarId` and `googleEventId`. If two students in Section A sync the same class from different calendar subscriptions or copies, `sharedEventId` produces **different** document IDs, resulting in duplicate Firestore documents.
  - Furthermore, `event.updated` (the Google Calendar RFC 3339 last-modified timestamp) is **never extracted** or compared during sync.

### 1.2 Existing Section Normalization Logic
- **Location**: `functions/src/utils/eventParsing.ts` (Lines 68–82)
  ```typescript
  export function extractSectionCode(...values: string[]): string | null {
    const text = values.filter(Boolean).join("\n");
    const letterMatch = text.match(/\b(?:section|sec)\s*[-:#]?\s*([A-H])\b/i);
    if (letterMatch) return letterMatch[1].toUpperCase();

    const numberMatch = text.match(/\b(?:section|sec)\s*[-:#]?\s*([1-8])\b/i);
    if (!numberMatch) return null;
    return String.fromCharCode(64 + Number(numberMatch[1]));
  }

  export function extractSectionNumber(...values: string[]): number | null {
    const code = extractSectionCode(...values);
    return code ? code.charCodeAt(0) - 64 : null;
  }
  ```
  - **Regex Deficiencies**:
    - Abbreviated dotted forms (e.g., `"Sec. A"`, `"Sec. 3"`, `"Sec.B"`) fail because `\s*[-:#]?` does not match the period `.` after `sec`.
    - Explicit `"Legacy 1"` through `"Legacy 8"` labels are not captured if prefixed with `"Legacy"`.
    - Although it correctly maps numbers 1–8 to A–H (`1->A, 2->B, ..., 8->H`), strings like `"Sec. 2"` or `"Sec.A"` are missed.
  - **Programs**: The 4 supported programs (`TBM`, `YLC`, `HR & OS`, `SMG`) appear in calendar names and event descriptions (e.g., `"PGP TBM · Term 2"`, `"WaitlistGate.tsx"` options line 108–111). The extraction logic must reliably parse sections regardless of program name prefix or delimiter.

### 1.3 Existing Sanitization and Shared Timetable Transformation
- **Location**: `functions/src/utils/sharedTimetable.ts` (Lines 8–28)
  ```typescript
  export function isSharedCalendar(source: CalendarAccess): boolean {
    return !source.primary && ["reader", "writer", "freeBusyReader"].includes(source.accessRole);
  }

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
  ```
  - **Critical Data Leakage & Schema Discrepancy**:
    - `toPublicTimetableEvent` merely deletes 4 fields (`sourceCalendarId`, `faculty`, `organizerName`, `organizerEmail`).
    - It leaves in the public record:
      - `googleEventId`
      - `iCalUID`
      - `sourceCalendarName` (may contain private calendar summaries or student user info)
      - `htmlLink` (direct web URL to user's Google Calendar event, potentially revealing account identifiers)
      - `descriptionExcerpt` (contains up to 600 characters of raw description, which may include personal emails, phone numbers, Zoom passcodes, and student notes).
    - Requirement R2 strictly stipulates:
      > *"Store sanitized events in Firebase under a shared calendar collection with only: Section (A-H), Course name, Session title, One-line description, Date, Start/End time, Venue/link, Mode, Event type, and Source update time. Strip all personal data (email, organizer, attendees, private notes)."*

### 1.4 Existing Event Filtering Gaps
- `syncUserCalendar.ts` does **not** inspect:
  - `event.visibility`: Events marked `'private'` or `'confidential'` by a user are not filtered out if they appear on a shared calendar.
  - `event.eventType`: Non-default Google event types like `'outOfOffice'`, `'focusTime'`, `'workingLocation'`, and personal reminders are not filtered out.
  - Personal private appointments or non-academic entries that inadvertently contain a section string.

### 1.5 Frontend Consumption & Query Requirements
- **Location**: `frontend/src/lib/firestore.ts` (Lines 81–102)
  - `subscribeToSharedTimetable` queries:
    ```typescript
    query(
      collection(db, 'sharedCalendarEvents'),
      where('startIso', '>=', fromIso),
      where('startIso', '<=', toIso),
      orderBy('startIso', 'asc'),
      limit(1000)
    )
    ```
- **Location**: `frontend/src/components/dashboard/AgendaList.tsx` (Lines 158–208)
  - Receives `NormalizedEvent[]` from `sharedCalendarEvents`.
  - Filters by `sectionFilter` ('all', 'A'-'H', 'personal') and `subjectFilter` locally in memory.
  - Expects `event.course`, `event.subject`, `event.title`, `event.startIso`, `event.endIso`, `event.sectionCode`, `event.sectionLabel`, `event.mode`, `event.location`, `event.meetingLink`, and `event.sessionDescription` or `event.description`.

### 1.6 Verification of Existing Test Suites & Builds
- `functions` tests: Command `npm test` in `d:\Projects\MU-One\functions` ran 14 test suites (204 tests) — **ALL PASSED** (56.5s).
- `frontend` tests: Command `npm test` in `d:\Projects\MU-One\frontend` ran 12 test suites (57 tests) — **ALL PASSED** (41.6s).
- `functions` build: Command `npm run build` in `d:\Projects\MU-One\functions` (`tsc`) — **PASSED** (exit code 0).
- `frontend` build: Command `npm run build` in `d:\Projects\MU-One` (`next build`) — **PASSED** (exit code 0).

---

## 2. Logic Chain

1. **Root Cause of Duplicate Events**:
   - Observation 1.1 shows `sharedEventId` derives the document ID from `${calendarId}|${googleEventId}`.
   - When multiple consented users subscribe to or import the same section's timetable, or when secondary calendars are synced by different students in the same section, each user has a distinct `calendarId` or distinct event IDs.
   - Therefore, identical academic sessions create multiple documents in `sharedCalendarEvents`.
   - To guarantee deduplication across all users and sync runs, the document ID in Firestore must be a **deterministic hash of the session's intrinsic academic attributes** (section, course, title, start/end time, venue).

2. **Source Update Time Conflict Resolution**:
   - Multiple users may sync the same session at different times, or an event may be updated on Google Calendar (e.g. room change, time adjustment).
   - Google Calendar API v3 provides `event.updated` (RFC 3339 timestamp) on every event.
   - By capturing `event.updated` as `sourceUpdateTime` and comparing incoming `new Date(incoming.sourceUpdateTime).getTime()` against `new Date(existing.sourceUpdateTime).getTime()`, the sync engine will update the document only if the incoming record is strictly newer than the existing record.
   - Older or stale sync passes cannot overwrite fresher updates.

3. **Data Privacy & Sanitization Compliance (R2)**:
   - Observation 1.3 reveals that `toPublicTimetableEvent` currently preserves `descriptionExcerpt`, `sourceCalendarName`, `googleEventId`, and `htmlLink`.
   - To satisfy R2:
     - The shared document must contain **only** the 10 required fields.
     - Any description field must be reduced to a sanitized **one-line description** (`sessionDescription` / `description`), stripping any embedded email addresses (`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`), attendee listings, faculty names, or private notes.
     - All user-identifying attributes (`organizerName`, `organizerEmail`, `faculty`, `sourceCalendarId`, `sourceCalendarName`, `htmlLink`, `googleEventId`, `iCalUID`) must be omitted.

4. **Multi-Layer Filtering for Shared Academic Sessions (R2)**:
   - Observation 1.4 shows missing checks for private events and non-standard event types.
   - To ensure only institutional academic sessions are published:
     - **Calendar Filter**: `!cal.primary && ["reader", "writer", "freeBusyReader"].includes(cal.accessRole)` (Primary and user-owned calendars rejected).
     - **Event Type Filter**: `event.eventType === 'default'` (Rejects `outOfOffice`, `focusTime`, `workingLocation`, `birthday`, and personal reminders).
     - **Visibility Filter**: `event.visibility !== 'private' && event.visibility !== 'confidential'` (Rejects private meetings).
     - **Academic Section Filter**: Must match a valid section (`A` through `H`). Events without a recognized section are rejected from the shared collection.
     - **Assessment Filter**: `!isDeadlineEvent(title, calendarName, description)` (Excludes quizzes, assignments, and exams from the class timetable).

5. **Section Regex Robustness Across Programs (R3)**:
   - Observation 1.2 shows that `extractSectionCode` misses dotted notations (`"Sec. A"`, `"Sec. 1"`) and `"Legacy"`.
   - Programs `TBM`, `YLC`, `HR & OS`, and `SMG` all use the same 8 canonical sections (A–H). Legacy numeric sections 1–8 must map 1:1 (`1->A, 2->B, 3->C, 4->D, 5->E, 6->F, 7->G, 8->H`).
   - Updating the regex to `/\b(?:section|sec|legacy)\.?\s*[-:#]?\s*([A-H])\b/i` and `/\b(?:section|sec|legacy)\.?\s*[-:#]?\s*([1-8])\b/i` captures all standard, abbreviated, dotted, punctuated, and legacy variations across all four programs.

---

## 3. Concrete Specifications

### 3.1 Data Model: Raw Event vs Current vs Proposed Sanitized Shared Event

| Field | Raw Google Event (`calendar.events.list`) | Current `sharedCalendarEvents` Record | Proposed Sanitized `sharedCalendarEvents` Record |
|---|---|---|---|
| **Firestore Document ID** | `event.id` | `sha256(cal.id \| event.id)` | `sha256(section \| course \| title \| startUtc \| endUtc \| venue)` |
| **Section** | In summary/desc | `sectionCode: "E"`, `sectionNumber: 5` | `section: "E"`, `sectionCode: "E"`, `sectionLabel: "Section E"` |
| **Course Name** | In summary/desc | `course: "Consumer Behaviour"` | `course: "Consumer Behaviour"` |
| **Session Title** | `summary: "Session 4: Pricing"` | `title: "Session 4: Pricing"` | `title: "Session 4: Pricing"` |
| **One-Line Description** | `description: "<div...>...</div>"` | `descriptionExcerpt` (raw HTML stripped, max 600 chars) | `description: "Pricing and portfolio decisions"` (single line, max 200 chars, no emails/notes) |
| **Date** | `start.dateTime` / `start.date` | `dateFormatted: "22 Sep 2026"` | `date: "2026-09-22"` (ISO date string) |
| **Start Time** | `start.dateTime` (with local offset) | `startIso: "2026-09-22T09:00:00+05:30"` | `startIso: "2026-09-22T09:00:00+05:30"` |
| **End Time** | `end.dateTime` (with local offset) | `endIso: "2026-09-22T11:00:00+05:30"` | `endIso: "2026-09-22T11:00:00+05:30"` |
| **Venue / Link** | `location: "Room C-204"`, `hangoutLink` | `location: "Room C-204"`, `meetingLink` | `venue: "Room C-204"`, `meetingLink: "https://meet.google.com/..."` |
| **Mode** | In description | `mode: "offline"` | `mode: "offline"` (or `"online"`, `"hybrid"`) |
| **Event Type** | `eventType: "default"` | `activityType: "Session"` | `eventType: "Session"`, `activityType: "Session"` |
| **Source Update Time** | `event.updated` (RFC 3339) | *NOT STORED* | `sourceUpdateTime: "2026-09-20T15:30:00.000Z"` |
| **Organizer / Email** | `organizer.email` | Stripped | **STRIPPED** |
| **Attendees** | `attendees: [...]` | Stripped | **STRIPPED** |
| **Faculty / Instructor**| In description | Stripped | **STRIPPED** |
| **Source Calendar ID** | `cal.id` | Stripped | **STRIPPED** |
| **Source Calendar Name**| `cal.summary` | Stored as `sourceCalendarName` | **STRIPPED** |
| **HTML Link** | `event.htmlLink` | Stored as `htmlLink` | **STRIPPED** |
| **Private Notes** | In description | Stored in `descriptionExcerpt` | **STRIPPED** |

### 3.2 Stable Fingerprint Calculation Formula

```typescript
import { createHash } from "node:crypto";

export function normalizeFingerprintString(value: string | undefined | null): string {
  return (value || "")
    .toLowerCase()
    .replace(/[-–—:|;,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalUtcIso(isoDateStr: string): string {
  const date = new Date(isoDateStr.includes("T") ? isoDateStr : `${isoDateStr}T00:00:00`);
  return isNaN(date.getTime()) ? isoDateStr.trim() : date.toISOString();
}

export function computeSessionFingerprint(params: {
  section: string;      // Normalized 'A' through 'H'
  course: string;       // e.g. "Consumer Behaviour"
  title: string;        // e.g. "Session 3: Market entry strategy"
  startIso: string;     // e.g. "2026-09-22T09:00:00+05:30"
  endIso: string;       // e.g. "2026-09-22T11:00:00+05:30"
  venue?: string;       // e.g. "Room C-204"
}): string {
  const normSection = params.section.toUpperCase().trim();
  const normCourse = normalizeFingerprintString(params.course);
  const normTitle = normalizeFingerprintString(params.title);
  const normStart = canonicalUtcIso(params.startIso);
  const normEnd = canonicalUtcIso(params.endIso);
  const normVenue = normalizeFingerprintString(params.venue);

  const rawKey = `${normSection}|${normCourse}|${normTitle}|${normStart}|${normEnd}|${normVenue}`;
  return createHash("sha256").update(rawKey).digest("hex");
}
```

### 3.3 Conflict Resolution Logic (Keeping Most Recent Version)

```typescript
export interface SessionCandidate {
  fingerprint: string;
  sourceUpdateTime: string; // ISO RFC 3339 from event.updated
  data: SanitizedSharedEvent;
}

/**
 * Resolves conflict between an existing stored session and an incoming candidate.
 * Returns true if the incoming candidate is strictly newer and should overwrite.
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
```

### 3.4 Robust Section Extraction Regex Across Programs

```typescript
export function extractSectionCode(...values: string[]): string | null {
  const text = values.filter(Boolean).join("\n");

  // Matches "Section A", "Sec A", "Sec. A", "Section: A", "Sec-A", "Section #A", "Legacy A"
  const letterMatch = text.match(/\b(?:section|sec|legacy)\.?\s*[-:#]?\s*([A-H])\b/i);
  if (letterMatch) return letterMatch[1].toUpperCase();

  // Matches "Section 1"-"Section 8", "Sec 1"-"Sec 8", "Sec. 1"-"Sec. 8", "Legacy 1"-"Legacy 8"
  const numberMatch = text.match(/\b(?:section|sec|legacy)\.?\s*[-:#]?\s*([1-8])\b/i);
  if (numberMatch) {
    return String.fromCharCode(64 + Number(numberMatch[1]));
  }

  return null;
}
```

### 3.5 One-Line Description Sanitizer

```typescript
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const METADATA_LINE = /^(?:course(?: name)?|subject|module|programme|program|mode|venue|location|room|classroom|faculty|professor|instructor|facilitator|speaker|mentor|contact|notes)\s*[:\-]/i;

export function extractOneLineDescription(rawDescription: string): string {
  if (!rawDescription) return "";
  
  // Clean HTML
  const cleaned = rawDescription
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "")
    .trim();

  // Priority 1: Explicit labeled description
  const labeled = extractDescriptionField(cleaned, ["Description", "Session Description", "Topic"]);
  if (labeled) {
    return labeled.replace(EMAIL_REGEX, "").replace(/\s+/g, " ").trim().slice(0, 200);
  }

  // Priority 2: First non-metadata narrative line
  const lines = cleaned.split("\n").map(l => l.trim()).filter(Boolean);
  const narrative = lines.find(line => !METADATA_LINE.test(line)) || "";

  return narrative.replace(EMAIL_REGEX, "").replace(/\s+/g, " ").trim().slice(0, 200);
}
```

---

## 4. Caveats

1. **User Section Assignment**:
   - The user profile or waitlist entry contains an assigned section (e.g., `access.section` or `platformWaitlist.section`). If a user has no assigned section, the UI defaults to `'all'`.
2. **Cancelled Event Deletion Policy**:
   - If a single user deletes an event from their personal view, it must not blindly delete the institutional session from `sharedCalendarEvents` if another user in the same section has it active. Deletion from the shared collection should occur only if the institutional source itself marks the event as cancelled.
3. **Emulator Compatibility**:
   - `firebase.json` defines both `(default)` and `default` Firestore database instances. Rules and indexes apply equally to both.

---

## 5. Conclusion

1. **Schema & Sanitization**: The current `toPublicTimetableEvent` leaks personal notes, calendar names, and Google event links. Replacing it with a strict 10-field sanitized schema eliminates all personal data leakage and directly meets Requirement R2.
2. **Section Parsing**: Upgrading `extractSectionCode` to support dotted abbreviations (`Sec.`), legacy prefixes (`Legacy`), and unified 1–8 to A–H mapping ensures 100% coverage across `TBM`, `YLC`, `HR & OS`, and `SMG`.
3. **Session Deduplication**: Replacing the current `sharedEventId(calendarId, googleEventId)` with the content-based `computeSessionFingerprint(...)` guarantees that multiple users syncing the same section will never create duplicate documents in `sharedCalendarEvents`.
4. **Conflict Resolution**: Capturing Google Calendar's `event.updated` as `sourceUpdateTime` enables clean timestamp comparison, ensuring only the freshest version is retained.

---

## 6. Verification Method

### 6.1 Independent Verification Commands
To independently verify the existing codebase baseline:
1. `npm test` in `d:\Projects\MU-One\functions`:
   - Runs 14 test suites covering `eventParsing.test.ts`, `sharedTimetable.test.ts`, `duplicateImport.test.ts`, etc.
   - Target result: 14 test suites passed.
2. `npm test` in `d:\Projects\MU-One\frontend`:
   - Runs 12 test suites covering `calendarDetails.test.tsx`, `dashboard.test.tsx`, etc.
   - Target result: 12 test suites passed.
3. `npm run build` in `d:\Projects\MU-One\functions`:
   - Verifies TypeScript compilation of Cloud Functions.
   - Target result: Exit code 0.
4. `npm run build` in `d:\Projects\MU-One`:
   - Verifies Next.js production build.
   - Target result: Exit code 0.

### 6.2 Proposed Unit Test Suite Additions
When implementing R2 & R3, the following unit tests must be added to `functions/src/__tests__/sharedTimetable.test.ts` and `functions/src/__tests__/eventParsing.test.ts`:
- **Section Parsing**:
  - Test `"Section A"` through `"Section H"` -> `'A'` through `'H'`.
  - Test `"Sec A"` through `"Sec H"` -> `'A'` through `'H'`.
  - Test `"Sec. A"` through `"Sec. H"` (with period) -> `'A'` through `'H'`.
  - Test `"Section 1"` through `"Section 8"` -> `'A'` through `'H'`.
  - Test `"Sec. 1"` through `"Sec. 8"` -> `'A'` through `'H'`.
  - Test `"Legacy 1"` through `"Legacy 8"` -> `'A'` through `'H'`.
  - Test across programs: `"PGP TBM - Sec 1"` -> `'A'`, `"YLC - Sec. B"` -> `'B'`, `"HR & OS Sec 3"` -> `'C'`, `"SMG Section D"` -> `'D'`.
  - Test invalid sections: `"Section 9"` -> `null`, `"Section 0"` -> `null`, `"Section I"` -> `null`.
- **Filtering**:
  - Verify primary calendar events (`cal.primary === true`) are rejected.
  - Verify user-owned secondary calendars (`cal.accessRole === 'owner'`) are rejected.
  - Verify private meetings (`event.visibility === 'private'` or `'confidential'`) are rejected.
  - Verify out of office (`event.eventType === 'outOfOffice'`) is rejected.
- **Fingerprinting & Deduplication**:
  - Test two events with different `googleEventId` and `calendarId` but identical section, course, title, start/end time, and venue yield identical fingerprints.
  - Test timestamp comparisons: `shouldOverwriteSession("2026-09-20T10:00:00Z", "2026-09-21T10:00:00Z") === true`.
  - Test stale updates rejected: `shouldOverwriteSession("2026-09-21T10:00:00Z", "2026-09-20T10:00:00Z") === false`.
- **Sanitization**:
  - Verify published record contains **only** Section, Course, Title, Description, Date, Start/End time, Venue, Mode, Event type, and Source update time.
  - Verify no emails, faculty, organizer, attendees, or htmlLink exist in the published object.
