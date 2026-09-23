# Plan Review & Adversarial Challenge Report

**Author**: Plan Reviewer 1 (`teamwork_preview_reviewer`)  
**Date**: 2026-09-21T18:15:00Z  
**Target Milestone**: Milestone 0 — Plan Review & Adversarial Challenge  
**Working Directory**: `d:\Projects\MU-One\.agents\reviewer_plan_1`  
**Reference Documents**:
- `d:\Projects\MU-One\.agents\ORIGINAL_REQUEST.md`
- `d:\Projects\MU-One\PROJECT.md`
- `d:\Projects\MU-One\TEST_INFRA.md`
- Survey Reports: `explorer_survey_1/handoff.md`, `explorer_survey_2/handoff.md`, `explorer_survey_3/handoff.md`

---

## Review Summary

**Verdict**: **REQUEST_CHANGES**  
**Adversarial Risk Assessment**: **HIGH**

While `PROJECT.md` establishes a strong foundation and correctly identifies the major architectural goals (waitlist separation, 10-field sanitization, regex normalization, and composite indexing), rigorous adversarial analysis identified three critical vulnerabilities and two major specification gaps that must be resolved before implementation begins. Most notably, `AgendaList.tsx` contains a frontend deduplication loophole that displays duplicate sessions for admitted students, `syncUserCalendar.ts` contains an unsafe deletion mechanism that allows individual cancellations to wipe shared sessions for entire sections, and `WaitlistGate.tsx` was entirely omitted from the project plan's UI scope despite being the sole gateway for waitlisted consent.

---

## Findings

### [Critical] Finding 1: Frontend Duplicate Session Loophole in `AgendaList.tsx`
- **What**: Merging `sharedEvents` and `localEvents` in `AgendaList.tsx` produces duplicate calendar sessions for admitted students.
- **Where**: `frontend/src/components/dashboard/AgendaList.tsx:31–33, 181–185`
- **Why**:
  In `AgendaList.tsx`:
  ```typescript
  function eventKey(event: NormalizedEvent, index = 0): string {
    return event.googleEventId || event.iCalUID || event.id || `${event.startIso}-${index}`;
  }
  ```
  `allEvents` merges `[...sharedEvents, ...localEvents]` using `unique.set(eventKey(event, index), event)`.
  For shared events from Firestore, `event.id` is the SHA-256 fingerprint hash (e.g. `"f4a9b2..."`), while `googleEventId` and `iCalUID` are stripped.
  For personal events from `dashboardData`, `eventKey` returns `event.googleEventId` or `event.iCalUID` (e.g. `"_60o30c1g60o30c1g..."`).
  Because the deduplication keys are generated using fundamentally incompatible schemes, any session present on an admitted student's personal calendar that also exists in `sharedCalendarEvents` receives two distinct entries in the map. The student sees duplicate cards on their agenda, directly violating Acceptance Criteria: *"Duplicate events do not appear."*
- **Suggestion**: In `PROJECT.md` M4 (F8/AgendaList), specify that `AgendaList.tsx` must deduplicate academic sessions across `sharedEvents` and `localEvents` using content-based matching (matching course, section, and start/end time), giving precedence to the sanitized shared event and suppressing duplicate local copies when section filters are active.

### [Critical] Finding 2: Unsafe Session Deletion / Cancellation in `syncUserCalendar.ts`
- **What**: An individual student cancelling or declining an event can delete the shared institutional session for their entire section.
- **Where**: `functions/src/sync/syncUserCalendar.ts:120–123, 175–182`
- **Why**:
  `syncUserCalendar.ts` executes:
  ```typescript
  if (event.status === "cancelled") {
    if (isSharedCalendar(cal) && publicId) removedSharedEventIds.add(publicId);
    continue;
  }
  ...
  const sharedDeletes = [...removedSharedEventIds].filter(id => !sharedEvents.has(id));
  for (const id of sharedDeletes.slice(i, i + BATCH_SIZE)) {
    batch.delete(db.collection("sharedCalendarEvents").doc(id));
  }
  ```
  Under content fingerprinting, Google Calendar cancelled event payloads frequently omit `summary`, `start`, and `end`, making `computeSessionFingerprint` impossible to compute. More critically, if a student declines a class or deletes it from their local calendar view, Google marks `event.status = "cancelled"` for that user. If the sync worker blindly executes `batch.delete()` on the shared Firestore document, it deletes the timetable record for all 100+ students in that section. Furthermore, if another student syncs two minutes later, their calendar will re-create the session, creating a catastrophic oscillation/flicker.
