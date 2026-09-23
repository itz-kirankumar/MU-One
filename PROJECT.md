# Project: MU-One Shared Academic Calendars (Sections A–H)

## Architecture
MU-One is an academic operating platform for Masters' Union students built with Next.js (frontend) and Firebase Cloud Functions / Firestore (backend).
This project adds shared academic calendar synchronization for Sections A–H from consented waitlisted contributors while keeping them strictly blocked from the platform.

### Core Architecture Components:
1. **Waitlist & Access Control System**:
   - `platformAccess`: Allowlist collection for students with full platform access. Document ID is lowercase user email.
   - `platformWaitlist`: Registry of waitlisted students. Document ID is lowercase user email.
   - Invariant: Joining the waitlist does NOT equal consent. Consented waitlist users have `calendarConsent: true` and `calendarConsentAt: Timestamp` in `platformWaitlist`. Waitlisted users NEVER have a document in `platformAccess`.
   - UI: `WaitlistGate.tsx` displays an explicit calendar consent checkbox ("Allow MU One to sync my academic timetable for Section A–H") and a "Connect Google Calendar" button.
2. **Calendar Ingestion & Sync Pipeline**:
   - `connectGoogleAccount`: Google Calendar OAuth authorization endpoint. Allows consented waitlisted users to connect Google Calendar without granting platform access.
   - `syncUserCalendar`: Ingests events from shared departmental/program calendars, filtering out personal calendars, primary calendars, user-owned calendars, private/confidential events, and personal reminders.
   - Safe Deletion Policy: Single-user cancellations (e.g. when a student declines a class or deletes it from their personal view) must NEVER delete the shared section schedule. Shared timetable events are strictly append / fresher-update only.
   - `scheduledSyncAllUsers`: 5-minute background sync cron. Includes waitlisted contributors with `calendarConsent: true` for calendar sync ONLY (personal mail and tasks are completely excluded).
3. **Event Sanitization & Deduplication**:
   - Sanitizer: Strips organizer email, attendees, faculty, source calendar ID/name, HTML links, and private notes. Emits strictly 10 fields into `sharedCalendarEvents`.
   - Section Normalization: Regex parsing supporting "Section A-H", "Sec A-H", "Sec. A-H", and "Legacy 1-8" mapped to A-H, across all 4 programs (`TBM`, `YLC`, `HR & OS`, `SMG`).
   - Deduplication: Computes a deterministic SHA-256 fingerprint based on session content (`section | course | title | startUtc | endUtc | venue`) used as the Firestore document ID in `sharedCalendarEvents`.
   - Conflict Resolution: Compares Google Calendar `event.updated` (`sourceUpdateTime`) so only fresher revisions overwrite existing sessions.
   - Frontend Deduplication (`AgendaList.tsx`): Merges `sharedEvents` and `localEvents` using content-based matching so that shared institutional events take precedence and duplicate personal copies are suppressed.
4. **Firestore Database & Security Rules**:
   - Configured for named database `default` and `(default)` in `firebase.json`.
   - `sharedCalendarEvents`: Read permitted only for authenticated users with platform access (`hasPlatformAccess()`); client writes completely disabled.
   - Email Case-Insensitivity: Rules use `.lower()` when checking `platformAccess` document existence.
   - Composite index on `(sectionCode ASC, startIso ASC)` in `firestore.indexes.json`.
   - Dedicated security rules test suite in `functions/src/__tests__/firestoreRules.test.ts`.
5. **Frontend Calendar UI (`AgendaList.tsx`)**:
   - Section Selector: "All sections" followed by "Section A" through "Section H". In-memory filtering without page reload.
   - Default Section & Persistence: Defaults to user's registered section or "All sections" if none; preserves preference in `localStorage` for both individual sections and "all".
   - Subject Filtering: Operates within the selected section without resetting section to "all".
   - Cross-Section Comparison: Dedicated "Compare across sections" action button adjacent to the subject filter in the toolbar that opens a comparison modal/drawer displaying timings, dates, and venues across Sections A–H for the selected subject.
   - UI States: Loading ("Loading shared section calendars…"), Empty ("No sessions are available for Section X in this period."), and Error state with working Retry button.

