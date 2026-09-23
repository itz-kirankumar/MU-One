# Task Assignment: Milestone 4 Implementation Worker (Gen 2)

## Mission
Complete the Frontend Calendar UI enhancements by creating `frontend/src/components/dashboard/CrossSectionComparison.tsx`, integrating it into `frontend/src/components/dashboard/AgendaList.tsx` with a trigger button, updating `frontend/src/lib/firestore.ts` and `frontend/src/lib/functions.ts` types, and verifying 100% test pass and production build in `frontend`.

## Working Directory
`d:\Projects\MU-One\.agents\worker_m4_gen2`

## File Ownership (Exclusively Owned)
You have exclusive write ownership over:
- `frontend/src/components/dashboard/CrossSectionComparison.tsx`
- `frontend/src/components/dashboard/AgendaList.tsx`
- `frontend/src/lib/firestore.ts`
- `frontend/src/lib/functions.ts`
- `frontend/__tests__/` (any new/updated test files in frontend)

DO NOT modify any backend files under `functions/` or `firestore.rules`.

## Context & Inputs
Read:
1. `d:\Projects\MU-One\.agents\ORIGINAL_REQUEST.md` (R4, R5, AC)
2. `d:\Projects\MU-One\PROJECT.md` (§ Feature Inventory F8, F9, F10, F11, F13, § Interface Contracts)
3. `d:\Projects\MU-One\TEST_INFRA.md`
4. `d:\Projects\MU-One\TEST_READY.md`
5. `d:\Projects\MU-One\.agents\explorer_status_1\handoff.md`

## Specific Tasks

### Task 1: Create `frontend/src/components/dashboard/CrossSectionComparison.tsx`
Implement a clean, accessible React component for comparing course schedules across Sections A–H:
- Component Props:
  ```ts
  interface CrossSectionComparisonProps {
    sharedEvents: NormalizedEvent[];
    currentSubject: string;
    isOpen: boolean;
    onClose: () => void;
  }
  ```
- Behavior:
  - If `!isOpen`, return `null`.
  - When `isOpen`, render an accessible modal dialog / drawer overlay with a backdrop click handler and a Close ('✕' / button) action.
  - Filter `sharedEvents` to those matching `currentSubject` (case-insensitive or normalized course/subject comparison).
  - Group sessions by section code (`'A'` through `'H'`).
  - For each section (A to H):
    - Display the section header (e.g. "Section A").
    - If the section has sessions for this course, render each session: Date, Start Time, End Time, Venue/Location, Mode (in-person/online), Title/Description.
    - If a section has no sessions for this subject, display a subtle "No scheduled sessions" placeholder.
  - If no sessions exist for `currentSubject` across all sections, show: "No sessions found for this subject across sections."
  - Style with Tailwind CSS matching the MU One dashboard design tokens (dark theme compatible, clear contrast, responsive grid/list).

### Task 2: Integrate into `frontend/src/components/dashboard/AgendaList.tsx`
- Import `CrossSectionComparison`.
- Maintain a local state: `const [isComparisonOpen, setIsComparisonOpen] = useState(false);`
- In the toolbar adjacent to the Subject dropdown (line ~285–305):
  - Add a button: "Compare across sections" (or icon + text).
  - Clicking the button sets `setIsComparisonOpen(true)`.
  - Disable or hide appropriately if there are no subjects or `allEvents.length === 0`, but ensure it is easily discoverable when browsing subjects.
- Render `<CrossSectionComparison isOpen={isComparisonOpen} onClose={() => setIsComparisonOpen(false)} currentSubject={subjectFilter === 'all' ? (subjects[0] || '') : subjectFilter} sharedEvents={sharedEvents} />` in the component JSX.

### Task 3: Defensive Normalization in `frontend/src/lib/firestore.ts`
- In `subscribeToSharedTimetable` (or equivalent subscription helper):
  Ensure document fields defensively normalize:
  - `sectionCode: data.sectionCode || data.section || ''`
  - `location: data.location || data.venue || ''`
  - `description: data.description || data.sessionDescription || data.descriptionExcerpt || ''`

### Task 4: Type Definitions in `frontend/src/lib/functions.ts`
- Ensure `PlatformAccessStatus` has `calendarConsent?: boolean` so consumers do not need `as any` type casting.

### Task 5: Verify Frontend Tests & Build
- In `frontend`:
  - Run `npm test` -> all 13 suites (including `e2eSharedCalendar.test.tsx` and `calendarDetails.test.tsx`) must pass 100%.
  - Run `npm run build` -> Next.js Turbopack build must succeed with code 0 and 0 errors.

### Task 6: Deliver Handoff Report
- Write a 5-component handoff report to:
  `d:\Projects\MU-One\.agents\worker_m4_gen2\handoff.md`
- Notify orchestrator (Recipient: `74c8e862-43dc-4a8f-be88-c18ff53d953d`) via `send_message`.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-22T00:41:34Z
You are worker_m4_gen2, an implementation worker for Milestone 4.
Your Working Directory is: d:\Projects\MU-One\.agents\worker_m4_gen2
Read d:\Projects\MU-One\.agents\ORIGINAL_REQUEST.md, d:\Projects\MU-One\PROJECT.md, and d:\Projects\MU-One\.agents\worker_m4_gen2\DISPATCH.md.
Implement frontend/src/components/dashboard/CrossSectionComparison.tsx, update AgendaList.tsx, update firestore.ts and functions.ts, verify all frontend tests and npm run build in frontend, and write handoff.md.
Notify parent (Recipient: 74c8e862-43dc-4a8f-be88-c18ff53d953d) via send_message when complete.

