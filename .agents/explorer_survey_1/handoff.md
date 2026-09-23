# Handoff Report — Backend Architecture, Calendar Sync & Consent Verification

**Author**: Survey Explorer 1  
**Date**: 2026-09-21T18:08:00Z  
**Target Milestone**: Survey and Architecture Investigation  
**Working Directory**: `d:\Projects\MU-One\.agents\explorer_survey_1`  
**Reference Documents**: `d:\Projects\MU-One\.agents\ORIGINAL_REQUEST.md`, `d:\Projects\MU-One\.agents\explorer_survey_1\DISPATCH.md`

---

## 1. Observation

### 1.1 Backend Directory & Infrastructure Overview
- **Project Configuration**: Root `package.json` designates workspaces `["frontend"]`. The Firebase functions backend is located in `d:\Projects\MU-One\functions`.
- **Functions Manifest (`functions/package.json`)**:
  - `name`: `"mu-one-functions"`, Node engine `"20"`, main `"lib/index.js"`.
  - Dependencies: `firebase-admin` (^12.0.0), `firebase-functions` (^6.0.0), `google-auth-library` (^9.0.0), `googleapis` (^144.0.0), `date-fns` (^3.6.0), `nodemailer` (^10.0.10), `resend` (^6.28.1).
  - DevDependencies: `jest` (^29.7.0), `ts-jest` (^29.1.0), `firebase-functions-test` (^3.3.0), `typescript` (^5.4.0).
  - Script `"test"`: `"jest --runInBand"`.
- **Firebase Configuration (`firebase.json`)**:
  - Targets both database `(default)` and named database `default`:
    ```json
    "firestore": [
      { "database": "(default)", "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
      { "database": "default", "rules": "firestore.rules", "indexes": "firestore.indexes.json" }
    ]
    ```
  - Emulators configured: Auth (9099), Firestore (8080), Functions (5001), Hosting (5000), UI (4000).
- **Database Routing Utility (`functions/src/utils/getDb.ts`)**:
  - Lines 8–17:
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

### 1.2 Waitlist Data Model and Platform Access Control
- **Waitlist Representation (`functions/src/access/portal.ts`)**:
  - Callable function `accessPortal` handles actions: `"status"`, `"join"`, `"list"`, `"grant"`, `"revoke"`.
  - Waitlist collection: `platformWaitlist`. Document ID is normalized caller email (`callerEmail`).
  - Schema written during `"join"` (lines 60–70):
    ```typescript
    await ref.set({
      email: callerEmail,
      uid,
      displayName: String(request.auth?.token.name || "").slice(0, 120),
      status: existing.get("status") === "approved" ? "approved" : "waiting",
      joinedAt: existing.get("joinedAt") || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      program: data.program || null,
      section: data.section || null,
      requestedFeatures: data.requestedFeatures || null,
    }, { merge: true });
    ```
- **Platform Access Representation (`functions/src/access/portal.ts` & `functions/src/utils/domainCheck.ts`)**:
  - Permanent administrator: `kiran.kumar2028@mastersunion.org` (`PLATFORM_ADMIN_EMAIL`).
  - Allowlist collection: `platformAccess`. Document ID is student email (`targetEmail`).
  - Schema written during admin `"grant"` (lines 122–136):
    ```typescript
    batch.set(db.collection("platformAccess").doc(targetEmail), {
      email: targetEmail,
      status: "granted",
      grantedBy: callerEmail,
      grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    batch.set(db.collection("platformWaitlist").doc(targetEmail), {
      email: targetEmail,
      status: "approved",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    ```
