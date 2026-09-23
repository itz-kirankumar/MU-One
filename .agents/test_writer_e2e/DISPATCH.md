# E2E Test Writer Dispatch

## 2026-09-21T18:10:00Z
- **Role**: E2E Test Writer (`teamwork_preview_test_writer`)
- **Working Directory**: d:\Projects\MU-One\.agents\test_writer_e2e
- **Project Root**: d:\Projects\MU-One
- **Original Request**: d:\Projects\MU-One\.agents\ORIGINAL_REQUEST.md
- **Project Spec**: d:\Projects\MU-One\PROJECT.md
- **Test Infra**: d:\Projects\MU-One\TEST_INFRA.md
- **Orchestrator Conversation ID**: b9706a30-9e99-42c4-a11e-6d85609cc08e

### Objective
Implement the comprehensive 4-tier opaque-box E2E test suite covering all 11 features in `PROJECT.md § Feature Inventory` and all requirements in `ORIGINAL_REQUEST.md`.
Upon completion, create `TEST_READY.md` at the project root following the format in `PROJECT.md`.

### Assigned File Ownership
You exclusively own and may create/modify:
- `functions/src/__tests__/e2eSharedCalendar.test.ts`
- `frontend/__tests__/e2eSharedCalendar.test.tsx`
- `TEST_READY.md` (at project root)
Do NOT modify application implementation files.

### Test Specifications (Tiers 1–4)
1. **Tier 1: Feature Coverage (>=5 tests per feature)**:
   - F1: Waitlist explicit consent vs joining waitlist; waitlisted users blocked from platform; no records granted in `platformAccess`.
   - F2: Waitlist calendar sync isolation; only calendar events synced; personal mail/tasks skipped.
   - F3: Multi-layer filtering; primary calendars, private/confidential events, personal reminders, non-default event types excluded.
   - F4: Strict 10-field sanitization; all personal data (emails, notes, organizer, attendees, links) stripped; strictly 10 fields preserved.
   - F5: Section parsing: "Section A-H", "Sec A-H", "Sec. A-H", "Legacy 1-8" -> A-H across programs TBM, YLC, HR & OS, SMG.
   - F6: Deterministic SHA-256 fingerprint deduplication; source update time conflict resolution (fresher updates kept).
   - F7: Firestore security rules: `sharedCalendarEvents` read requires `hasPlatformAccess()`, client writes denied, waitlist/access documents denied.
   - F8: Section selection ("All sections" + A-H); in-memory update without reload; default section & localStorage persistence.
   - F9: Subject filter works within selected section without resetting section.
   - F10: Cross-section subject comparison view shows sessions for other sections.
   - F11: UI states: loading copy ("Loading shared section calendars…"), empty copy ("No sessions are available for Section X in this period."), and retry button on failure.
2. **Tier 2: Boundary & Corner Cases**:
   - Case-insensitive email matching, whitespace/special char handling in section strings, empty descriptions, timezone offset handling, invalid section formats (e.g. Sec 9, Sec Z).
3. **Tier 3: Pairwise Combinations**:
   - Multiple users in same section syncing same events at different times; waitlisted user contributing while unadmitted user viewing.
4. **Tier 4: Real-World Scenarios**:
   - End-to-end integration scenarios simulating academic semester schedule sync.

### Execution & Verification
Run the test suites using `npm test` in `functions` and `frontend`.
Verify that your newly written tests run and execute properly.
Publish `TEST_READY.md` at project root with test commands and coverage checklist.
Write a handoff report in `d:\Projects\MU-One\.agents\test_writer_e2e\handoff.md` and send a message when complete.

## 2026-09-21T18:10:44Z
- Invocation message received from orchestrator:
"You are the E2E Test Writer.
Read the original request at d:\Projects\MU-One\.agents\ORIGINAL_REQUEST.md, project spec at d:\Projects\MU-One\PROJECT.md, test infra at d:\Projects\MU-One\TEST_INFRA.md, and your dispatch at d:\Projects\MU-One\.agents\test_writer_e2e\DISPATCH.md before starting.
Your working directory is d:\Projects\MU-One\.agents\test_writer_e2e.
Write the comprehensive 4-tier E2E tests in functions/src/__tests__/e2eSharedCalendar.test.ts and frontend/__tests__/e2eSharedCalendar.test.tsx.
Generate TEST_READY.md at the project root once tests are created and documented.
Write your report to d:\Projects\MU-One\.agents\test_writer_e2e\handoff.md and notify orchestrator conversation ID b9706a30-9e99-42c4-a11e-6d85609cc08e."

## 2026-09-21T18:16:51Z
- Message from Orchestrator (b9706a30-9e99-42c4-a11e-6d85609cc08e):
"PROJECT.md and TEST_INFRA.md have been updated following architectural review. Please ensure your E2E test suites cover:
1. Waitlist consent UI in WaitlistGate.tsx (consent checkbox + Google Calendar connect button without granting platform access).
2. Cancellation safety in syncUserCalendar (individual decline does not delete section schedule).
3. Frontend cross-source deduplication in AgendaList.tsx (matching shared events suppress duplicate local personal events).
4. Firestore rules verification test suite (functions/src/__tests__/firestoreRules.test.ts).
Action: Proceed with authoring functions/src/__tests__/e2eSharedCalendar.test.ts and frontend/__tests__/e2eSharedCalendar.test.tsx, verify with npm test, publish TEST_READY.md, and deliver handoff.md."
