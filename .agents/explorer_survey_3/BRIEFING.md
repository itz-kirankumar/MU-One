# BRIEFING — 2026-09-21T18:09:00Z

## Mission
Investigate Firestore database configuration, security rules, indexes (named database `default` and `(default)`), and Frontend Calendar UI to support shared academic calendars for Sections A-H.

## 🔒 My Identity
- Archetype: explorer
- Roles: survey, investigator, synthesizer
- Working directory: d:\Projects\MU-One\.agents\explorer_survey_3
- Original parent: b9706a30-9e99-42c4-a11e-6d85609cc08e
- Milestone: survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Produce a structured analysis report informing subsequent work
- Write only to .agents/explorer_survey_3/
- Send all results back via send_message to b9706a30-9e99-42c4-a11e-6d85609cc08e

## Current Parent
- Conversation ID: b9706a30-9e99-42c4-a11e-6d85609cc08e
- Updated: 2026-09-21T18:09:00Z

## Investigation State
- **Explored paths**:
  - `firebase.json`, `firestore.rules`, `firestore.indexes.json`
  - `frontend/src/lib/firebase.ts`, `frontend/src/lib/firestore.ts`, `frontend/src/lib/functions.ts`
  - `frontend/src/contexts/AuthContext.tsx`, `frontend/src/contexts/DashboardContext.tsx`
  - `frontend/src/components/layout/DashboardShell.tsx`, `frontend/src/components/dashboard/AgendaList.tsx`, `CalendarEventCard.tsx`
  - `frontend/src/components/access/WaitlistGate.tsx`, `frontend/src/app/dashboard/page.tsx`
  - `frontend/__tests__/calendarDetails.test.tsx` and all frontend test suites
  - `functions/src/utils/getDb.ts`, `functions/src/utils/sharedTimetable.ts`, `functions/src/utils/eventParsing.ts`, `functions/src/access/portal.ts`
  - Git history: commits `0652cfd`, `36b2d52`, `2566877`
- **Key findings**:
  1. Firestore Named Database: `firebase.json` was updated in commit `0652cfd` to define both `(default)` and `default`. Prior to this, rules were only deployed to `(default)`, causing "Missing or insufficient permissions" when frontend connected to `default`.
  2. Firestore Security Rules: `match /sharedCalendarEvents/{eventId}` enforces `allow read: if hasPlatformAccess(); allow write: if false;`. Casing discrepancy risk identified: `request.auth.token.email.lower()` should be used when querying `platformAccess`.
  3. Indexes: `firestore.indexes.json` currently lacks a composite index on `(sectionCode ASC, startIso ASC)` for `sharedCalendarEvents`.
  4. Rules Testing: `@firebase/rules-unit-testing` is not installed; no rules unit test suite exists yet.
  5. Calendar UI:
     - Section selection: Options show "All sections" followed by Section A-H.
     - Section change updates in-memory without page reload.
     - Bug: Subject selection resets section filter to 'all', violating "Subject filtering must work within the selected section."
     - Bug: LocalStorage preference retrieval overrides saved `'all'` with `access?.section`.
     - Missing feature: Cross-section subject comparison view does not exist yet.
     - Missing UI states: Loading text "Loading shared section calendars…", empty state text "No sessions are available for Section X in this period.", and retry action button on error.
  6. Test & Build Commands:
     - Frontend tests: `npm test` in `frontend` passes (12 suites, 57 tests).
     - Functions tests: `npm test` in `functions` passes (14 suites, 204 tests).
     - Frontend build: `npm run build` in `frontend` succeeds (Next.js Turbopack).
     - Functions build: `npm run build` in `functions` succeeds (`tsc`).
- **Unexplored areas**: Live Firebase deployment execution (read-only constraint).

## Key Decisions Made
- Document complete evidence chains for security rules, indexes, and all 6 Calendar UI requirements.
- Detail the exact before/after diffs and specifications for the implementer agent.

## Artifact Index
- d:\Projects\MU-One\.agents\explorer_survey_3\DISPATCH.md — Task instructions and dispatch
- d:\Projects\MU-One\.agents\explorer_survey_3\BRIEFING.md — Persistent situational awareness
- d:\Projects\MU-One\.agents\explorer_survey_3\progress.md — Heartbeat and execution progress
- d:\Projects\MU-One\.agents\explorer_survey_3\handoff.md — Final investigation report
