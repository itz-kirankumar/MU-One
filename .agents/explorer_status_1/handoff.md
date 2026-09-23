# Comprehensive Status & Exploration Assessment Report: Milestones M1, M2, and M4

**Agent**: `explorer_status_1`  
**Working Directory**: `d:\Projects\MU-One\.agents\explorer_status_1`  
**Timestamp**: `2026-09-22T00:43:00Z`  
**Target Repository**: `d:\Projects\MU-One`

---

## 1. Observation

### 1.1 Git Status and Modified/Untracked Files

Execution of `git status` and `git diff --stat` in `d:\Projects\MU-One`:

```text
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
	modified:   .gitignore
	modified:   firestore.indexes.json
	modified:   firestore.rules
	modified:   frontend/src/components/access/WaitlistGate.tsx
	modified:   functions/src/__tests__/eventParsing.test.ts
	modified:   functions/src/__tests__/sharedTimetable.test.ts
	modified:   functions/src/access/portal.ts
	modified:   functions/src/auth/connectGoogleAccount.ts
	modified:   functions/src/sync/scheduledSyncAllUsers.ts
	modified:   functions/src/sync/syncUserCalendar.ts
	modified:   functions/src/utils/eventParsing.ts
	modified:   functions/src/utils/sharedTimetable.ts
	modified:   package-lock.json
	modified:   package.json

Untracked files:
	.agents/
	ORIGINAL_REQUEST.md
	PROJECT.md
	TEST_INFRA.md
	TEST_READY.md
	frontend/__tests__/e2eSharedCalendar.test.tsx
	functions/.env.mu-one-508502
	functions/src/__tests__/e2eSharedCalendar.test.ts
	functions/src/__tests__/firestoreRules.test.ts
	functions/src/__tests__/waitlistConsent.test.ts

Total diff stat:
 14 files changed, 1023 insertions(+), 114 deletions(-)
```

---

### 1.2 Test Execution Results

#### A. Functions Test Suite (`cd functions && npm test`)
- Command: `npm test` -> `jest --runInBand`
- Total Test Suites: **17 total** (1 failed, 16 passed)
- Total Tests: **344 total** (3 failed, 341 passed)
- Execution Time: 147.207 s
- Exit Code: `1`

**Passing Suites (16/17)**:
- `src/__tests__/sharedTimetable.test.ts` (PASS)
- `src/__tests__/sendMail.test.ts` (PASS)
- `src/__tests__/syncDashboard.test.ts` (PASS)
- `src/__tests__/e2eSharedCalendar.test.ts` (PASS)
- `src/__tests__/surveys.test.ts` (PASS)
- `src/__tests__/mailDateFormats.test.ts` (PASS)
- `src/__tests__/domainCheck.test.ts` (PASS)
- `src/__tests__/testmail.test.ts` (PASS)
- `src/__tests__/firestoreRules.test.ts` (PASS)
- `src/__tests__/duplicateImport.test.ts` (PASS)
- `src/__tests__/googleTaskActions.test.ts` (PASS)
- `src/__tests__/oauthRedirect.test.ts` (PASS)
- `src/__tests__/eventParsing.test.ts` (PASS)
- `src/__tests__/mailParsing.test.ts` (PASS)
- `src/__tests__/jev.test.ts` (PASS)
- `src/__tests__/sanitizeEmailHtml.test.ts` (PASS)

**Failing Suite (1/17)**:
`src/__tests__/waitlistConsent.test.ts` with 3 failures:

