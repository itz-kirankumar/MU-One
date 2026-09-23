# Task Assignment: Milestone 5 Final Acceptance & Adversarial Reviewer

## Mission
Conduct a rigorous, independent, and adversarial review of the entire MU One shared academic calendar implementation across all 9 Acceptance Criteria from `ORIGINAL_REQUEST.md`. Verify that all backend and frontend test suites pass, production builds succeed, and all integrity invariants hold without regression.

## Working Directory
`d:\Projects\MU-One\.agents\reviewer_final`

## Inputs to Review
Read:
1. `d:\Projects\MU-One\.agents\ORIGINAL_REQUEST.md` (authoritative Acceptance Criteria AC 1–9)
2. `d:\Projects\MU-One\PROJECT.md`
3. `d:\Projects\MU-One\TEST_INFRA.md`
4. `d:\Projects\MU-One\TEST_READY.md`
5. Implementation artifacts:
   - `functions/src/access/portal.ts`
   - `functions/src/auth/connectGoogleAccount.ts`
   - `functions/src/sync/scheduledSyncAllUsers.ts`
   - `functions/src/sync/syncUserCalendar.ts`
   - `functions/src/utils/eventParsing.ts`
   - `functions/src/utils/sharedTimetable.ts`
   - `firestore.rules` & `firestore.indexes.json` & `firebase.json`
   - `frontend/src/components/access/WaitlistGate.tsx`
   - `frontend/src/components/dashboard/AgendaList.tsx`
   - `frontend/src/components/dashboard/CrossSectionComparison.tsx`
   - `frontend/src/lib/firestore.ts`
   - `frontend/src/lib/functions.ts`

## Specific Verification Requirements
Execute and document the exact outputs of:
1. Backend test suites in `functions`:
   - `npm test -- src/__tests__/firestoreRules.test.ts`
   - `npm test -- src/__tests__/waitlistConsent.test.ts`
   - `npm test -- src/__tests__/e2eSharedCalendar.test.ts`
   - `npm test -- src/__tests__/sharedTimetable.test.ts`
   - `npm test -- src/__tests__/eventParsing.test.ts`
   - Full suite: `npm test`
2. Frontend test suites in `frontend`:
   - `npm test -- __tests__/e2eSharedCalendar.test.tsx`
   - `npm test -- __tests__/crossSectionComparison.test.tsx`
   - Full suite: `npm test`
3. Production builds:
   - `npm run build` in `functions`
   - `npm run build` in `frontend`

## Verification of Acceptance Criteria (AC 1–9)
Verify each criterion with specific code citations and test evidence:
- **AC 1**: Backend tests, Firestore rules tests, frontend tests, and production builds pass.
- **AC 2**: Section A–H all display their available shared academic sessions (normalized across all 4 programs).
- **AC 3**: Changing sections updates the calendar without reloading the page (`localStorage` persistence, in-memory filtering).
- **AC 4**: Cross-section subject comparison works (`CrossSectionComparison.tsx` modal, toolbar button in `AgendaList.tsx`).
- **AC 5**: Personal calendar events never enter the shared Firebase collection (primary calendar rejection, cancellation safety, 10-field public schema).
- **AC 6**: Duplicate events do not appear (SHA-256 fingerprinting, in-memory cross-source deduplication).
- **AC 7**: Waitlisted contributors remain blocked from the platform (`hasPlatformAccess` check, Firestore rules deny).
- **AC 8**: No waitlist access records are granted or modified (`platformAccess` document is never created or updated by consent or sync).
- **AC 9**: Firestore no longer returns "Missing or insufficient permissions" (`firebase.json` multi-database targets, `.lower()` normalization, composite indexes).

## Integrity Forensics Checks
- Confirm NO hardcoded test strings or mock bypasses in production code.
- Confirm NO dummy facades.
- Confirm ALL logic is genuine.

## Deliverable
Write a comprehensive 5-component handoff report to:
`d:\Projects\MU-One\.agents\reviewer_final\handoff.md`
Provide an explicit verdict: `APPROVE` or `REQUEST_CHANGES`.
Notify parent (`74c8e862-43dc-4a8f-be88-c18ff53d953d`) via `send_message`.

## 2026-09-22T00:46:57Z
<USER_REQUEST>
You are reviewer_final, an adversarial and acceptance reviewer for Milestone 5.
Your Working Directory is: d:\Projects\MU-One\.agents\reviewer_final
Read d:\Projects\MU-One\.agents\ORIGINAL_REQUEST.md, d:\Projects\MU-One\PROJECT.md, and d:\Projects\MU-One\.agents\reviewer_final\DISPATCH.md.
Run all tests in functions and frontend, verify production builds, thoroughly audit all 9 Acceptance Criteria, and deliver a comprehensive 5-component report to d:\Projects\MU-One\.agents\reviewer_final\handoff.md with an explicit verdict (APPROVE or REQUEST_CHANGES).
Notify parent (Recipient: 74c8e862-43dc-4a8f-be88-c18ff53d953d) via send_message when complete.
</USER_REQUEST>