- **Access Blocking Mechanisms**:
  - **Firestore Rules (`firestore.rules`)**:
    - Lines 14–20:
      ```javascript
      function hasPlatformAccess() {
        return isMuUser()
          && (
            request.auth.token.email == 'kiran.kumar2028@mastersunion.org'
            || exists(/databases/$(database)/documents/platformAccess/$(request.auth.token.email))
          );
      }
      function isOwner(uid) {
        return hasPlatformAccess() && request.auth.uid == uid;
      }
      ```
    - Lines 38–94: `/users/{uid}` and all subcollections (`personalTasks`, `focus`, `dashboard`, `syncJobs`, `calendarEvents`, `mailSignals`, `googleTasks`) require `isOwner(uid)`. Any unadmitted or waitlisted user receives a permission error on direct Firestore reads and writes.
    - Lines 105–108:
      ```javascript
      match /sharedCalendarEvents/{eventId} {
        allow read: if hasPlatformAccess();
        allow write: if false;
      }
      ```
    - Lines 112–118: `/platformAccess/{document=**}` and `/platformWaitlist/{document=**}` deny all direct client reads/writes (`allow read, write: if false;`).
  - **Function-level Guards (`functions/src/utils/domainCheck.ts`)**:
    - Lines 37–50:
      ```typescript
      export async function requirePlatformAccess(context: CallableRequest): Promise<string> {
        const uid = requireMuDomain(context);
        const email = authenticatedEmail(context);
        if (email === PLATFORM_ADMIN_EMAIL) return uid;

        const access = await getDb().collection("platformAccess").doc(email).get();
        if (!access.exists || access.get("status") !== "granted") {
          throw new HttpsError(
            "permission-denied",
            "MU One is currently in private beta. Join the waitlist to request access."
          );
        }
        return uid;
      }
      ```
    - Used to gate: `createCalendarEvent`, `createGoogleTask`, `completeGoogleTask`, `importTodaySuggestionToGoogleTask`, `sendMail`, `getFullMailMessage`, `researchMailTopic`, and `syncDashboard`.
  - **Frontend UI Gate (`frontend/src/app/dashboard/page.tsx` & `frontend/src/components/access/WaitlistGate.tsx`)**:
    - Line 43 of `app/dashboard/page.tsx`:
      `if (isPreview || !access?.hasAccess) return <WaitlistGate />;`
    - `WaitlistGate` renders form allowing the student to specify program and section to join the waitlist, or renders the confirmation state ("You're on the waitlist"). The main dashboard (`DashboardShell`) is never rendered.

### 1.3 Google Calendar OAuth & Token Management
- **OAuth Endpoints (`functions/src/auth/connectGoogleAccount.ts`)**:
  - `getGoogleAuthUrl` (onCall):
    - Line 42: Enforces `const uid = await requirePlatformAccess(request);`.
    - Lines 46–51: Generates OAuth URL using `google-auth-library` with scopes (`calendar`, `gmail.readonly`, `gmail.send`, `tasks`, `openid`, `email`, `profile`), `access_type: "offline"`, `prompt: "consent"`, and `state: uid`.
  - `connectGoogleAccount` (onRequest HTTP redirect):
    - Lines 129–137:
      ```typescript
      if (firebaseEmail !== PLATFORM_ADMIN_EMAIL) {
        const access = await getDb().collection("platformAccess").doc(firebaseEmail).get();
        if (!access.exists || access.get("status") !== "granted") {
          res.redirect(
            buildDashboardRedirect(DASHBOARD_URL.value(), "error", "access_not_granted")
          );
          return;
        }
      }
      ```
    - Verifies token email ends with `@mastersunion.org` and matches Firebase Auth user.
    - Encrypts and stores tokens via `storeTokens(uid, refreshToken, accessToken, expiresAt, scopesGranted)`.
    - Updates Firestore `users/{uid}` with `googleConnection` status (`connected: true`).
    - Redirects to `buildDashboardRedirect(DASHBOARD_URL.value(), "success")`.
- **Token Storage (`functions/src/auth/tokenStore.ts`)**:
  - `storeTokens()`: Refresh token encrypted with AES-256-GCM via `functions/src/utils/encryption.ts` using secret `TOKEN_ENCRYPTION_KEY`. Saved to `users/{uid}` under `googleConnection.encryptedRefreshToken`.
  - `getAccessToken()`: Reads stored access token. If expired (with 60s buffer), decrypts refresh token, requests a new token from Google OAuth2 client, persists new credentials to `users/{uid}`, and returns active access token.