---

## Feature Inventory

Every feature from user requirements, survey findings, and plan review is enumerated below with its assigned milestone and status:

| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| F1 | Waitlist Consent & Gating | Explicit consent tracking (`calendarConsent`) for waitlist users without granting platform access | M1 | R1 | PLANNED |
| F2 | Calendar Sync Isolation | Background sync for consented waitlisted users restricted exclusively to calendar sync (no mail/tasks) | M1 | R1 | PLANNED |
| F3 | Multi-Layer Event Filtering | Reject primary, personal, private/confidential, and reminder events | M2 | R2 | PLANNED |
| F4 | 10-Field Strict Sanitization | Strip all personal data (organizer, attendees, notes, links) and store strictly 10 fields | M2 | R2 | PLANNED |
| F5 | Section Parsing & Legacy Mapping | Normalize Section/Sec./Legacy A-H and 1-8 across TBM, YLC, HR & OS, SMG | M2 | R3 | PLANNED |
| F6 | Content Fingerprint Deduplication | Deterministic SHA-256 content key with `sourceUpdateTime` conflict resolution & safe deletion guard | M2 | R3 | PLANNED |
| F7 | Firestore Rules & Indexes | Deploy rules to `default` & `(default)`, email `.lower()` hardening, composite index, rules tests | M3 | R5 | DONE |
| F8 | Section Selector & Persistence | "All sections" + A-H, no page reload, default section & localStorage persistence | M4 | R4 | PLANNED |
| F9 | Subject Filter within Section | Fix subject filter bug so it does not reset section filter to 'all' | M4 | R4 | PLANNED |
| F10 | Cross-Section Subject Comparison | View when a course session is conducted for other sections (with dedicated toolbar button & drawer) | M4 | R4 | PLANNED |
| F11 | Calendar UI States | Loading copy, Empty copy ("No sessions are available for Section X..."), Retry button | M4 | R5 | PLANNED |
| F12 | Waitlist Consent UI Gate | Consent checkbox and Google Calendar connect button on `WaitlistGate.tsx` | M1 | R1 | PLANNED |
| F13 | Frontend Cross-Source Deduplication | Suppress duplicate personal events when matching shared timetable session exists in `AgendaList.tsx` | M4 | R3 | PLANNED |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Waitlist Consent, Sync Isolation & UI Gate | F1, F2, F12: Waitlist OAuth connection, consent storage in `platformWaitlist`, isolated sync in `scheduledSyncAllUsers`, consent checkbox & connect button in `WaitlistGate.tsx` | none | IN_PROGRESS |
| M2 | Event Sanitization, Section Normalization & Deduplication | F3, F4, F5, F6: Multi-layer filtering, 10-field sanitization, regex normalization across programs, fingerprint deduplication, `sourceUpdateTime` conflict resolution, and cancellation safety guard | none | IN_PROGRESS |
| M3 | Database Security Rules, Index Configuration & Rules Tests | F7: Multi-database rules for `default` and `(default)`, case-insensitive email matching, composite indexes, and Firestore rules test suite | none | DONE |
| M4 | Calendar UI, Cross-Section Comparison & UI States | F8, F9, F10, F11, F13: Section selector, subject filtering within section, cross-source deduplication in `AgendaList.tsx`, cross-section comparison drawer & toolbar trigger, UI states (loading, empty, retry) | M2, M3 | IN_PROGRESS |
| M5 | Final E2E Acceptance & Adversarial Hardening | Phase 1: 100% E2E test suites passing. Phase 2: Adversarial challenger and forensic audit verification | M1, M2, M3, M4 | PLANNED |

---

## Interface Contracts

### 1. Waitlist Consent & OAuth (`functions/src/access/portal.ts` & `connectGoogleAccount.ts`)
- `updateCalendarConsent(consent: boolean)` callable function / action:
  - Input: `{ consent: boolean }`
  - Output: `{ success: true, calendarConsent: boolean }`
  - Invariant: Updates `platformWaitlist/{email}.calendarConsent` and `calendarConsentAt`. Must NEVER write to `platformAccess`.