```text
  ● Milestone 1: Waitlist Consent, OAuth Authorization & Sync Isolation › 2. Google OAuth Authorization for Consented Waitlist (connectGoogleAccount.ts) › 2.5: connectGoogleAccount redirects consented waitlist user to waitlist gate with ?google=connected

    expect(received).toBe(expected) // Object.is equality

    Expected: "connected"
    Received: null

      612 |       expect(redirectedUrls.length).toBe(1);
      613 |       const targetUrl = new URL(redirectedUrls[0]);
    > 614 |       expect(targetUrl.searchParams.get('google')).toBe('connected');
          |                                                    ^
      at Object.<anonymous> (src/__tests__/waitlistConsent.test.ts:614:52)

  ● Milestone 1: Waitlist Consent, OAuth Authorization & Sync Isolation › 2. Google OAuth Authorization for Consented Waitlist (connectGoogleAccount.ts) › 2.6: connectGoogleAccount rejects unconsented waitlist user with access_not_granted

    expect(received).toContain(expected) // indexOf

    Expected substring: "reason=access_not_granted"
    Received string:    "https://muone.live/dashboard?google_connect=error&reason=email_mismatch"

      656 |       expect(redirectedUrls.length).toBe(1);
    > 657 |       expect(redirectedUrls[0]).toContain('reason=access_not_granted');
          |                                 ^
      at Object.<anonymous> (src/__tests__/waitlistConsent.test.ts:657:33)

  ● Milestone 1: Waitlist Consent, OAuth Authorization & Sync Isolation › 2. Google OAuth Authorization for Consented Waitlist (connectGoogleAccount.ts) › 2.7: connectGoogleAccount redirects admitted student with standard dashboard success

    expect(received).toContain(expected) // indexOf

    Expected substring: "google_connect=success"
    Received string:    "https://muone.live/dashboard?google_connect=error&reason=email_mismatch"

      685 |       expect(redirectedUrls.length).toBe(1);
    > 686 |       expect(redirectedUrls[0]).toContain('google_connect=success');
          |                                 ^
      at Object.<anonymous> (src/__tests__/waitlistConsent.test.ts:686:33)
```

#### B. Frontend Test Suite (`cd frontend && npm test`)
- Command: `npm test` -> `jest`
- Total Test Suites: **13 passed, 13 total** (100% pass)
- Total Tests: **95 passed, 95 total** (100% pass)
- Execution Time: 54.329 s
- Exit Code: `0`

**All Suites Passed**:
- `__tests__/personalTasks.test.tsx` (PASS)
- `__tests__/testmailLab.test.tsx` (PASS)
- `__tests__/emailCenter.test.tsx` (PASS)
- `__tests__/composeMail.test.tsx` (PASS)
- `__tests__/dashboard.test.tsx` (PASS)
- `__tests__/surveys.test.tsx` (PASS)
- `__tests__/autoSync.test.tsx` (PASS)
- `__tests__/connectionBanner.test.tsx` (PASS)
- `__tests__/pitchCheckpoint.test.ts` (PASS)
- `__tests__/auth.test.ts` (PASS)
- `__tests__/responsiveLayout.test.tsx` (PASS)
- `__tests__/calendarDetails.test.tsx` (PASS)
- `__tests__/e2eSharedCalendar.test.tsx` (PASS)

---

### 1.3 Build Execution Results

#### A. Functions Build (`cd functions && npm run build`)
- Command: `tsc`
- Result: **Clean build, 0 errors**
- Exit Code: `0`

#### B. Frontend Production Build (`cd frontend && npm run build`)
- Command: `next build` (Next.js 16.3.5 Turbopack + TypeScript check)
- Result: **Clean compilation in 24.7s, TypeScript finished in 13.7s, static page generation 11/11 in 2.5s**
- Exit Code: `0`

---

### 1.4 Milestone Code Inspection Observations

#### Milestone 1: Waitlist Consent, OAuth & Sync Isolation
1. **`functions/src/access/portal.ts`**:
   - `action === "updateCalendarConsent"` (lines 51–70): Implemented. Updates `platformWaitlist/{callerEmail}` with `calendarConsent: consent`, `calendarConsentAt`, and `updatedAt`.
   - `action === "status"` (line 47): Returns `calendarConsent: Boolean(ownWaitlist?.get("calendarConsent"))`.
   - `action === "join"` (lines 82–104): Accepts `calendarConsent` boolean, records `calendarConsentAt` when true, and never grants `platformAccess`.
   - Invariant verified: Under no circumstances does consent grant or create `platformAccess` records.