### 1.4 Calendar Sync Logic
- **Single User Sync (`functions/src/sync/syncUserCalendar.ts`)**:
  - Fetches calendars using Google Calendar API v3 (`calendar.calendarList.list({ maxResults: 250 })`).
  - Skips holiday calendars based on keyword match (`"holiday"`, `"holidays in"`, `"public holiday"`, `"#holiday"`).
  - Evaluates `isSharedCalendar(cal)` (`functions/src/utils/sharedTimetable.ts:9–11`):
    `return !source.primary && ["reader", "writer", "freeBusyReader"].includes(source.accessRole);`
  - Normalizes events via `normalizeEvent(...)` (`functions/src/utils/eventParsing.ts`).
  - Evaluates shared timetable eligibility (lines 125–128):
    ```typescript
    normalized.sharedTimetable = Boolean(
      isSharedCalendar(cal) && normalized.sectionCode && !normalized.isDeadline
    );
    if (normalized.sharedTimetable && publicId) sharedEvents.set(publicId, normalized);
    ```
  - Sanitization (`publicTimetableRecord(event)` calling `toPublicTimetableEvent`):
    Lines 14–28 of `sharedTimetable.ts`:
    ```typescript
    export function toPublicTimetableEvent(event: NormalizedEvent) {
      const safeEvent: Partial<NormalizedEvent> = { ...event };
      delete safeEvent.sourceCalendarId;
      delete safeEvent.faculty;
      delete safeEvent.organizerName;
      delete safeEvent.organizerEmail;
      return {
        ...safeEvent,
        subject: event.course || event.subject || "General",
        course: event.course || event.subject || "General",
        sectionCode: event.sectionCode,
        sectionLabel: `Section ${event.sectionCode}`,
        sharedTimetable: true,
      };
    }
    ```
  - Document ID generation (line 30–32):
    ```typescript
    function sharedEventId(calendarId: string, googleEventId: string): string {
      return createHash("sha256").update(`${calendarId}|${googleEventId}`).digest("hex");
    }
    ```
  - Batched write to Firestore:
    Writes `sharedCalendarEvents/{id}` with `publicTimetableRecord(event)`.
    Also writes personal events to `/users/{uid}/calendarEvents/{iCalUID}` and `/users/{uid}/dashboard/current`.
- **Scheduled Multi-User Sync (`functions/src/sync/scheduledSyncAllUsers.ts`)**:
  - Runs on cron schedule `"every 5 minutes"`.
  - Queries `users` where `googleConnection.connected == true`.
  - Lines 63–76:
    ```typescript
    const nonAdmin = eligibleUsers.filter(user => user.email && user.email !== PLATFORM_ADMIN_EMAIL);
    const accessSnapshots = nonAdmin.length
      ? await db.getAll(...nonAdmin.map(user => db.collection("platformAccess").doc(user.email)))
      : [];
    const grantedEmails = new Set(
      accessSnapshots
        .filter(access => access.exists && access.get("status") === "granted")
        .map(access => access.id)
    );

    uids = eligibleUsers
      .filter(user => user.email === PLATFORM_ADMIN_EMAIL || grantedEmails.has(user.email))
      .slice(0, MAX_USERS_PER_RUN)
      .map(user => user.uid);
    ```
  - For each user in `uids`, executes `syncUserCalendar(uid, SYNC_DAYS)`, `syncUserMail(uid)`, and `syncUserGoogleTasks(uid)`.

### 1.5 Section Normalization
- **Parsing Section Code (`functions/src/utils/eventParsing.ts:68–76`)**:
  ```typescript
  export function extractSectionCode(...values: string[]): string | null {
    const text = values.filter(Boolean).join("\n");
    const letterMatch = text.match(/\b(?:section|sec)\s*[-:#]?\s*([A-H])\b/i);
    if (letterMatch) return letterMatch[1].toUpperCase();

    const numberMatch = text.match(/\b(?:section|sec)\s*[-:#]?\s*([1-8])\b/i);
    if (!numberMatch) return null;
    return String.fromCharCode(64 + Number(numberMatch[1]));
  }
  ```
  Recognizes Section A-H, Sec A-H, and maps legacy 1-8 to A-H.