- **Suggestion**: Update `PROJECT.md` M2 to explicitly define cancellation handling: Do NOT perform unverified deletions from `sharedCalendarEvents` based on single-user cancellations. Instead, maintain tombstone/status records or only mark an event cancelled if the incoming update is from an institutional calendar owner with a strictly newer `sourceUpdateTime`.

### [Critical] Finding 3: Missing Waitlist Consent UI Scope in `WaitlistGate.tsx`
- **What**: `WaitlistGate.tsx` and its client functions are omitted from the Code Layout, Milestone 1, and Feature Inventory.
- **Where**: `PROJECT.md` Section 4 (Milestones), Section 7 (Code Layout), and `frontend/src/components/access/WaitlistGate.tsx:78–86`
- **Why**:
  In `frontend/src/components/access/WaitlistGate.tsx`, once a student joins the waitlist, the UI shows only `"You're on the waitlist"` and provides zero interface controls to toggle consent or connect Google Calendar.
  `PROJECT.md` defines backend consent endpoints (F1, M1), but omits the frontend implementation needed for a waitlisted student to actually view the consent terms, check the consent box, and trigger `getGoogleAuthUrl`. Without `WaitlistGate.tsx` in M1, real users cannot consent, and E2E Scenario 1 cannot be executed through the user interface.
- **Suggestion**: Add `frontend/src/components/access/WaitlistGate.tsx` and `frontend/src/lib/functions.ts` to M1 and Code Layout in `PROJECT.md`. Add a consent checkbox ("Allow MU One to sync my academic timetable for Section A–H") and a "Connect Google Calendar" button on the waitlist gate.

### [Major] Finding 4: Interface Contract Schema & Frontend Property Incompatibility
- **What**: The proposed 10-field Firestore document schema omits properties expected by frontend components, breaking section filtering and venue rendering.
- **Where**: `PROJECT.md` Section 6 (Interface Contract 2), `frontend/src/components/dashboard/AgendaList.tsx:84–93`, and `frontend/src/lib/calendarEventDetails.ts:84–87`
- **Why**:
  In `AgendaList.tsx`, `eventSection` reads `event.sectionCode`, `event.sectionLabel`, and `event.sectionNumber`:
  ```typescript
  function eventSection(event: NormalizedEvent): string | null {
    const direct = String(event.sectionCode || '').trim().toUpperCase();
    if (/^[A-H]$/.test(direct)) return direct;
    ...
  }
  ```
  It never reads `event.section`! If Firestore stores only `section: 'A'` and `frontend/src/lib/firestore.ts` passes the raw document data, `eventSection` returns `null`, causing Section A–H filtering to filter out 100% of shared events!
  Similarly, `getCalendarEventDetails` reads `event.location`, whereas the proposed schema provides `venue`. Because the sanitized `description` has stripped metadata lines, fallback parsing also fails, causing the UI to display `"Not provided"`.
- **Suggestion**: Update Interface Contract 2 in `PROJECT.md` to specify the exact client mapping in `frontend/src/lib/firestore.ts`: ensure `sectionCode` is populated from `section` (or store both `section` and `sectionCode`) and `location` is populated from `venue` (or store both `venue` and `location`).

