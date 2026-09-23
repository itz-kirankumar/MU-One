# Milestone 1 Worker Dispatch

## 2026-09-21T18:16:30Z
- **Role**: Milestone 1 Worker (Waitlist Consent, Sync Isolation & UI Gate)
- **Working Directory**: d:\Projects\MU-One\.agents\worker_m1
- **Project Root**: d:\Projects\MU-One
- **Original Request**: d:\Projects\MU-One\.agents\ORIGINAL_REQUEST.md
- **Project Spec**: d:\Projects\MU-One\PROJECT.md
- **Orchestrator Conversation ID**: b9706a30-9e99-42c4-a11e-6d85609cc08e

### Assigned File Ownership
You exclusively own and may create/modify:
- `functions/src/access/portal.ts`
- `functions/src/auth/connectGoogleAccount.ts`
- `functions/src/sync/scheduledSyncAllUsers.ts`
- `frontend/src/components/access/WaitlistGate.tsx`
- `functions/src/__tests__/waitlistConsent.test.ts`
DO NOT modify files outside your ownership boundary.

### Implementation Tasks
1. **Waitlist Consent Management (`functions/src/access/portal.ts`)**:
   - Add support for recording explicit calendar consent in `platformWaitlist/{email}` (`calendarConsent: boolean`, `calendarConsentAt: Timestamp`).
   - Allow waitlisted users to update their consent status via `accessPortal` action `"updateCalendarConsent"`.
   - Critical Invariant: Joining the waitlist does NOT equal consent (`calendarConsent` must default to false unless explicitly consented).
   - Critical Invariant: Waitlisted users must remain blocked from the platform. Under NO circumstance may `platformAccess` records be created or modified for waitlisted contributors!
2. **Google OAuth Authorization for Consented Waitlist Contributors (`functions/src/auth/connectGoogleAccount.ts`)**:
   - In `getGoogleAuthUrl` and `connectGoogleAccount`: Allow callers who are either granted platform access (`hasPlatformAccess`) OR are on `platformWaitlist` with `calendarConsent === true`.
   - If a waitlisted contributor completes Google OAuth connection, update their tokens in `users/{uid}` with `googleConnection.connected: true`, BUT redirect them back to the waitlist gate with status `?google=connected`, NEVER granting `platformAccess`.
3. **Calendar Sync Isolation in `scheduledSyncAllUsers.ts`**:
   - Include waitlisted contributors who have `calendarConsent === true` in `platformWaitlist` and `googleConnection.connected === true`.
   - ISOLATION INVARIANT: For waitlisted contributors, execute ONLY `syncUserCalendar(uid, syncDays)`. DO NOT execute `syncUserMail(uid)` or `syncUserGoogleTasks(uid)`.
4. **Waitlist Gate UI (`frontend/src/components/access/WaitlistGate.tsx`)**:
   - In the waitlisted confirmation state, provide UI controls:
     - An explicit consent checkbox ("Allow MU One to sync my academic timetable for Section A–H").
     - A "Connect Google Calendar" button (enabled when consent is checked or toggled).
     - Informative text stating: "Your calendar will be sanitized to share only section timetable events. Personal meetings and reminders are never shared, and your account remains on the waitlist."
5. **Unit Tests**:
   - Write comprehensive unit tests in `functions/src/__tests__/waitlistConsent.test.ts` verifying all invariants: consent tracking, blocking of non-consented waitlisted users, calendar-only sync isolation, and zero modifications to `platformAccess`.
6. **Verification**:
   - Run `npm test` in `functions` and verify that all test suites pass.
   - Run `npm run build` in `functions` and `frontend` to verify clean compilation.

### Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Deliverable
Write your report in `d:\Projects\MU-One\.agents\worker_m1\handoff.md` and notify the orchestrator via send_message.