### 1.6 Backend Test Runner Execution
- Execution command: `npm test` inside `functions` (equivalent to `npx jest --runInBand`).
- Execution verified at 2026-09-21T18:05:00Z:
  - Result:
    - `Test Suites: 14 passed, 14 total`
    - `Tests:       204 passed, 204 total`
    - `Snapshots:   0 total`
    - `Time:        56.478 s`
  - Suites executed:
    1. `src/__tests__/sendMail.test.ts`
    2. `src/__tests__/googleTaskActions.test.ts`
    3. `src/__tests__/surveys.test.ts`
    4. `src/__tests__/domainCheck.test.ts`
    5. `src/__tests__/syncDashboard.test.ts`
    6. `src/__tests__/duplicateImport.test.ts`
    7. `src/__tests__/testmail.test.ts`
    8. `src/__tests__/mailDateFormats.test.ts`
    9. `src/__tests__/mailParsing.test.ts`
    10. `src/__tests__/jev.test.ts`
    11. `src/__tests__/eventParsing.test.ts`
    12. `src/__tests__/sanitizeEmailHtml.test.ts`
    13. `src/__tests__/oauthRedirect.test.ts`
    14. `src/__tests__/sharedTimetable.test.ts`

---

## 2. Logic Chain

### 2.1 Waitlist Access Blocking & Invariant Preservation (R1)
- **Observation**: `firestore.rules` (lines 14–20, 38–41, 106) conditions all data reads on `hasPlatformAccess()`, which checks `request.auth.token.email == 'kiran.kumar2028@mastersunion.org' || exists(/databases/$(database)/documents/platformAccess/$(request.auth.token.email))`. Furthermore, `requirePlatformAccess()` in `functions/src/utils/domainCheck.ts:37–50` explicitly checks `platformAccess` document existence and `status === "granted"`.
- **Inference**: A user on the waitlist has a record in `platformWaitlist`, but has NO record in `platformAccess`. As long as no write operation creates or modifies a document in `platformAccess`, and as long as `platformWaitlist.status` remains `"waiting"`, the waitlisted user remains completely blocked from all private platform features (dashboard, mail, personal tasks, Google Tasks, focus).
- **Current Blockade on Calendar Connection**: In `functions/src/auth/connectGoogleAccount.ts`, line 42 (`getGoogleAuthUrl`) calls `requirePlatformAccess(request)`, and lines 129–137 (`connectGoogleAccount` callback) verify `platformAccess` existence.
- **Inference**: Under the current implementation, waitlisted users are entirely prevented from connecting Google Calendar. To satisfy R1, an authenticated waitlist contributor must be allowed to initiate OAuth and complete connection without granting platform access.

### 2.2 Explicit Consent Tracking (R1)
- **Observation**: In `functions/src/access/portal.ts:60–70`, the `"join"` action creates `platformWaitlist/{callerEmail}` with fields `email, uid, displayName, status, joinedAt, updatedAt, program, section, requestedFeatures`. There is NO boolean or timestamp for calendar contribution consent.
- **Inference**: Joining the waitlist does not record consent for syncing calendars. An explicit field (e.g. `calendarConsent: boolean`, `calendarConsentAt: Timestamp`, and `calendarConsentVersion: string`) must be tracked.
- **Inference**: When calendar sync runs, it must verify `calendarConsent === true` on `platformWaitlist/{email}`. Waitlisted users who have not explicitly toggled and submitted consent must not be synced.

### 2.3 Scheduled Sync Inclusions & Isolation (R1)
- **Observation**: `functions/src/sync/scheduledSyncAllUsers.ts:73–76` filters eligible sync users to only those where `user.email === PLATFORM_ADMIN_EMAIL || grantedEmails.has(user.email)`.
- **Inference**: Currently, even if a waitlisted user had connected credentials in `users/{uid}`, `scheduledSyncAllUsers` discards them.
- **Inference**: To satisfy R1, `scheduledSyncAllUsers` must query users who either have platform access OR are waitlisted users with explicit `calendarConsent === true` in `platformWaitlist`.
- **Security Isolation Inference**: For waitlisted contributors, the sync worker MUST ONLY run `syncUserCalendar(uid, syncDays)`. It must NOT run `syncUserMail(uid)` or `syncUserGoogleTasks(uid)`. Additionally, `syncUserCalendar` should avoid writing personal agenda/dashboard documents for waitlisted users, or at minimum, rely on the security rule invariant that `/users/{uid}` is inaccessible.

