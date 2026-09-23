# Survey Explorer 3 Investigation Report: Firestore Database, Security Rules & Calendar UI

## 1. Observation

### 1.1 Firestore Configuration & Named Database Setup
- **`firebase.json`** (Lines 2–13):
  ```json
  "firestore": [
    {
      "database": "(default)",
      "rules": "firestore.rules",
      "indexes": "firestore.indexes.json"
    },
    {
      "database": "default",
      "rules": "firestore.rules",
      "indexes": "firestore.indexes.json"
    }
  ],
  ```
  In commit `0652cfd3edb566591eb496e2488df291b8a83141` ("Deploy Firestore rules to app database"), `firebase.json` was changed from a single firestore configuration object targeting `(default)` to an array targeting both `(default)` and `default`.
- **`frontend/src/lib/firebase.ts`** (Lines 20–26):
  ```typescript
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID?.trim() || 'default';
  const db = getFirestore(app, databaseId);
  ```
  When `NEXT_PUBLIC_FIREBASE_DATABASE_ID` is unset (as in `frontend/.env.local`), `databaseId` defaults to the string `'default'`.
- **`functions/src/utils/getDb.ts`** (Lines 8–18):
  ```typescript
  export function getDb(): Firestore {
    const databaseId = process.env.APP_DATABASE_ID || "default";
    if (process.env.NODE_ENV === "test") {
      return admin.firestore();
    }
    try {
      return getFirestore(databaseId);
    } catch {
      return admin.firestore();
    }
  }
  ```
  Cloud Functions also defaults to the named database `'default'`.

### 1.2 Firestore Security Rules (`firestore.rules`)
- **File**: `d:\Projects\MU-One\firestore.rules`
- **Helper functions** (Lines 6–20):
  ```rules
  function isMuUser() {
    return request.auth != null
      && request.auth.token.email_verified == true
      && request.auth.token.email.matches('.*@mastersunion\\.org$');
  }

  function hasPlatformAccess() {
    return isMuUser()
      && (
        request.auth.token.email == 'kiran.kumar2028@mastersunion.org'
        || exists(/databases/$(database)/documents/platformAccess/$(request.auth.token.email))
      );
  }
  ```
- **Shared Calendar collection** (Lines 105–108):
  ```rules
  match /sharedCalendarEvents/{eventId} {
    allow read: if hasPlatformAccess();
    allow write: if false;
  }
  ```
- **Platform Access & Waitlist protection** (Lines 112–118):
  ```rules
  match /platformAccess/{document=**} {
    allow read, write: if false;
  }

  match /platformWaitlist/{document=**} {
    allow read, write: if false;
  }
  ```
- **Root-level deny-all fallback** (Lines 121–123):
  ```rules
  match /{document=**} {
    allow read, write: if false;
  }
  ```

### 1.3 Firestore Indexes (`firestore.indexes.json`)
- **File**: `d:\Projects\MU-One\firestore.indexes.json`
- Contains composite indexes for `users`, `surveys`, `personalTasks`, `syncJobs`, `calendarEvents`, and `mailSignals`.
- Contains **no** index definition for `sharedCalendarEvents`.
- Realtime listener query in `frontend/src/lib/firestore.ts` (Lines 81–93):
  ```typescript
  export function subscribeToSharedTimetable(
    fromIso: string,
    toIso: string,
    cb: (events: NormalizedEvent[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const ref = query(
      collection(db, 'sharedCalendarEvents'),
      where('startIso', '>=', fromIso),
      where('startIso', '<=', toIso),
      orderBy('startIso', 'asc'),
      limit(1000)
    );
    ...
  }
  ```
  Currently queries all shared events in a single date range, then the client filters in memory. If any future query filters by `sectionCode` directly in Firestore (`where('sectionCode', '==', section)` with range on `startIso`), a composite index `(sectionCode ASC, startIso ASC)` is required.

### 1.4 Rules Testing Setup
- Searched codebase for `@firebase/rules-unit-testing` and `rules.test`.
- Result: `@firebase/rules-unit-testing` is **not installed** in `package.json`, `frontend/package.json`, or `functions/package.json`. No security rules unit tests currently exist.

