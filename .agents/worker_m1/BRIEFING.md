# BRIEFING — 2026-09-21T18:18:00Z

## Mission
Implement Milestone 1: Waitlist Consent, Sync Isolation & UI Gate (F1, F2, F12).

## 🔒 My Identity
- Archetype: Milestone 1 Implementation Worker
- Roles: specialist, qa
- Working directory: d:\Projects\MU-One\.agents\worker_m1
- Original parent: b9706a30-9e99-42c4-a11e-6d85609cc08e
- Milestone: M1 (Waitlist Consent, Sync Isolation & UI Gate)

## 🔒 Key Constraints
- Exclusively own and modify:
  - `functions/src/access/portal.ts`
  - `functions/src/auth/connectGoogleAccount.ts`
  - `functions/src/sync/scheduledSyncAllUsers.ts`
  - `frontend/src/components/access/WaitlistGate.tsx`
  - `functions/src/__tests__/waitlistConsent.test.ts`
- DO NOT modify files outside ownership boundary.
- Joining waitlist does NOT equal consent (`calendarConsent` must default to false unless explicitly consented).
- Waitlisted users must remain blocked from the platform. Under NO circumstance may `platformAccess` records be created or modified for waitlisted contributors!
- In `connectGoogleAccount`: Allow callers who have `hasPlatformAccess` OR are on `platformWaitlist` with `calendarConsent === true`. Redirect waitlisted users to waitlist gate with status `?google=connected`, NEVER granting `platformAccess`.
- In `scheduledSyncAllUsers`: Include waitlisted contributors who have `calendarConsent === true` and `googleConnection.connected === true`. Sync ONLY calendar (`syncUserCalendar`), NEVER mail or tasks.
- No facade tests. No dummy implementations.

## Current Parent
- Conversation ID: b9706a30-9e99-42c4-a11e-6d85609cc08e
- Updated: 2026-09-21T18:18:00Z

## Loaded Skills
- None explicitly loaded

## Quality Status
- Build/test result: Initializing test run
- Lint status: Not yet evaluated
- Tests added/modified: Pending `functions/src/__tests__/waitlistConsent.test.ts`

## Task Summary
- **What to build**:
  1. `portal.ts`: `updateCalendarConsent` action in `accessPortal` updating `platformWaitlist/{email}` (`calendarConsent: boolean`, `calendarConsentAt: Timestamp`).
  2. `connectGoogleAccount.ts`: Allow consented waitlist users to generate auth URL and connect Google Calendar, redirecting to waitlist gate with `?google=connected`, no platformAccess.
  3. `scheduledSyncAllUsers.ts`: Query and include consented waitlisted users for calendar sync ONLY (never mail/tasks).
  4. `WaitlistGate.tsx`: Consent checkbox ("Allow MU One to sync my academic timetable for Section A–H"), Google Calendar connect button, and explanatory disclaimer text.
  5. `functions/src/__tests__/waitlistConsent.test.ts`: Comprehensive unit tests.
- **Success criteria**: All tests pass, builds pass, strict invariants preserved.
- **Interface contracts**: PROJECT.md § Interface Contracts
- **Code layout**: PROJECT.md § Code Layout

## Key Decisions Made
- Waitlist consent stored on `platformWaitlist/{email}` document as `calendarConsent: boolean` and `calendarConsentAt: Timestamp`.
- Google OAuth for waitlist users checks `platformWaitlist/{email}.calendarConsent === true`.
- In `connectGoogleAccount`, if not granted `platformAccess` but valid consented waitlist, redirect to `buildDashboardRedirect(DASHBOARD_URL.value(), "waitlist", undefined, ...)` or URL pointing to `/waitlist?google=connected` or `buildDashboardRedirect` with query param `?google=connected` on waitlist gate URL. (Let's check how redirect works).

## Artifact Index
- `d:\Projects\MU-One\.agents\worker_m1\DISPATCH.md` — Worker dispatch
- `d:\Projects\MU-One\.agents\worker_m1\BRIEFING.md` — Situational awareness
- `d:\Projects\MU-One\.agents\worker_m1\progress.md` — Progress tracker
