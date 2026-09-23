# BRIEFING — 2026-09-21T18:07:00Z

## Mission
Investigate backend architecture, Google Calendar sync logic, waitlist data structures, access control rules, and test runners for shared academic calendars.

## 🔒 My Identity
- Archetype: explorer
- Roles: Survey Explorer 1 (Backend Architecture, Calendar Sync & Consent Verification)
- Working directory: d:\Projects\MU-One\.agents\explorer_survey_1
- Original parent: b9706a30-9e99-42c4-a11e-6d85609cc08e
- Milestone: Survey and Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Find all existing backend files, Google Calendar sync logic, waitlist data structures, access control rules, backend test runners
- Follow Handoff Protocol (5-Component: Observation, Logic Chain, Caveats, Conclusion, Verification Method)

## Current Parent
- Conversation ID: b9706a30-9e99-42c4-a11e-6d85609cc08e
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `functions/src/index.ts`, `functions/src/access/portal.ts`, `functions/src/auth/connectGoogleAccount.ts`, `functions/src/auth/tokenStore.ts`, `functions/src/sync/syncUserCalendar.ts`, `functions/src/sync/scheduledSyncAllUsers.ts`, `functions/src/sync/syncDashboard.ts`, `functions/src/utils/sharedTimetable.ts`, `functions/src/utils/eventParsing.ts`, `functions/src/utils/domainCheck.ts`, `functions/src/utils/getDb.ts`
  - `firestore.rules`, `firestore.indexes.json`, `firebase.json`
  - `frontend/src/components/access/WaitlistGate.tsx`, `frontend/src/components/access/AccessControl.tsx`, `frontend/src/contexts/AuthContext.tsx`, `frontend/src/lib/firestore.ts`, `frontend/src/lib/firebase.ts`
  - `functions/src/__tests__/*`, `functions/jest.config.js`, `functions/package.json`
- **Key findings**:
  - Waitlist users are represented in `platformWaitlist/{callerEmail}` (`status`: "waiting" | "approved"). Platform access is granted only if in `platformAccess/{callerEmail}` (`status`: "granted").
  - Waitlist users are completely blocked from platform via `firestore.rules` (`hasPlatformAccess()`), Cloud Functions callables (`requirePlatformAccess()`), and `WaitlistGate` UI.
  - Waitlist users are currently BLOCKED from connecting Google Calendar: `getGoogleAuthUrl` requires `requirePlatformAccess` and `connectGoogleAccount` redirect rejects users not in `platformAccess`.
  - Joining the waitlist currently has NO calendar sync consent mechanism.
  - `scheduledSyncAllUsers` specifically filters out users without platform access.
  - Event sanitization in `sharedTimetable.ts:toPublicTimetableEvent` only removes 4 fields and does not enforce the restricted field list specified in R2.
  - Event deduplication in `syncUserCalendar.ts` uses `sha256(cal.id + "|" + googleEventId)`, not the content-based stable fingerprint required by R3.
  - `firestore.indexes.json` lacks composite index for `sharedCalendarEvents` querying by section and time range.
  - Backend test runner (`npm test` in `functions`) executes Jest with ts-jest in band; 14 test suites and 204 tests all pass.
- **Unexplored areas**: None for backend survey. Full backend architecture mapped.

## Key Decisions Made
- Fully analyzed waitlist blocking, consent verification requirements, calendar sync pipeline, event sanitization discrepancies, deduplication needs, and backend test runners.

## Artifact Index
- d:\Projects\MU-One\.agents\explorer_survey_1\BRIEFING.md — persistent working memory
- d:\Projects\MU-One\.agents\explorer_survey_1\progress.md — liveness heartbeat
- d:\Projects\MU-One\.agents\explorer_survey_1\handoff.md — final handoff report