### 1.5 Frontend Calendar UI Architecture & State (`frontend/src/components/dashboard/AgendaList.tsx`)
- **Location**: Rendered inside `DashboardShell.tsx` (Line 144) on `/dashboard`.
- **Section Selection**:
  - `SECTIONS` constant (Line 18): `const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;`
  - Dropdown options (Lines 300–304):
    ```tsx
    <select id="calendar-section-filter" value={sectionFilter} onChange={event => { setSectionFilter(event.target.value); window.localStorage.setItem(SECTION_KEY, event.target.value); setSelectedEvent(null); }} className="...">
      <option value="all">All sections</option>
      {SECTIONS.map(section => <option key={section} value={section}>Section {section}</option>)}
      <option value="personal">Personal only</option>
    </select>
    ```
- **Section Change Without Reload**:
  - Setting `sectionFilter` state immediately filters `events` memo (Lines 188–198) without invoking page navigation or reload.
- **Subject Filtering Bug**:
  - Line 295:
    ```tsx
    <select id="calendar-subject-filter" value={subjectFilter} onChange={event => { setSubjectFilter(event.target.value); setSectionFilter('all'); setSelectedEvent(null); }} className="...">
    ```
    Changing the subject forcibly resets `sectionFilter` to `'all'` via `setSectionFilter('all')`.
    This directly violates R4: *"Subject filtering must work within the selected section."*
- **Default Section Logic & Local Storage Persistence Bug**:
  - Lines 150–156:
    ```tsx
    useEffect(() => {
      const saved = window.localStorage.getItem(SECTION_KEY)?.toUpperCase() || '';
      const profileSection = String(access?.section || '').toUpperCase();
      const preferred = /^[A-H]$/.test(saved) ? saved : (/^[A-H]$/.test(profileSection) ? profileSection : 'all');
      const timer = window.setTimeout(() => setSectionFilter(preferred), 0);
      return () => window.clearTimeout(timer);
    }, [access?.section]);
    ```
    If the student explicitly chooses "All sections" and it is saved to `SECTION_KEY` as `'all'`, `/^[A-H]$/.test(saved)` evaluates to `false`. The code then reverts to `profileSection` (e.g. `'B'`) on the next mount instead of honoring the student's stored choice of `'all'`.
- **Cross-Section Subject Comparison View**:
  - Searched entire codebase for `cross-section` and `comparison`.
  - Result: No cross-section comparison UI or functionality exists in `AgendaList.tsx` or elsewhere in `frontend/src`.
  - Required by R4: *"Allow students to view when a session is conducted for another section."* and Acceptance Criteria: *"Cross-section subject comparison works."*
- **UI State Handling (Loading, Empty, Retry)**:
  - **Loading State** (Lines 310–312):
    ```tsx
    {(loading || sharedLoading) && allEvents.length === 0 ? (
      <div className="grid min-h-64 place-items-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[#f7d344] border-t-transparent" /></div>
    ```
    R5 specifies: Loading copy must be `"Loading shared section calendars…"`. Currently only displays an unlabelled spinning icon.
  - **Empty State** (Lines 312–316):
    ```tsx
    ) : allEvents.length === 0 ? (
      <EmptyState icon={Calendar} title="No sessions" description="Personal and shared section calendars will appear here after the next sync." />
    ) : events.length === 0 ? (
      <EmptyState icon={Calendar} title="No sessions for these filters" description="Choose another subject, section, or date range." />
    ```
    And on day/timeline views (Lines 317, 331):
    `No shared sessions on this day.` / `No shared sessions in this period.`
    R5 specifies: Empty state copy must be `"No sessions are available for Section X in this period."` (e.g. `Section B`, or `All sections` when `'all'` is selected).
  - **Retry State** (Line 309):
    ```tsx
    {sharedError && <p role="alert" className="border-b border-red-900/40 bg-red-950/20 px-4 py-2 text-xs text-red-300">{sharedError}</p>}
    ```
    R5 specifies: *"and a retry action on failure."* There is currently no retry button or retry callback wired up in the error UI.

### 1.6 Verification Commands & Build Status
- **Frontend Test Runner**: `npm test` in `d:\Projects\MU-One\frontend` (Jest + React Testing Library).
  - Result: **12 test suites passed, 57 tests passed** (14.47s).