### 2.4 Event Sanitization Discrepancies (R2)
- **Observation**: Requirement R2 mandates:
  > Store sanitized events in Firebase under a shared calendar collection with only: Section (A-H), Course name, Session title, One-line description, Date, Start/End time, Venue/link, Mode, Event type, and Source update time. Strip all personal data (email, organizer, attendees, private notes).
- **Observation**: In `functions/src/utils/sharedTimetable.ts:14–28`, `toPublicTimetableEvent` performs a shallow spread (`{ ...event }`) and deletes only four properties: `sourceCalendarId`, `faculty`, `organizerName`, `organizerEmail`.
- **Inference**: The existing implementation retains extraneous and potentially sensitive fields:
  - `descriptionExcerpt`: may contain unfiltered attendee discussions, private notes, or unparsed HTML text.
  - `htmlLink`: links directly to Google Calendar event with potential attendee list exposure.
  - `iCalUID`, `googleEventId`: internal calendar provider IDs.
  - `sourceCalendarName`: may contain private labels.
- **Inference**: `toPublicTimetableEvent` must construct a clean object containing ONLY the 10 authorized fields:
  1. `section`: string (A–H)
  2. `course`: string (Course name)
  3. `title`: string (Session title)
  4. `description`: string (One-line cleaned session description)
  5. `date`: string (Formatted date)
  6. `startIso`: string & `endIso`: string (Start/End time)
  7. `venue`: string / `link`: string (Venue or conference link)
  8. `mode`: string ('offline' | 'online' | 'hybrid')
  9. `eventType`: string (Event type)
  10. `updatedAt`: Timestamp (Source update time)

### 2.5 Event Deduplication Discrepancy (R3)
- **Observation**: Requirement R3 mandates:
  > Deduplicate sessions based on a stable fingerprint (section, course, session title, start/end time, venue), keeping the most recent version.
- **Observation**: `functions/src/sync/syncUserCalendar.ts:30–32` generates document IDs via:
  `sharedEventId(calendarId, googleEventId) = sha256(`${calendarId}|${googleEventId}`)`.
- **Inference**: When multiple students from the same section (e.g. Section B) sync their calendars, Google Calendar may assign distinct `googleEventId`s or different source calendar IDs for identical timetable sessions. Under the current code, duplicate records for the same session are written to `sharedCalendarEvents`.
- **Inference**: The document ID (or deduplication key) in `sharedCalendarEvents` must be computed from the content fingerprint:
  `fingerprint = sha256(`${section}|${course}|${title}|${startIso}|${endIso}|${venue}`.toLowerCase().trim())`.
- **Inference**: If an existing document exists with the same fingerprint, it should only be overwritten if the incoming event has a more recent update time.

### 2.6 Firestore Rules & Indexing for Shared Calendar (R5)
- **Observation**: `firestore.indexes.json` contains indexes for `users`, `surveys`, `personalTasks`, `syncJobs`, `calendarEvents`, and `mailSignals`. It contains NO index definition for `sharedCalendarEvents`.
- **Observation**: Frontend component `AgendaList` (`frontend/src/components/dashboard/AgendaList.tsx`) allows filtering by Section (A–H) and Subject within a date range. `subscribeToSharedTimetable` (`frontend/src/lib/firestore.ts:81–102`) queries `sharedCalendarEvents` with `startIso >= fromIso && startIso <= toIso` ordered by `startIso asc`.
- **Inference**: If a query filters by `sectionCode == section` AND range-filters/orders by `startIso`, Firestore requires a composite index:
  Collection: `sharedCalendarEvents`, fields: `sectionCode` (ASCENDING), `startIso` (ASCENDING).
- **Inference**: Missing this index causes Firestore SDK queries to fail with `FAILED_PRECONDITION` or permissions errors.
- **Observation**: In `firestore.rules`, lines 105–108:
  ```javascript
  match /sharedCalendarEvents/{eventId} {
    allow read: if hasPlatformAccess();
    allow write: if false;
  }
  ```
  Only admitted users with `hasPlatformAccess()` can read `sharedCalendarEvents`. Waitlisted users cannot read it. This aligns with R1 ("Waitlisted users must remain blocked from the platform").
- **Observation**: Both named database `default` and `(default)` must receive the rules and indexes as specified in `firebase.json`.

---