- `getGoogleAuthUrl` & `connectGoogleAccount`:
  - Input: Auth context from Firebase Auth.
  - Validation: If caller has `platformAccess` OR is on `platformWaitlist` with `calendarConsent == true`, allow OAuth flow.
  - Redirect: On success, redirect waitlisted users to waitlist gate with status `?google=connected`, NOT to dashboard.

### 2. Sanitized Shared Event Schema (`functions/src/utils/sharedTimetable.ts` & `frontend/src/lib/firestore.ts`)
- Stored collection: `/sharedCalendarEvents/{fingerprint}`
- Document ID: `computeSessionFingerprint({ section, course, title, startIso, endIso, venue })`
- Document Fields:
  - `section`: string ('A' through 'H')
  - `sectionCode`: string ('A' through 'H') (Client compatibility)
  - `sectionLabel`: string ('Section A' through 'Section H')
  - `course`: string (Course name)
  - `subject`: string (Course / Subject name)
  - `title`: string (Session title)
  - `description`: string (One-line cleaned summary, max 200 chars, no personal data, no emails, no notes)
  - `date`: string (ISO date string YYYY-MM-DD)
  - `startIso`: string (ISO datetime with offset)
  - `endIso`: string (ISO datetime with offset)
  - `venue`: string (Classroom / venue or empty string)
  - `location`: string (Classroom / venue, for frontend compatibility)
  - `meetingLink`: string (Meeting link or empty string)
  - `mode`: string ('offline' | 'online' | 'hybrid')
  - `eventType`: string ('Session')
  - `activityType`: string ('Session')
  - `sourceUpdateTime`: string (ISO RFC 3339 from Google `event.updated`)
  - `sharedTimetable`: true
- Client Mapping in `frontend/src/lib/firestore.ts`:
  Ensures `event.sectionCode = doc.sectionCode || doc.section`, `event.location = doc.location || doc.venue`, and `event.description = doc.description`.

### 3. Cross-Section Comparison Data Structure (`frontend/src/components/dashboard/CrossSectionComparison.tsx` / `AgendaList.tsx`)
- Input: `sharedEvents: NormalizedEvent[]`, `currentSubject: string`
- Output: Grouped sessions by section: `Record<string, { section: string, date: string, startIso: string, endIso: string, venue: string, mode: string, title: string }[]>`
- UI Component: Renders a structured comparison view with section columns/rows showing when Sections A–H conduct lectures for that subject.
- Trigger: A dedicated "Compare across sections" action button in `AgendaList.tsx` toolbar next to the subject filter dropdown.

---

## Code Layout

- `functions/src/access/portal.ts`: Waitlist management actions (`join`, `status`, `updateCalendarConsent`).
- `functions/src/auth/connectGoogleAccount.ts`: Google OAuth flow for admitted and consented waitlisted users.
- `functions/src/sync/scheduledSyncAllUsers.ts`: Multi-user sync cron including consented waitlisted users.
- `functions/src/sync/syncUserCalendar.ts`: Single user calendar sync with deduplication, sanitization, and safe deletion policy.
- `functions/src/utils/eventParsing.ts`: Section code extraction regex, program handling, description cleanup.
- `functions/src/utils/sharedTimetable.ts`: Sanitization schema, fingerprint computation, conflict resolution.
- `functions/src/__tests__/firestoreRules.test.ts`: Dedicated Firestore security rules unit tests.
- `firestore.rules`: Security rules for `sharedCalendarEvents`, `platformAccess`, and `platformWaitlist`.
- `firestore.indexes.json`: Composite indexes for `sharedCalendarEvents`.
- `firebase.json`: Named database declarations for `(default)` and `default`.
- `frontend/src/components/access/WaitlistGate.tsx`: Waitlist gate with consent checkbox and Google Calendar connect button.
- `frontend/src/components/dashboard/AgendaList.tsx`: Calendar interface, section switcher, subject filter, cross-source deduplication, UI states.
- `frontend/src/components/dashboard/CrossSectionComparison.tsx`: Cross-section subject comparison modal/drawer component.
- `frontend/src/lib/firestore.ts`: Realtime subscription to `sharedCalendarEvents` with field normalization.