- **Backend Test Runner**: `npm test` in `d:\Projects\MU-One\functions` (Jest --runInBand).
  - Result: **14 test suites passed, 204 tests passed** (18.10s).
- **Frontend Build**: `npm run build` in `d:\Projects\MU-One\frontend` (`next build` with Turbopack).
  - Result: **Build succeeded**, 11 static/dynamic pages compiled cleanly.
- **Backend Build**: `npm run build` in `d:\Projects\MU-One\functions` (`tsc`).
  - Result: **Build succeeded** with zero TypeScript compilation errors.
- **Frontend Lint**: `npm run lint` in `d:\Projects\MU-One\frontend` (`eslint`).
  - Result: Exited with code 1 due to pre-existing React Compiler / React 19 rules in `DashboardContext.tsx` and `usePersonalTasks.ts` (`react-hooks/set-state-in-effect`), unrelated to calendar changes.

---

## 2. Logic Chain

1. **Named Database & "Missing or insufficient permissions"**:
   - Observation 1.1 shows `frontend/src/lib/firebase.ts` connects to database `'default'` by default.
   - Before commit `0652cfd`, `firebase.json` only declared `(default)`. When rules were deployed, the named database `'default'` had zero rules deployed, defaulting to `allow read, write: if false;`. Any client query to `'default'` returned `Missing or insufficient permissions`.
   - In `firestore.rules`, `hasPlatformAccess()` checks `exists(/databases/$(database)/documents/platformAccess/$(request.auth.token.email))`.
   - In Cloud Functions `portal.ts`, emails are normalized via `normalizeEmail()` to lowercase (`email.trim().toLowerCase()`). If a user's Google token email contains capital letters, `request.auth.token.email` will not match the lowercase document key in Firestore rules unless `.lower()` is applied in the security rule (`request.auth.token.email.lower()`). Hardening this rule prevents subtle permission rejections for authorized users.

2. **Waitlisted Users & Personal Data Isolation**:
   - Observation 1.2 confirms `sharedCalendarEvents` write is permanently `if false;`. Clients cannot inject events.
   - Observation 1.2 confirms `platformAccess` and `platformWaitlist` read/write are permanently `if false;`. Clients cannot inspect or modify waitlist documents directly.
   - In `app/dashboard/page.tsx` (Line 43), waitlisted users (`!access?.hasAccess`) are intercepted and rendered `<WaitlistGate />`. They never enter the dashboard or execute Firestore listeners against `/users/{uid}` or `/sharedCalendarEvents`.
   - Thus, consented waitlisted users' contributions can be synced server-side by Cloud Functions without granting platform access or modifying access records, satisfying R1, R2, and R5.

3. **Calendar Subject & Section Filter Interaction**:
   - Observation 1.5 shows line 295 resets section to `'all'` whenever a subject is chosen.
   - R4 requires: *"Subject filtering must work within the selected section."*
   - Therefore, changing the subject filter must preserve the active `sectionFilter`.
   - Furthermore, `subjects` in the dropdown should either reflect subjects active in the selected section or allow filtering within the active section.

4. **Default Section & LocalStorage Logic**:
   - Observation 1.5 shows that `AgendaList.tsx` only accepts `/^[A-H]$/` from localStorage. If a user selects "All sections" (`'all'`), the preference is saved as `'all'`, but on next load `/^[A-H]$/.test('all')` fails, falling back to `access?.section` (e.g. `'B'`).
   - R4 requires: *"Default to the user's registered section, or 'All sections' if none. Preserve preference locally."*
   - Therefore, preference loading must check if `saved === 'ALL'` or `saved === 'all'`, or `/^[A-H]$/.test(saved)`. Only when no stored preference exists should it fallback to `access?.section`, and then to `'all'`.

5. **Cross-Section Comparison Gap**:
   - Observation 1.5 shows that cross-section subject comparison does not exist in the codebase.
   - R4 and Acceptance Criteria require: *"Allow students to view when a session is conducted for another section."* and *"Cross-section subject comparison works."*
   - Because `subscribeToSharedTimetable` already fetches all sections' events for the current date window into `sharedEvents`, cross-section data is already available locally in memory!
   - A comparison view can be implemented by grouping events by course/subject across sections A–H and presenting a modal, popover, or collapsible view that displays the date, time, venue, and mode for each section conducting that subject.