### [Major] Finding 5: Missing Firestore Security Rules Test Suite
- **What**: No test suite exists to verify Firestore security rules, despite being an explicit Acceptance Criterion.
- **Where**: `ORIGINAL_REQUEST.md:36`, `PROJECT.md:60`, and `TEST_INFRA.md:28`
- **Why**:
  `ORIGINAL_REQUEST.md` Acceptance Criteria explicitly requires:
  > *"- [ ] Backend tests, Firestore rules tests, frontend tests, and production builds pass."*
  Survey Explorer 3 verified that `@firebase/rules-unit-testing` is not installed, and no rules test file exists in the repo.
  `PROJECT.md` M3 and `TEST_INFRA.md` mention rules configuration, but do not specify how rules tests will be executed or where the test suite lives. Without a dedicated Jest test suite (e.g. `functions/src/__tests__/firestoreRules.test.ts` or similar emulator-based test), this acceptance criterion cannot be satisfied or verified.
- **Suggestion**: Explicitly add a Firestore security rules test suite to Milestone 3 and Milestone 5 in `PROJECT.md` to verify `hasPlatformAccess()`, waitlist collection deny-all, client write denials on `sharedCalendarEvents`, and email case-insensitivity.

### [Minor] Finding 6: Cross-Section Comparison Trigger Underspecified
- **What**: The UI trigger and location for the Cross-Section Subject Comparison component are not specified.
- **Where**: `PROJECT.md` Section 6 (Interface Contract 3), `frontend/src/components/dashboard/AgendaList.tsx`
- **Why**:
  While the data contract for `CrossSectionComparison` is specified, the plan does not define how the user opens it in `AgendaList.tsx`. If it is not clearly designated (e.g. as a button in the calendar toolbar next to the subject filter, or a tab in the event details card), implementation could hide it behind an unintuitive interaction that fails user testing.
- **Suggestion**: Specify in M4 that a "Compare across sections" action button is added to `AgendaList.tsx` adjacent to the subject filter dropdown, which opens `CrossSectionComparison` as a modal or slide-over drawer populated with the currently selected subject.

---

## Adversarial Challenge Report

### Challenge Summary
**Overall Risk Level**: **HIGH**

The proposed plan makes implicit assumptions regarding Google Calendar behavior, user identity casing, client state synchronization, and background sync isolation. Under hostile or corner-case inputs, these assumptions collapse, leading to schedule deletions, UI duplicate clutter, or broken section filtering.

### Challenges

#### Challenge 1: Individual Student Declines Event -> Deletes Section Timetable
- **Assumption Challenged**: Google Calendar cancellations are authoritative indicators that a shared lecture has been cancelled.
- **Attack Scenario**: A student in Section A has an interview conflict and declines the "Microeconomics Session 4" invitation on their calendar. Google Calendar marks `event.status = 'cancelled'` for that student. During the next 5-minute background sync, the student's calendar sync runs and deletes `sharedCalendarEvents/{fingerprint}`.
- **Blast Radius**: 100+ admitted students in Section A abruptly lose their lecture from the calendar.
- **Mitigation**: Do not delete shared timetable events from individual student sync runs. Treat shared timetable documents as append/fresher-update only, or require verification against an institutional organizer/calendar.

#### Challenge 2: Admitted Student Calendar Duplication
- **Assumption Challenged**: In-memory deduplication in `AgendaList.tsx` automatically prevents duplicates.
- **Attack Scenario**: An admitted student connects their Google Calendar. They are enrolled in Section B. Both their personal Google Calendar sync and the shared timetable sync have "Marketing Management Session 1" at 09:00 AM. In `AgendaList.tsx`, personal events use `googleEventId` as the key, while shared events use `fingerprint`.
- **Blast Radius**: Every lecture appears twice on the student's dashboard timeline.
- **Mitigation**: Implement cross-source content deduplication in `AgendaList.tsx` so that shared events supersede local copies for the same course and time slot.