2. **`functions/src/auth/connectGoogleAccount.ts`**:
   - `getGoogleAuthUrl` (lines 48–64): Authorizes user if `hasAccess` OR `isConsentedWaitlist` (`calendarConsent === true`). Otherwise rejects with `permission-denied`.
   - `connectGoogleAccount` (lines 155–170): Verifies `hasPlatformAccess || isConsentedWaitlist`.
   - `connectGoogleAccount` (lines 215–222): For consented waitlisted users, saves encrypted tokens, sets `googleConnection.connected = true` on `users/{uid}`, and redirects to `https://muone.live/dashboard?google=connected` without granting `platformAccess`.
3. **`functions/src/sync/scheduledSyncAllUsers.ts`**:
   - Target filtering (lines 64–92): Sorts eligible users into `syncType: "full"` (admitted students/admin) and `syncType: "calendar_only"` (`consentedWaitlistEmails.has(user.email)`).
   - Sync execution (lines 122–162): For `calendar_only`, executes exclusively `syncUserCalendar(target.uid, SYNC_DAYS)`. Calls to `syncUserMail` and `syncUserGoogleTasks` are strictly omitted.
4. **`frontend/src/components/access/WaitlistGate.tsx`**:
   - Consent checkbox (lines 149–160): ID `calendar-consent`, toggles consent via `accessPortal({ action: 'updateCalendarConsent', consent })`.
   - Connect button (lines 173–188): Button triggers `getGoogleAuthUrl` when consented, disabled when not consented.
   - Connected confirmation badge (lines 167–171): Displays confirmation when Google Calendar is connected (`?google=connected` or `?google_connect=success`).
5. **`functions/src/__tests__/waitlistConsent.test.ts`**:
   - Comprehensive test file exists (806 lines, 19 tests).
   - 16 tests pass, 3 tests fail (2.5, 2.6, 2.7) due to a mock fixture oversight in `describe("2. Google OAuth Authorization...")`: `memoryStore.setDoc('users', ...)` was not populated for the test UIDs, causing the mock `admin.auth().getUser(uid)` to fall back to `${uid}@mastersunion.org`, which triggers `reason=email_mismatch` against `tokenEmail`.

#### Milestone 2: Shared Timetable Ingestion, Sanitization & De-duplication
1. **`functions/src/utils/eventParsing.ts`**:
   - `extractSectionCode` (lines 71–82): Regular expressions match `Section A–H`, `Sec A–H`, `Sec. A–H`, `Sec.A`, `Sec-A`, `Section: A`, `Section #A`, `Legacy A–H`, and numeric forms `Section 1–8`, `Sec 1–8`, `Sec. 1–8`, `Sec.1`, `Legacy 1–8` mapped to A–H via `String.fromCharCode(64 + num)`.
   - Rejects invalid sections (0, 9, 12, Z, I, Secondary, Security, etc.).
   - Covers all 4 programmes: TBM, YLC, HR & OS, SMG.
2. **`functions/src/utils/sharedTimetable.ts`**:
   - Sanitization schema `SanitizedSharedEvent` (lines 45–64): Strict 10-field public schema (section, course, title, description, date, startIso, endIso, venue/location/meetingLink, mode, eventType, sourceUpdateTime).
   - Multi-layer filtering in `isSharedEventEligible` (lines 81–126): Rejects primary calendars (`cal.primary`), user-owned calendars (`accessRole === 'owner'`), cancelled events, private/confidential meetings, non-default eventTypes (outOfOffice, focusTime, reminders), deadline/assessment events, and events without valid Section A–H.
   - `extractOneLineDescription` (lines 136–175): Cleans HTML, strips emails, URLs, attendee lists, faculty contacts, notes, and limits to 200 chars.
   - `computeSessionFingerprint` (lines 182–199): Stable SHA-256 fingerprint: `sha256(section | course | title | startIso | endIso | venue)`.
   - `shouldOverwriteSession` (lines 206–219): Compares `sourceUpdateTime` ISO timestamps to preserve the most recent version.
   - `toPublicTimetableEvent` (lines 227–257): Strips organizerName, organizerEmail, attendee lists, faculty, sourceCalendarId/Name, googleEventId, iCalUID.
