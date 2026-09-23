# E2E Test Infra: MU-One Shared Academic Calendars

## Test Philosophy
- Opaque-box, requirement-driven. Derives from `ORIGINAL_REQUEST.md` and `PROJECT.md`.
- Systematic 4-tier methodology:
  - **Tier 1**: Feature Coverage (>=5 per feature)
  - **Tier 2**: Boundary & Corner Cases (>=5 per feature)
  - **Tier 3**: Cross-Feature Combinations (pairwise coverage)
  - **Tier 4**: Real-World Application Scenarios
- Pass/Fail Semantics: 100% of tests must pass with exit code 0.

## Feature Inventory Coverage Matrix
| # | Feature | Requirement | Tier 1 | Tier 2 | Tier 3 |
|---|---------|-------------|:------:|:------:|:------:|
| F1 | Waitlist Consent & Gating | R1 | 5 | 5 | ✓ |
| F2 | Calendar Sync Isolation | R1 | 5 | 5 | ✓ |
| F3 | Multi-Layer Event Filtering | R2 | 5 | 5 | ✓ |
| F4 | 10-Field Strict Sanitization | R2 | 5 | 5 | ✓ |
| F5 | Section Normalization across Programs | R3 | 5 | 5 | ✓ |
| F6 | Content Fingerprint Deduplication & Safe Deletion | R3 | 5 | 5 | ✓ |
| F7 | Firestore Rules & Database Config | R5 | 5 | 5 | ✓ |
| F8 | Section Selector & Local Persistence | R4 | 5 | 5 | ✓ |
| F9 | Subject Filter within Section | R4 | 5 | 5 | ✓ |
| F10 | Cross-Section Subject Comparison | R4 | 5 | 5 | ✓ |
| F11 | UI States (Loading, Empty, Retry) | R5 | 5 | 5 | ✓ |
| F12 | Waitlist Consent UI Gate | R1 | 5 | 5 | ✓ |
| F13 | Frontend Cross-Source Deduplication | R3 | 5 | 5 | ✓ |

## Test Architecture
- **Backend Test Runner**: `npm test` in `functions` (Jest). Tests unit logic, waitlist consent, sync isolation, event sanitization, section regex, fingerprint deduplication, safe deletion, and Firestore security rules.
- **Frontend Test Runner**: `npm test` in `frontend` (Jest + React Testing Library). Tests UI rendering, section switcher, subject filtering, cross-source deduplication, cross-section comparison drawer, and loading/empty/retry UI states.
- **Rules Test Suite**: `functions/src/__tests__/firestoreRules.test.ts`. Verifies security rule boundaries, platform access checks, client write rejections, and email case-insensitivity.
- **Build Verification**: `npm run build` in `frontend` and `functions`.

## Real-World Application Scenarios (Tier 4)
1. **Scenario 1 (Consented Waitlist Flow)**: A waitlisted student opens `/dashboard`, sees `WaitlistGate`, checks the consent checkbox, connects Google Calendar, remains completely blocked from the platform with zero `platformAccess` records, and has their section's academic sessions sanitized and published.
2. **Scenario 2 (Multi-Section Cross-Student Sync)**: Three different students from Section B and Section C sync identical course schedules from different Google calendars. Deduplication merges them into single canonical records per section session without duplication in Firestore.
3. **Scenario 3 (Personal Privacy Shield)**: A student's calendar contains private doctor appointments, personal reminders, confidential meetings, and a shared course schedule with faculty email in the description. Sanitization filters out personal events and publishes only the sanitized academic session stripped of email, notes, and links.
4. **Scenario 4 (Section Switching & Local Persistence)**: A student on Section A switches to Section D, verifies sessions update immediately without page reload, refreshes the page, and verifies Section D remains selected from local storage.
5. **Scenario 5 (Cross-Section Subject Comparison)**: A student taking "Consumer Behaviour" opens cross-section comparison to view when Sections A through H have their lectures scheduled, verifying times, modes, and venues.
6. **Scenario 6 (Admitted Student Duplicate Shield)**: An admitted student has an institutional lecture on both their personal calendar and the shared calendar. `AgendaList.tsx` suppresses the duplicate personal copy, rendering a single card.
7. **Scenario 7 (Cancellation Safety Guard)**: An individual student declines or deletes a class on their personal calendar. The background sync job runs without deleting the shared section schedule for the rest of the cohort.