#### Challenge 3: Inadvertent Background Ingestion of Waitlist Emails & Tasks
- **Assumption Challenged**: `scheduledSyncAllUsers` will only sync calendars for waitlist users without code-level enforcement.
- **Attack Scenario**: A developer implements waitlist user inclusion in `scheduledSyncAllUsers` by adding waitlist UIDs to the `uids` array. Line 102–106 unconditionally executes `syncUserMail(uid)` and `syncUserGoogleTasks(uid)`.
- **Blast Radius**: Massive breach of consent and privacy; waitlisted users' personal emails and tasks are ingested into the database without consent.
- **Mitigation**: `scheduledSyncAllUsers` must explicitly branch on `isWaitlistContributor`: only `syncUserCalendar(uid, SYNC_DAYS)` may be executed; `syncUserMail` and `syncUserGoogleTasks` must be strictly skipped.

#### Challenge 4: Fingerprint Key Collisions on Minor Venue Differences
- **Assumption Challenged**: Venue strings in Google Calendar are identical across all student subscriptions.
- **Attack Scenario**: Student 1 has `"Room C-204"`. Student 2 has `""` or `"Room C204"`. If venue is included in the SHA-256 document ID, two separate documents are created for the same section session at the same time slot.
- **Blast Radius**: Duplicate sessions appear in the calendar.
- **Mitigation**: Robustly normalize venue strings (strip non-alphanumeric, remove words like "room", "classroom"), or use `section|course|title|startUtc|endUtc` as the primary deduplication key and treat venue as an updatable attribute.

---

## 1. Observation

1. **Current Codebase Verification**:
   - Backend test runner: `npm test` in `d:\Projects\MU-One\functions` executed 14 test suites, 204 tests — **ALL PASSED** in 25.0s.
   - Frontend test runner: `npm test` in `d:\Projects\MU-One\frontend` executed 12 test suites, 57 tests — **ALL PASSED** in 8.4s.
   - Cloud Functions build: `npm run build` in `functions` compiled cleanly.
   - Frontend build: `npm run build` in `frontend` compiled cleanly.
2. **Access Control & Invariants**:
   - `firestore.rules:14–20`: Direct data access requires `hasPlatformAccess()`.
   - `functions/src/utils/domainCheck.ts:37–50`: Private beta functions require `requirePlatformAccess()`.
   - `frontend/src/app/dashboard/page.tsx:43`: Waitlisted users are blocked from dashboard and routed to `<WaitlistGate />`.
   - `functions/src/access/portal.ts:121–136`: Only admin can write to `platformAccess`.
3. **Calendar Sync & Sanitization**:
   - `functions/src/sync/syncUserCalendar.ts:30–32`: Document ID is currently `sha256(calendarId | googleEventId)`, causing duplicate documents across different students.
   - `functions/src/utils/sharedTimetable.ts:14–28`: `toPublicTimetableEvent` leaves `descriptionExcerpt`, `htmlLink`, `sourceCalendarName`, and `googleEventId`.
   - `functions/src/utils/eventParsing.ts:68–76`: Regex lacks `.` in `Sec.` and legacy prefix `Legacy`.
4. **UI Behavior**:
   - `frontend/src/components/dashboard/AgendaList.tsx:295`: Changing subject forcibly sets `setSectionFilter('all')`, violating R4.
   - `frontend/src/components/dashboard/AgendaList.tsx:150–156`: LocalStorage does not persist `'all'` because `/^[A-H]$/.test('all')` fails.
   - `frontend/src/components/dashboard/AgendaList.tsx:181–185`: Merges `sharedEvents` and `localEvents` with differing key strategies.
   - `frontend/src/components/access/WaitlistGate.tsx:78–86`: Displays confirmation only; has no consent checkbox or Google Calendar connect button.

---

## 2. Logic Chain

1. **Waitlist Boundary Integrity**:
   Because `platformAccess` documents are only written by `portal.ts:action == "grant"` (guarded by `requirePlatformAdmin`), waitlisted students cannot write to `platformAccess`. However, without a consent toggle in `WaitlistGate.tsx` and an endpoint to store `calendarConsent: true` in `platformWaitlist`, waitlisted users cannot initiate or complete calendar connection.
