# Task Assignment: Milestone 4 Implementation Worker

## Mission
Implement the Frontend Calendar UI enhancements, cross-source deduplication, section switching and local persistence, subject filtering within section, cross-section subject comparison view, and calendar UI states for MU One.

## Working Directory
`d:\Projects\MU-One\.agents\worker_m4`

## File Ownership (Exclusively Owned)
You have exclusive write ownership over:
- `frontend/src/components/dashboard/AgendaList.tsx`
- `frontend/src/components/dashboard/CrossSectionComparison.tsx`
- `frontend/src/lib/firestore.ts`
- `frontend/__tests__/calendarDetails.test.tsx` (or new test files under `frontend/__tests__/`)

DO NOT edit any backend files under `functions/` or `firestore.rules` or other components.

## Context & Inputs
Read the following files before starting:
1. `d:\Projects\MU-One\.agents\ORIGINAL_REQUEST.md` (authoritative requirements R4, R5, AC)
2. `d:\Projects\MU-One\PROJECT.md` (§ Feature Inventory F8, F9, F10, F11, F13, § Interface Contracts, § Milestones)
3. `d:\Projects\MU-One\TEST_INFRA.md`
4. `d:\Projects\MU-One\TEST_READY.md`
5. `frontend/__tests__/e2eSharedCalendar.test.tsx` (inspect how the E2E tests exercise AgendaList, section switching, subject filtering, cross-section comparison, and UI states)

## Specific Tasks

### Task 1: Field Normalization in `frontend/src/lib/firestore.ts`
- Ensure `subscribeToSharedTimetableEvents` maps incoming documents to `NormalizedEvent` properly:
  - `sectionCode: doc.sectionCode || doc.section`
  - `sectionLabel: doc.sectionLabel || (doc.section ? `Section ${doc.section}` : undefined)`
  - `location: doc.location || doc.venue`
  - `description: doc.description || ""`
  - `subject: doc.subject || doc.course`
  - Retain `fingerprint` / `id` from doc.id.

### Task 2: Section Selector & Local Persistence in `frontend/src/components/dashboard/AgendaList.tsx`
- Dropdown options: "All sections" (`'all'`) followed by "Section A" (`'A'`) through "Section H" (`'H'`).
- Default selection:
  1. Check `localStorage.getItem('muone.calendarSection')`. If valid ('all' or 'A'-'H'), use it.
  2. Else if user profile has registered section (`userSection` prop or derived), use that section code.
  3. Else default to `'all'`.
- Persistence: whenever the user changes the section selector, save to `localStorage.setItem('muone.calendarSection', section)`.
- Seamless update: switching section updates displayed events in-memory immediately without page reload.

### Task 3: Subject Filter within Section (Fix Reset Bug)
- Populate subject dropdown with distinct subjects from sessions available in current view or dataset.
- Selecting a subject filters sessions to that subject.
- CRITICAL FIX: Ensure changing subject does NOT reset `sectionFilter` to `'all'`. Both filters must apply simultaneously:
  `matchesSection && matchesSubject`.

### Task 4: Cross-Source Event Deduplication in `AgendaList.tsx`
- When merging personal events (`events` / local Google events) and `sharedEvents`:
  - If a shared event exists with matching content (e.g. matching section/subject/date/start/end or title), suppress the duplicate personal event so that only the canonical shared event appears in the calendar view.

### Task 5: Cross-Section Subject Comparison View (`frontend/src/components/dashboard/CrossSectionComparison.tsx`)
- Implement a modal or slide-over drawer component:
  - Takes `sharedEvents`, `selectedSubject`, `isOpen`, `onClose`.
  - Groups sessions for the given subject by section (Sections A through H).
  - Displays session details (date, start time, end time, venue/location, mode, title).
  - Allows easy comparison across all sections for that course.
  - Handles subjects with sessions in only one section or zero sessions gracefully.
- Add a dedicated "Compare across sections" action button in the `AgendaList.tsx` toolbar adjacent to the subject filter dropdown to trigger this view when a subject is selected (or open comparison modal).

### Task 6: Calendar UI States in `AgendaList.tsx`
- Loading state: When `loadingShared` is true (or initial loading), render:
  `"Loading shared section calendars…"`
- Empty state: When no sessions are available for the selected section/filter, render:
  `"No sessions are available for Section ${section} in this period."` (or appropriate wording for 'All sections').
- Error state & Retry: If `sharedError` occurs, render an error message with a functional "Retry" button that calls `onRetryShared` or re-triggers the subscription.

### Task 7: Unit & E2E Testing Verification
- Run:
  `cd d:\Projects\MU-One\frontend`
  `npm test`
  `npm run build`
- Ensure all frontend tests (including `e2eSharedCalendar.test.tsx` and existing tests) pass 100% and Next.js build succeeds with 0 errors.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion Deliverables
Write a self-contained 5-component handoff report to:
`d:\Projects\MU-One\.agents\worker_m4\handoff.md`
and notify the orchestrator (conversation ID `b9706a30-9e99-42c4-a11e-6d85609cc08e`) via `send_message`.
