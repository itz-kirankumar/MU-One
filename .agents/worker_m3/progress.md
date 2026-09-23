# Progress - Milestone 3 Worker

Last visited: 2026-09-21T18:22:45Z

## Status
- Hardened `firestore.rules`:
  - Updated `isMuUser()` with `.lower()` for domain check.
  - Updated `hasPlatformAccess()` with `.lower()` for email document lookup in `/platformAccess/$(request.auth.token.email.lower())` and admin email comparison.
  - Confirmed `/sharedCalendarEvents/{eventId}` read restricted to `hasPlatformAccess()`, writes completely denied (`allow write: if false;`).
  - Confirmed `/platformAccess` and `/platformWaitlist` completely deny client read/write (`allow read, write: if false;`).
  - Confirmed waitlisted users lacking platform access cannot access `/users/{uid}/*` or `/sharedCalendarEvents`.
- Updated `firestore.indexes.json`:
  - Added composite index for `sharedCalendarEvents` on `sectionCode` ASC, `startIso` ASC with queryScope `COLLECTION`.
- Verified `firebase.json`:
  - Configures both `(default)` and `default` database targets pointing to `firestore.rules` and `firestore.indexes.json`.
- Implemented dedicated Firestore Security Rules test suite in `functions/src/__tests__/firestoreRules.test.ts`:
  - 35 unit tests covering configuration contracts, AST invariants, admitted user access, waitlisted user isolation, email case normalization, and adversarial boundary checks.
  - Test suite passes cleanly (35/35 passing).
- Running full backend test suite (`npm test` in `functions`) to confirm zero regressions.

## Next Steps
1. Verify completion of full `npm test` run.
2. Update `BRIEFING.md`.
3. Generate comprehensive `handoff.md`.
4. Send notification message to orchestrator.