2. **Data Leakage & Sanitization**:
   `toPublicTimetableEvent` preserves `descriptionExcerpt` and `htmlLink`. Under R2, only 10 fields may be stored, and all personal data (organizer email, attendees, faculty, private notes, Google event links) must be stripped. The plan addresses this in F4, but must ensure the 10 fields align with frontend property names (`sectionCode` and `location`).
3. **Session Duplication**:
   - *Backend*: Replacing `sha256(calId | eventId)` with `computeSessionFingerprint` resolves cross-student duplicate documents in Firestore.
   - *Frontend*: `AgendaList.tsx` merges Firestore `sharedEvents` with `localEvents` from the user's personal calendar. Because `eventKey` produces different hashes, duplicates will still render in the UI unless `AgendaList.tsx` cross-deduplicates them.
4. **Unsafe Deletions**:
   In `syncUserCalendar.ts`, `sharedDeletes` issues `batch.delete()` on any cancelled event. Because individual users can decline calendar events, this will delete section-wide academic schedules. Deletion logic must be decoupled from individual student sync passes.

---

## 3. Caveats

1. **Google Calendar API Mocking**: In Jest test suites, Google Calendar API responses are mocked. Live OAuth token generation requires live Google Workspace credentials.
2. **Production Firebase Deploy**: `firebase deploy --only firestore:rules,firestore:indexes` must be run in production with appropriate Google Cloud credentials.
3. **ESLint Warning Baseline**: Pre-existing React Compiler warnings exist in `DashboardContext.tsx` and `usePersonalTasks.ts`, unrelated to calendar features.

---

## 4. Conclusion

`PROJECT.md` provides an accurate high-level architecture, but cannot be approved in its current draft because it contains critical gaps that would cause duplicate calendar sessions, accidental schedule deletions, and an incomplete waitlist user flow.

### Required Changes for Approval:
1. **Update M4 (F8)**: Include cross-source deduplication in `AgendaList.tsx` so that personal `localEvents` matching a `sharedEvent` are suppressed.
2. **Update M2 (F6)**: Fix cancellation handling in `syncUserCalendar.ts` to prevent individual student cancellations from deleting shared section schedules.
3. **Update M1 & Code Layout**: Include `frontend/src/components/access/WaitlistGate.tsx` and `frontend/src/lib/functions.ts` to implement the waitlist consent checkbox and Google Calendar connection button.
4. **Update Interface Contract 2**: Specify client-side mapping in `frontend/src/lib/firestore.ts` (mapping `section` to `sectionCode` and `venue` to `location`) to maintain compatibility with `AgendaList.tsx` and `calendarEventDetails.ts`.
5. **Update M3 & M5**: Add a dedicated Firestore security rules test suite to verify permission boundaries and email case-insensitivity.

---

## 5. Verification Method

### 5.1 Independent Test Commands
Execute the existing test suites from the project root:
```powershell
# Backend functions tests (all 14 suites must pass)
cd d:\Projects\MU-One\functions
npm test

# Frontend tests (all 12 suites must pass)
cd d:\Projects\MU-One\frontend
npm test

# Build verifications
cd d:\Projects\MU-One\functions
npm run build

cd d:\Projects\MU-One\frontend
npm run build
```

### 5.2 Files to Inspect for Remediation
1. `d:\Projects\MU-One\PROJECT.md`: Verify that M1, M2, M4, Interface Contract 2, and Code Layout incorporate the 5 required changes above.
2. `d:\Projects\MU-One\TEST_INFRA.md`: Verify that Tier 2 boundary tests include individual student cancellation and personal/shared calendar duplicate scenarios.

### 5.3 Invalidation Conditions
This review report shall be invalidated if:
- `ORIGINAL_REQUEST.md` is modified to remove the requirement that duplicate events do not appear.
- The platform access architecture is changed to grant full dashboard access to waitlisted students.