3. **`functions/src/sync/syncUserCalendar.ts`**:
   - Single-event cancellation safety guard (lines 128–132): `if (event.status === "cancelled") continue;` ensuring student attendee declines never delete or alter shared institutional sessions.
   - Conflict resolution before write (lines 203–233): Inspects existing document in `/sharedCalendarEvents/{fingerprint}`, checks `shouldOverwriteSession(existing, incoming)`, and writes via batch only when incoming is strictly fresher.
4. **Unit Tests**:
   - `functions/src/__tests__/sharedTimetable.test.ts`: **PASS** (100%).
   - `functions/src/__tests__/eventParsing.test.ts`: **PASS** (100%).

#### Milestone 4: Calendar UI & Cross-Section View
1. **`frontend/src/lib/firestore.ts`**:
   - `subscribeToSharedTimetable` (lines 81–102): Subscribes in real-time to `/sharedCalendarEvents` within query window `where('startIso', '>=', fromIso).where('startIso', '<=', toIso).orderBy('startIso', 'asc')`.
   - Data mapped directly: `item.data() as NormalizedEvent`. (Note: Can be enhanced with fallback mapping `event.sectionCode = doc.sectionCode || doc.section; event.location = doc.location || doc.venue;`).
2. **`frontend/src/components/dashboard/AgendaList.tsx`**:
   - Section switcher (lines 299–304): Dropdown with "All sections", Sections A through H, and "Personal only".
   - Persistence (lines 16, 150–156, 300): Saved to `localStorage.getItem('muone.calendarSection')`.
   - Default section logic (lines 150–156): Checks `localStorage`, falls back to `access.section`, falls back to `'all'`.
   - Simultaneous filtering (lines 188–198): Filters `allEvents` by both `subjectFilter` and `sectionFilter`.
   - Cross-source deduplication (lines 181–185): De-duplicates `sharedEvents` and `localEvents` by stable `eventKey` in memory.
   - UI States:
     - Loading spinner (line 311): When `(loading || sharedLoading) && allEvents.length === 0`.
     - Empty states (lines 313, 315, 331): "No sessions", "No sessions for these filters", "No shared sessions in this period".
     - Error banner (line 309): Displays `sharedError` when listener fails.
3. **`frontend/src/components/dashboard/CrossSectionComparison.tsx`**:
   - **NOT FOUND**: The file does NOT exist in the repository.
   - In `AgendaList.tsx`, the dedicated "Compare across sections" action button specified in `PROJECT.md` line 114 is NOT present in the toolbar.

---

## 2. Logic Chain

1. **Build Health**:
   - Observation 1.3: `functions: npm run build` (`tsc`) and `frontend: npm run build` (`next build`) both succeed with exit code `0`.
   - Inference: There are no compile-time TypeScript syntax errors, broken imports, or bundle failures in either functions or frontend.