6. **UI States Gap**:
   - Observation 1.5 shows loading text `"Loading shared section calendars…"` is missing (only spinner shown).
   - Empty state text `"No sessions are available for Section X in this period."` is missing (generic copy used).
   - Retry action on failure is missing (only an error string is rendered without a button).
   - Fixing these requires updating `AgendaList.tsx` to display the exact required copy and adding a retry handler that restarts the listener.

---

## 3. Caveats

1. **Firebase CLI Deployment**: Investigation is read-only. We did not run `firebase deploy --only firestore:rules,firestore:indexes` against Google Cloud servers; this must be executed during the deployment phase.
2. **Local Firebase Emulator**: The Firebase emulator was not running during this survey. Tests were evaluated using existing Jest test suites.
3. **No Rules Unit Test Runner**: No `@firebase/rules-unit-testing` configuration is currently in the repo. A mock-based or emulator-based test suite should be added by the test/implementation agent.
4. **Pre-existing ESLint Failures**: `npm run lint` reported pre-existing React 19 / Compiler warnings in `DashboardContext.tsx` and `usePersonalTasks.ts`. These are not related to the calendar changes.

---

## 4. Conclusion

The architecture of MU One is well-structured and ready for the calendar enhancements:
1. **Firestore Database**: `firebase.json` already defines both `(default)` and `default`.
2. **Security Rules**: `firestore.rules` must be hardened by using `.lower()` for email lookups to prevent case-sensitivity permission errors.
3. **Indexes**: A composite index for `sharedCalendarEvents` on `sectionCode ASC, startIso ASC` should be added to `firestore.indexes.json`.
4. **Frontend Calendar (`AgendaList.tsx`)**: Needs four targeted updates:
   - **Fix Subject Filter**: Stop resetting `sectionFilter` to `'all'` when subject changes.
   - **Fix Default / LocalStorage**: Correctly recognize stored `'all'` value from `muone.calendarSection`.
   - **Add UI States**:
     - Loading: Include text `"Loading shared section calendars…"`.
     - Empty: Display `"No sessions are available for Section X in this period."`.
     - Error: Provide a `"Retry"` button to re-trigger `subscribeToSharedTimetable`.
   - **Add Cross-Section Comparison**: Build a cross-section comparison component/drawer that allows students to view when a selected subject/session is conducted across Sections A–H.

---

## 5. Verification Method

### 5.1 Automated Test Suites
Run the following commands from the repository root:
1. **Frontend Tests**:
   ```powershell
   cd d:\Projects\MU-One\frontend
   npm test
   ```
   *Expected*: All test suites pass, specifically `__tests__/calendarDetails.test.tsx`. New tests should be added to assert:
   - "Loading shared section calendars…" appears during loading.
   - "No sessions are available for Section X in this period." appears when filtered section has no events.
   - Retry button appears on failure and re-subscribes.
   - Subject filtering maintains the selected section.
   - Cross-section subject comparison renders session timings for other sections.
2. **Backend Tests**:
   ```powershell
   cd d:\Projects\MU-One\functions
   npm test
   ```
   *Expected*: All 14 suites pass (including `sharedTimetable.test.ts` and `eventParsing.test.ts`).
3. **Build Verifications**:
   ```powershell
   cd d:\Projects\MU-One\frontend
   npm run build
   cd d:\Projects\MU-One\functions
   npm run build
   ```
   *Expected*: Both Next.js production build and TypeScript compiler finish with exit code 0.

### 5.2 Files to Inspect
- `d:\Projects\MU-One\firebase.json`: Verify multi-database configuration for `(default)` and `default`.
- `d:\Projects\MU-One\firestore.rules`: Verify `hasPlatformAccess()` and `match /sharedCalendarEvents/{eventId}`.
- `d:\Projects\MU-One\firestore.indexes.json`: Verify composite index for `sharedCalendarEvents`.
- `d:\Projects\MU-One\frontend\src\components\dashboard\AgendaList.tsx`: Verify section selector, subject filter within section, default section logic, cross-section comparison, and loading/empty/retry UI states.
- `d:\Projects\MU-One\frontend\__tests__\calendarDetails.test.tsx`: Verify test coverage for R4 and R5 requirements.