## 3. Caveats
1. **Google Workspace Shared Calendar Variations**: Google Calendar invitations and shared departmental calendars may format section names in differing fields (summary vs. description vs. calendar title). While `extractSectionCode` handles "Section A-H", "Sec A-H", and legacy numbers "1-8", non-standard strings (e.g. "Batch 1", "Cohort Alpha") will yield `null` and will not be published to `sharedCalendarEvents`.
2. **Offline Testing vs Live Google API**: In local testing via Jest, Google API calls (`calendarApi.events.list`, `calendarApi.calendarList.list`) and OAuth exchanges are mocked. Live end-to-end testing requires active Google Workspace test tokens.
3. **No Rules Unit Test Harness in Repo**: The codebase currently lacks a dedicated `@firebase/rules-unit-testing` Jest harness for `firestore.rules`. Rule verification is presently validated via Firebase emulator integration or runtime calls.

---

## 4. Conclusion

### Summary Assessment
1. **Waitlist & Access Control Architecture**:
   - The platform access boundary is cleanly enforced at multiple tiers: Firestore Rules (`hasPlatformAccess()`), Cloud Functions callables (`requirePlatformAccess()`), and frontend page guards (`WaitlistGate`).
   - Waitlisted users are safely stored in `platformWaitlist` and denied platform access.
   - **Gap**: There is currently no mechanism for waitlisted users to connect their Google Calendar or submit explicit consent. `getGoogleAuthUrl` and `connectGoogleAccount` reject users without `platformAccess`.
2. **Calendar Sync Pipeline**:
   - `syncUserCalendar` reliably filters out holiday calendars and primary/owned personal calendars using `isSharedCalendar`.
   - `extractSectionCode` correctly maps Section A–H and legacy 1–8 to the 8 standard sections.
   - **Gaps**:
     - `toPublicTimetableEvent` does not enforce the strict 10-field sanitized schema mandated by R2; it retains fields like `descriptionExcerpt` and `htmlLink`.
     - Deduplication in `syncUserCalendar` uses calendar/event ID hashes rather than the stable content fingerprint required by R3 (`section, course, title, start/end, venue`).
     - `scheduledSyncAllUsers` explicitly excludes waitlisted users from the 5-minute background sync loop.
3. **Firestore Configuration & Indexing**:
   - Named database `default` and `(default)` are declared in `firebase.json`.
   - `firestore.indexes.json` requires a composite index for `sharedCalendarEvents` (`sectionCode` ASC, `startIso` ASC) to support section-filtered date queries without permissions/query failures.
4. **Backend Test Suite**:
   - Fully operational via `npm test` in `functions` (14 suites, 204 tests, 100% pass rate).

---

## 5. Verification Method

### 5.1 Backend Test Execution
To verify the entire backend test suite:
```powershell
# From project root
cd d:\Projects\MU-One\functions
npm test
```
**Expected Outcome**: 14 test suites pass, 204 tests pass.

To run specific test suites:
```powershell
cd d:\Projects\MU-One\functions
npx jest src/__tests__/sharedTimetable.test.ts
npx jest src/__tests__/eventParsing.test.ts
npx jest src/__tests__/domainCheck.test.ts
npx jest src/__tests__/syncDashboard.test.ts
```

### 5.2 Verification of Access Control & Rules
1. Inspect `firestore.rules`:
   - Verify `hasPlatformAccess()` checks `exists(/databases/$(database)/documents/platformAccess/$(request.auth.token.email))`.
   - Verify `/sharedCalendarEvents/{eventId}` has `allow read: if hasPlatformAccess(); allow write: if false;`.
   - Verify `/platformAccess` and `/platformWaitlist` deny direct client writes (`allow read, write: if false;`).
2. Verify Named Database Deployment:
   ```powershell
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   Ensures deployment targets both `(default)` and `default` databases as specified in `firebase.json`.

### 5.3 Invalidation Conditions
The findings in this report shall be considered invalidated if:
- Changes are made to `firestore.rules` allowing unauthenticated or non-platform users direct access to `/users/{uid}`.
- Changes to `accessPortal` automatically grant `platformAccess` upon joining the waitlist or granting calendar consent.
- `scheduledSyncAllUsers` is modified to run personal mail or task syncs on waitlisted users.