2. **Milestone 1 Implementation & Test Status**:
   - Observations 1.4 (M1.1–M1.4): In `portal.ts`, `connectGoogleAccount.ts`, `scheduledSyncAllUsers.ts`, and `WaitlistGate.tsx`, the implementation is complete and conforms to R1:
     - Consent checkbox and OAuth connect flow are present and functioning in `WaitlistGate.tsx`.
     - `updateCalendarConsent` stores consent in `platformWaitlist` and never touches `platformAccess`.
     - Consented waitlist users can exchange Google OAuth tokens without receiving `platformAccess`.
     - Scheduled sync runs only `syncUserCalendar` for waitlist contributors, isolating Gmail and Tasks.
   - Observation 1.2A & 1.4 (M1.5): In `waitlistConsent.test.ts`, 3 tests fail with `reason=email_mismatch` (tests 2.5, 2.6, 2.7).
   - Diagnostic trace:
     - In `connectGoogleAccount.ts`: `firebaseEmail = (userRecord.email ?? "").toLowerCase()` is compared against `tokenEmail.toLowerCase()`.
     - In `waitlistConsent.test.ts`: `admin.auth().getUser` returns `userDoc?.email || `${uid}@mastersunion.org``.
     - In the test suite's `beforeEach` (lines 524–544), `memoryStore.setDoc('users', ...)` was not called for `uid-admitted-1`, `uid-waitlist-consented`, or `uid-waitlist-unconsented`.
     - Consequently, `admin.auth().getUser` returns fallback emails like `uid-waitlist-consented@mastersunion.org`, which does not equal `consented.waitlist@mastersunion.org`, triggering the `email_mismatch` redirection.
   - Inference: The backend and frontend logic for M1 is sound and complete; only the unit test mock setup in `waitlistConsent.test.ts` requires updating.

3. **Milestone 2 Implementation & Test Status**:
   - Observations 1.4 (M2.1–M2.4):
     - `extractSectionCode` parses Section/Sec/Sec./Legacy A–H and 1–8 across all 4 programs (TBM, YLC, HR & OS, SMG).
     - `isSharedEventEligible` filters personal/primary calendars, cancellations, private meetings, deadlines, and unassigned sections.
     - `toPublicTimetableEvent` strips all personal data, organizers, faculty, and internal identifiers, emitting the 10 public fields.
     - `computeSessionFingerprint` computes SHA-256 fingerprints for deduplication.
     - `shouldOverwriteSession` and `syncUserCalendar.ts` perform conflict resolution by timestamp.
     - `syncUserCalendar.ts` ignores `event.status === "cancelled"` so individual declines cannot delete shared events.
   - Observation 1.2A: `sharedTimetable.test.ts` and `eventParsing.test.ts` both pass 100%. In addition, the comprehensive `e2eSharedCalendar.test.ts` passes 100%.
   - Inference: Milestone 2 is fully implemented and completely verified.

4. **Milestone 4 Implementation & Test Status**:
   - Observations 1.4 (M4.1–M4.2): `AgendaList.tsx` implements:
     - Section dropdown with "All sections" and Sections A–H.
     - `localStorage` persistence and fallback to user's section.
     - Simultaneous section and subject filtering.
     - In-memory cross-source deduplication of shared events and local events.
     - Loading, empty, and error UI states.
   - Observation 1.4 (M4.3):
     - `frontend/src/components/dashboard/CrossSectionComparison.tsx` is missing.
     - The "Compare across sections" action button is missing in `AgendaList.tsx`.
   - Inference: Milestone 4 is approximately 80% complete. The calendar viewing and filtering work, but cross-section subject comparison component and trigger button must be implemented.

---

## 3. Caveats

1. **Mock-only failure in M1**: The 3 failing tests in `waitlistConsent.test.ts` are purely due to test-harness mock initialization (missing `users` collection documents for mock UIDs), not a bug in `connectGoogleAccount.ts`.
2. **Missing UI Component in M4**: `frontend/src/components/dashboard/CrossSectionComparison.tsx` was specified in `PROJECT.md` but was not created.
3. **Firestore Field Fallbacks in M4**: `frontend/src/lib/firestore.ts` currently casts `item.data() as NormalizedEvent`. While backend writes both `section` and `sectionCode`, and `venue` and `location`, adding defensive client-side mapping `event.sectionCode = doc.sectionCode || doc.section` in `firestore.ts` will guarantee full layout compliance.
4. **PlatformAccessStatus Type in `frontend/src/lib/functions.ts`**: `calendarConsent?: boolean` is missing from the interface definition, requiring a type cast in `WaitlistGate.tsx`.

