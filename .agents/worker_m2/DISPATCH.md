# Milestone 2 Worker Dispatch

## 2026-09-21T18:16:30Z
- **Role**: Milestone 2 Worker (Event Sanitization, Section Normalization & Deduplication)
- **Working Directory**: d:\Projects\MU-One\.agents\worker_m2
- **Project Root**: d:\Projects\MU-One
- **Original Request**: d:\Projects\MU-One\.agents\ORIGINAL_REQUEST.md
- **Project Spec**: d:\Projects\MU-One\PROJECT.md
- **Survey Findings Reference**: `d:\Projects\MU-One\.agents\explorer_survey_2\handoff.md`
- **Orchestrator Conversation ID**: b9706a30-9e99-42c4-a11e-6d85609cc08e

### Assigned File Ownership
You exclusively own and may create/modify:
- `functions/src/utils/eventParsing.ts`
- `functions/src/utils/sharedTimetable.ts`
- `functions/src/sync/syncUserCalendar.ts`
- `functions/src/__tests__/sharedTimetable.test.ts`
- `functions/src/__tests__/eventParsing.test.ts`
DO NOT modify files outside your ownership boundary.

### Implementation Tasks
1. **Section Normalization (`functions/src/utils/eventParsing.ts`)**:
   - Update `extractSectionCode` to support:
     - "Section A-H", "Sec A-H", "Sec. A-H" (with period), "Section: A", "Sec-A", "Section #A", "Legacy A".
     - "Section 1-8", "Sec 1-8", "Sec. 1-8", "Legacy 1-8" mapped to A-H (1->A, 2->B, ..., 8->H).
     - Standardize across all 4 programs: `TBM`, `YLC`, `HR & OS`, `SMG`.
     - Invalid sections (e.g., Section 9, Section 0, Section I) must return `null`.
2. **Multi-Layer Event Filtering (`functions/src/sync/syncUserCalendar.ts` & `sharedTimetable.ts`)**:
   - Filter out primary calendars (`cal.primary === true`) and user-owned calendars (`cal.accessRole === 'owner'`).
   - Filter out private/confidential events (`event.visibility === 'private'` or `'confidential'`).
   - Filter out non-default Google event types (`event.eventType !== 'default'`, such as `outOfOffice`, `focusTime`, `workingLocation`, personal reminders).
   - Filter out deadline/assessment events (`isDeadlineEvent`).
   - Only events with a valid parsed `sectionCode` (A–H) can become shared timetable events.
3. **10-Field Strict Sanitization (`functions/src/utils/sharedTimetable.ts`)**:
   - Replace `toPublicTimetableEvent` so that it emits strictly the 10 required fields to `/sharedCalendarEvents/{fingerprint}`:
     1. `section`: string ('A'–'H') (plus `sectionCode` & `sectionLabel` for UI compatibility)
     2. `course`: string (Course name)
     3. `title`: string (Session title)
     4. `description`: string (One-line cleaned summary max 200 chars; strip emails, HTML, attendees, and private notes)
     5. `date`: string (ISO date string YYYY-MM-DD)
     6. `startIso`: string & `endIso`: string (Start/End time)
     7. `venue`: string & `location`: string & `meetingLink`: string (Venue / location / conference link)
     8. `mode`: string ('offline' | 'online' | 'hybrid')
     9. `eventType`: string ('Session') (plus `activityType: 'Session'`)
     10. `sourceUpdateTime`: string (ISO RFC 3339 from Google `event.updated`)
   - STRIP all personal data: organizer name, organizer email, attendee arrays, faculty name, source calendar ID, source calendar name, Google event ID, iCalUID, and direct web links (`htmlLink`).
4. **Fingerprint Deduplication & Conflict Resolution (`functions/src/sync/syncUserCalendar.ts` & `sharedTimetable.ts`)**:
   - Compute deterministic SHA-256 fingerprint: `computeSessionFingerprint({ section, course, title, startIso, endIso, venue })`.
   - Use fingerprint as the Firestore document ID in `sharedCalendarEvents`.
   - Conflict resolution: When writing to `sharedCalendarEvents`, inspect the incoming `event.updated` timestamp (`sourceUpdateTime`). If an existing document exists with the same fingerprint, only overwrite if the incoming record is strictly newer than the existing record.
5. **Cancellation Safety Guard (`functions/src/sync/syncUserCalendar.ts`)**:
   - Individual user cancellations (e.g. `event.status === "cancelled"` from a student declining an invitation) must NEVER trigger `batch.delete()` on `sharedCalendarEvents`. Shared timetable events are append/fresher-update only.
6. **Unit Tests & Verification**:
   - Update and expand `functions/src/__tests__/sharedTimetable.test.ts` and `eventParsing.test.ts`.
   - Verify all tests pass with `npm test` in `functions`.
   - Verify clean build with `npm run build` in `functions`.

### Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Deliverable
Write your report in `d:\Projects\MU-One\.agents\worker_m2\handoff.md` and notify the orchestrator via send_message.

## 2026-09-21T18:18:00Z
- **Trigger**: Subagent invoked by orchestrator (id: b9706a30-9e99-42c4-a11e-6d85609cc08e).
- **Assigned Tasks**:
  1. Update eventParsing.ts: extractSectionCode supporting Section/Sec./Legacy A-H and 1-8 across TBM/YLC/HR&OS/SMG.
  2. Update syncUserCalendar.ts & sharedTimetable.ts: multi-layer filtering (reject primary cal, visibility private/confidential, non-default eventType, reminders).
  3. Update sharedTimetable.ts: strict 10-field sanitization (strip emails, notes, attendees, faculty, links) and deterministic SHA-256 fingerprint deduplication.
  4. Update syncUserCalendar.ts: sourceUpdateTime conflict resolution and cancellation safety guard (single student decline must NOT delete shared schedule).
  5. Update tests in functions/src/__tests__/sharedTimetable.test.ts and eventParsing.test.ts.
  6. Verify with npm test and npm run build.

