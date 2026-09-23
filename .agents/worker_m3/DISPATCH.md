# Milestone 3 Worker Dispatch

## 2026-09-21T18:16:30Z
- **Role**: Milestone 3 Worker (Database Security Rules, Index Configuration & Rules Tests)
- **Working Directory**: d:\Projects\MU-One\.agents\worker_m3
- **Project Root**: d:\Projects\MU-One
- **Original Request**: d:\Projects\MU-One\.agents\ORIGINAL_REQUEST.md
- **Project Spec**: d:\Projects\MU-One\PROJECT.md
- **Orchestrator Conversation ID**: b9706a30-9e99-42c4-a11e-6d85609cc08e

### Assigned File Ownership
You exclusively own and may create/modify:
- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`
- `functions/src/__tests__/firestoreRules.test.ts`
DO NOT modify files outside your ownership boundary.

### Implementation Tasks
1. **Firestore Multi-Database Deployment Configuration (`firebase.json`)**:
   - Ensure `firebase.json` properly declares both `(default)` and named database `default`:
     ```json
     "firestore": [
       { "database": "(default)", "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
       { "database": "default", "rules": "firestore.rules", "indexes": "firestore.indexes.json" }
     ]
     ```
2. **Security Rules Hardening (`firestore.rules`)**:
   - For `hasPlatformAccess()`: Ensure email lookup against `/databases/$(database)/documents/platformAccess/` uses `.lower()` (e.g. `request.auth.token.email.lower()`) to eliminate case-sensitivity mismatches between OAuth provider tokens and stored keys.
   - For `match /sharedCalendarEvents/{eventId}`:
     - `allow read: if hasPlatformAccess();`
     - `allow write: if false;` (Writes strictly disallowed from client SDKs).
   - Ensure `/platformWaitlist` and `/platformAccess` remain completely inaccessible to client SDK reads/writes (`allow read, write: if false;`).
   - Ensure waitlisted users who lack platform access cannot read or write `/sharedCalendarEvents` or `/users/{uid}/*`.
3. **Composite Index Configuration (`firestore.indexes.json`)**:
   - Add composite index for `sharedCalendarEvents`:
     - Collection: `sharedCalendarEvents`
     - Query scope: `COLLECTION`
     - Fields: `sectionCode` ASCENDING, `startIso` ASCENDING
4. **Dedicated Firestore Security Rules Test Suite (`functions/src/__tests__/firestoreRules.test.ts`)**:
   - Create a test suite verifying the rules logic and invariants:
     - Admitted users with platformAccess can read sharedCalendarEvents.
     - Waitlisted users (in platformWaitlist but not in platformAccess) cannot read sharedCalendarEvents and cannot read/write users/{uid}.
     - Client writes to sharedCalendarEvents, platformAccess, and platformWaitlist are completely blocked.
     - Email matching is case-insensitive.
5. **Verification**:
   - Run `npm test` in `functions` and verify that the rules tests and all backend tests pass cleanly.

### Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Deliverable
Write your report in `d:\Projects\MU-One\.agents\worker_m3\handoff.md` and notify the orchestrator via send_message.