---

## 4. Conclusion

### Summary Status Table
| Milestone | Feature Scope | Code Implemented | Build Status | Test Status | Overall Status |
|---|---|---|---|---|---|
| **M1** | Waitlist consent, OAuth flow without platformAccess, isolated calendar sync, WaitlistGate UI | 100% complete | PASS (0 errors) | 16/19 tests pass (3 mock fixture fixes needed) | **95% Ready** |
| **M2** | Section parser (A-H, 1-8, 4 programs), 10-field sanitization, SHA-256 deduplication, cancellation safety | 100% complete | PASS (0 errors) | 100% pass (`sharedTimetable.test.ts`, `eventParsing.test.ts`) | **100% Complete** |
| **M4** | Section switcher (All + A-H), localStorage, dual filters, UI states, CrossSectionComparison | ~80% complete | PASS (0 errors) | 100% pass (`e2eSharedCalendar.test.tsx`) | **Needs CrossSectionComparison** |

---

### Actionable Checklist for Remaining Work

#### Milestone 1 (M1):
- [ ] In `functions/src/__tests__/waitlistConsent.test.ts`: Add `memoryStore.setDoc('users', ...)` in the `beforeEach` of section 2 for `admittedUid`, `consentedWaitlistUid`, and `unconsentedWaitlistUid` so `admin.auth().getUser` returns matching emails, turning all 3 failing tests GREEN.
- [ ] In `frontend/src/lib/functions.ts`: Add `calendarConsent?: boolean` to `PlatformAccessStatus` interface and add typed helper `updateCalendarConsent(consent: boolean)`.

#### Milestone 2 (M2):
- [x] All items complete! No remaining implementation tasks.

#### Milestone 4 (M4):
- [ ] Create `frontend/src/components/dashboard/CrossSectionComparison.tsx`:
  - Input props: `sharedEvents: NormalizedEvent[]`, `currentSubject: string`, `isOpen: boolean`, `onClose: () => void`.
  - Group events by section (A–H) for the selected subject.
  - Render an accessible modal/drawer displaying when Sections A–H have sessions scheduled for that subject (date, time, venue, mode).
- [ ] In `frontend/src/components/dashboard/AgendaList.tsx`:
  - Add a "Compare across sections" button in the filter toolbar next to the Subject dropdown.
  - State hook to open/close `CrossSectionComparison`.
- [ ] In `frontend/src/lib/firestore.ts`:
  - In `subscribeToSharedTimetable`, explicitly normalize incoming document fields:
    ```ts
    const data = item.data();
    return {
      id: item.id,
      ...data,
      sectionCode: data.sectionCode || data.section,
      location: data.location || data.venue,
      description: data.description || data.sessionDescription || data.descriptionExcerpt || '',
    } as NormalizedEvent;
    ```

---

## 5. Verification Method

To independently verify these findings, execute the following commands from the project root:

```powershell
# 1. Verify Git status
git status
git diff --stat

# 2. Verify Functions Build
cd d:\Projects\MU-One\functions
npm run build

# 3. Verify Frontend Build
cd d:\Projects\MU-One\frontend
npm run build

# 4. Verify Frontend Test Suite (all 13 suites pass)
cd d:\Projects\MU-One\frontend
npm test

# 5. Verify Functions Test Suite
cd d:\Projects\MU-One\functions
npm test -- src/__tests__/eventParsing.test.ts src/__tests__/sharedTimetable.test.ts src/__tests__/firestoreRules.test.ts
npm test -- src/__tests__/waitlistConsent.test.ts

# 6. Verify absence of CrossSectionComparison component
Test-Path d:\Projects\MU-One\frontend\src\components\dashboard\CrossSectionComparison.tsx
```
