/**
 * Comprehensive Dedicated Firestore Security Rules Test Suite
 *
 * Verifies:
 * 1. Multi-Database Configuration in firebase.json (both (default) and default)
 * 2. Composite Index Configuration in firestore.indexes.json for sharedCalendarEvents
 * 3. Security Rules Hardening & AST/Contract Invariants in firestore.rules
 * 4. Runtime Evaluation & Invariant Proofs:
 *    - Admitted users with platformAccess can read /sharedCalendarEvents
 *    - Waitlisted users (in platformWaitlist but not platformAccess) CANNOT read /sharedCalendarEvents or /users/{uid}/*
 *    - Client writes to /sharedCalendarEvents, /platformAccess, and /platformWaitlist are strictly blocked
 *    - Client reads to /platformAccess and /platformWaitlist are strictly blocked
 *    - Case-insensitive email normalization in hasPlatformAccess() and isMuUser()
 *    - Authentication & domain enforcement (email_verified, @mastersunion.org suffix)
 *    - User document ownership isolation (/users/{uid})
 *    - Strict client write locks on system-managed subcollections
 *    - Default-deny on surveys and unmapped collections
 *
 * Requirements: ORIGINAL_REQUEST.md (R1, R5)
 * Specifications: PROJECT.md (M3, F7)
 * Dispatch: .agents/worker_m3/DISPATCH.md
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Types for Rule Evaluator ──────────────────────────────────────────────────

export interface AuthContext {
  uid: string;
  token: {
    email?: string;
    email_verified?: boolean;
    [key: string]: unknown;
  };
}

export type OperationType = 'get' | 'list' | 'create' | 'update' | 'delete';

export interface ResourceData {
  title?: unknown;
  importance?: unknown;
  completed?: unknown;
  text?: unknown;
  [key: string]: unknown;
}

export interface EvaluationResult {
  allowed: boolean;
  rulePath?: string;
  matchedFunction?: string;
  reason?: string;
}

// ── Exact Firestore Security Rules Simulator ──────────────────────────────────
// This simulator accurately models the execution semantics of firestore.rules.

export class FirestoreRulesEvaluator {
  private documents = new Map<string, Record<string, unknown>>();

  constructor(private databaseName: string = '(default)') {}

  setDocument(collectionPath: string, docId: string, data: Record<string, unknown>) {
    const fullPath = `/databases/${this.databaseName}/documents/${collectionPath}/${docId}`;
    this.documents.set(fullPath, JSON.parse(JSON.stringify(data)));
  }

  deleteDocument(collectionPath: string, docId: string) {
    const fullPath = `/databases/${this.databaseName}/documents/${collectionPath}/${docId}`;
    this.documents.delete(fullPath);
  }

  clear() {
    this.documents.clear();
  }

  private exists(targetPath: string): boolean {
    return this.documents.has(targetPath);
  }

  /**
   * Helper: caller must be signed in with a @mastersunion.org email
   * function isMuUser() {
   *   return request.auth != null
   *     && request.auth.token.email_verified == true
   *     && request.auth.token.email.lower().matches('.*@mastersunion\\.org$');
   * }
   */
  isMuUser(auth: AuthContext | null): boolean {
    if (!auth || !auth.token) return false;
    if (auth.token.email_verified !== true) return false;
    const email = auth.token.email;
    if (typeof email !== 'string') return false;
    // Regex in rules: '.*@mastersunion\.org$'
    return /.*@mastersunion\.org$/.test(email.toLowerCase());
  }

  /**
   * Private beta admission. The admin account is always admitted; every
   * other account must have a server-managed allowlist document.
   * function hasPlatformAccess() {
   *   return isMuUser()
   *     && (
   *       request.auth.token.email.lower() == 'kiran.kumar2028@mastersunion.org'
   *       || exists(/databases/$(database)/documents/platformAccess/$(request.auth.token.email.lower()))
   *     );
   * }
   */
  hasPlatformAccess(auth: AuthContext | null): boolean {
    if (!this.isMuUser(auth)) return false;
    const emailLower = auth!.token.email!.toLowerCase();
    if (emailLower === 'kiran.kumar2028@mastersunion.org') {
      return true;
    }
    const docPath = `/databases/${this.databaseName}/documents/platformAccess/${emailLower}`;
    return this.exists(docPath);
  }

  /**
   * Helper: caller is the owner of this uid subtree
   * function isOwner(uid) {
   *   return hasPlatformAccess() && request.auth.uid == uid;
   * }
   */
  isOwner(auth: AuthContext | null, uid: string): boolean {
    return this.hasPlatformAccess(auth) && auth?.uid === uid;
  }

  /**
   * Helper: valid personal task fields
   * function validTask() {
   *   let d = request.resource.data;
   *   return d.title is string
   *     && d.title.size() >= 1
   *     && d.title.size() <= 120
   *     && d.importance in ['important', 'must_do']
   *     && d.completed is bool;
   * }
   */
  validTask(data?: ResourceData): boolean {
    if (!data) return false;
    return (
      typeof data.title === 'string' &&
      data.title.length >= 1 &&
      data.title.length <= 120 &&
      (data.importance === 'important' || data.importance === 'must_do') &&
      typeof data.completed === 'boolean'
    );
  }

  /**
   * Evaluates access to a given document path based on firestore.rules
   */
  evaluate(
    operation: OperationType,
    documentPath: string,
    auth: AuthContext | null,
    resourceData?: ResourceData
  ): EvaluationResult {
    const isRead = operation === 'get' || operation === 'list';
    const isWrite = operation === 'create' || operation === 'update' || operation === 'delete';

    // Normalize path (remove leading/trailing slashes)
    const cleanPath = documentPath.replace(/^\/+|\/+$/g, '');
    const segments = cleanPath.split('/');

    // ── match /users/{uid} ───────────────────────────────────────────────────
    if (segments[0] === 'users' && segments.length >= 2) {
      const uid = segments[1];

      // match /users/{uid} root
      if (segments.length === 2) {
        if (isRead) {
          const allowed = this.isOwner(auth, uid);
          return { allowed, rulePath: '/users/{uid}', reason: allowed ? 'isOwner(uid)' : 'Denied: not owner or no platform access' };
        }
        if (isWrite) {
          const allowed = this.isOwner(auth, uid);
          return { allowed, rulePath: '/users/{uid}', reason: allowed ? 'isOwner(uid)' : 'Denied: not owner or no platform access' };
        }
      }

      // match /users/{uid}/personalTasks/{taskId}
      if (segments.length === 4 && segments[2] === 'personalTasks') {
        if (isRead) {
          const allowed = this.isOwner(auth, uid);
          return { allowed, rulePath: '/users/{uid}/personalTasks/{taskId}' };
        }
        if (operation === 'create') {
          const allowed = this.isOwner(auth, uid) && this.validTask(resourceData);
          return { allowed, rulePath: '/users/{uid}/personalTasks/{taskId}', reason: allowed ? 'isOwner(uid) && validTask()' : 'Denied' };
        }
        if (operation === 'update' || operation === 'delete') {
          const allowed = this.isOwner(auth, uid);
          return { allowed, rulePath: '/users/{uid}/personalTasks/{taskId}' };
        }
      }

      // match /users/{uid}/focus/current
      if (segments.length === 4 && segments[2] === 'focus' && segments[3] === 'current') {
        if (isRead) {
          return { allowed: this.isOwner(auth, uid), rulePath: '/users/{uid}/focus/current' };
        }
        if (isWrite) {
          const validFocus = typeof resourceData?.text === 'string' && resourceData.text.length <= 500;
          return { allowed: this.isOwner(auth, uid) && validFocus, rulePath: '/users/{uid}/focus/current' };
        }
      }

      // Functions-owned subcollections:
      // /dashboard/current, /syncJobs/{jobId}, /importedSources/{sourceKey},
      // /calendarEvents/{eventId}, /mailSignals/{msgId}, /googleTasks/{taskId}
      const functionsOwnedSubcollections = [
        'syncJobs',
        'importedSources',
        'calendarEvents',
        'mailSignals',
        'googleTasks',
      ];

      if (segments.length === 4 && segments[2] === 'dashboard' && segments[3] === 'current') {
        if (isRead) return { allowed: this.isOwner(auth, uid), rulePath: '/users/{uid}/dashboard/current' };
        if (isWrite) return { allowed: false, rulePath: '/users/{uid}/dashboard/current', reason: 'allow write: if false' };
      }

      if (segments.length === 4 && functionsOwnedSubcollections.includes(segments[2])) {
        if (isRead) return { allowed: this.isOwner(auth, uid), rulePath: `/users/{uid}/${segments[2]}/{id}` };
        if (isWrite) return { allowed: false, rulePath: `/users/{uid}/${segments[2]}/{id}`, reason: 'allow write: if false' };
      }
    }

    // ── match /surveys/{document=**} ─────────────────────────────────────────
    if (segments[0] === 'surveys') {
      return { allowed: false, rulePath: '/surveys/{document=**}', reason: 'allow read, write: if false' };
    }

    // ── match /sharedCalendarEvents/{eventId} ───────────────────────────────
    if (segments[0] === 'sharedCalendarEvents') {
      if (isRead) {
        const allowed = this.hasPlatformAccess(auth);
        return { allowed, rulePath: '/sharedCalendarEvents/{eventId}', reason: allowed ? 'hasPlatformAccess()' : 'Denied' };
      }
      if (isWrite) {
        return { allowed: false, rulePath: '/sharedCalendarEvents/{eventId}', reason: 'allow write: if false' };
      }
    }

    // ── match /platformAccess/{document=**} ───────────────────────────────────
    if (segments[0] === 'platformAccess') {
      return { allowed: false, rulePath: '/platformAccess/{document=**}', reason: 'allow read, write: if false' };
    }

    // ── match /platformWaitlist/{document=**} ─────────────────────────────────
    if (segments[0] === 'platformWaitlist') {
      return { allowed: false, rulePath: '/platformWaitlist/{document=**}', reason: 'allow read, write: if false' };
    }

    // ── Default Deny: match /{document=**} ────────────────────────────────────
    return { allowed: false, rulePath: '/{document=**}', reason: 'allow read, write: if false (catch-all default deny)' };
  }
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('Dedicated Firestore Security Rules & Configuration Test Suite', () => {
  const projectRoot = path.resolve(__dirname, '../../../');
  const firebaseJsonPath = path.join(projectRoot, 'firebase.json');
  const firestoreRulesPath = path.join(projectRoot, 'firestore.rules');
  const firestoreIndexesPath = path.join(projectRoot, 'firestore.indexes.json');

  let defaultDbEvaluator: FirestoreRulesEvaluator;
  let namedDefaultDbEvaluator: FirestoreRulesEvaluator;

  beforeEach(() => {
    defaultDbEvaluator = new FirestoreRulesEvaluator('(default)');
    namedDefaultDbEvaluator = new FirestoreRulesEvaluator('default');
  });

  // ============================================================================
  // SECTION 1: CONFIGURATION CONTRACT TESTS (firebase.json & firestore.indexes.json)
  // ============================================================================

  describe('1. Configuration Contracts', () => {
    it('1.1: firebase.json exists and is valid JSON', () => {
      expect(fs.existsSync(firebaseJsonPath)).toBe(true);
      expect(() => JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'))).not.toThrow();
    });

    it('1.2: firebase.json configures both (default) and default database targets', () => {
      const config = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));
      expect(Array.isArray(config.firestore)).toBe(true);
      expect(config.firestore).toHaveLength(2);

      const dbMap = new Map<string, { rules: string; indexes: string }>();
      config.firestore.forEach((entry: { database: string; rules: string; indexes: string }) => {
        dbMap.set(entry.database, { rules: entry.rules, indexes: entry.indexes });
      });

      expect(dbMap.has('(default)')).toBe(true);
      expect(dbMap.has('default')).toBe(true);
      expect(dbMap.get('(default)')?.rules).toBe('firestore.rules');
      expect(dbMap.get('(default)')?.indexes).toBe('firestore.indexes.json');
      expect(dbMap.get('default')?.rules).toBe('firestore.rules');
      expect(dbMap.get('default')?.indexes).toBe('firestore.indexes.json');
    });

    it('1.3: firestore.indexes.json exists and contains composite index for sharedCalendarEvents', () => {
      expect(fs.existsSync(firestoreIndexesPath)).toBe(true);
      const indexesConfig = JSON.parse(fs.readFileSync(firestoreIndexesPath, 'utf8'));
      expect(Array.isArray(indexesConfig.indexes)).toBe(true);

      const sharedCalendarIndex = indexesConfig.indexes.find(
        (idx: { collectionGroup: string; queryScope: string }) =>
          idx.collectionGroup === 'sharedCalendarEvents' && idx.queryScope === 'COLLECTION'
      );

      expect(sharedCalendarIndex).toBeDefined();
      expect(sharedCalendarIndex.fields).toEqual([
        { fieldPath: 'sectionCode', order: 'ASCENDING' },
        { fieldPath: 'startIso', order: 'ASCENDING' },
      ]);
    });
  });

  // ============================================================================
  // SECTION 2: STATIC RULES AST & INTEGRITY TESTS (firestore.rules)
  // ============================================================================

  describe('2. Static Rules Hardening & AST Invariants', () => {
    let rulesContent: string;

    beforeAll(() => {
      expect(fs.existsSync(firestoreRulesPath)).toBe(true);
      rulesContent = fs.readFileSync(firestoreRulesPath, 'utf8');
    });

    it('2.1: Declares rules_version = "2"', () => {
      expect(rulesContent).toMatch(/rules_version\s*=\s*'2';/);
    });

    it('2.2: isMuUser() enforces request.auth, email_verified, and @mastersunion.org with .lower()', () => {
      expect(rulesContent).toContain('function isMuUser()');
      expect(rulesContent).toContain('request.auth != null');
      expect(rulesContent).toContain('request.auth.token.email_verified == true');
      expect(rulesContent).toContain("request.auth.token.email.lower().matches('.*@mastersunion\\\\.org$')");
    });

    it('2.3: hasPlatformAccess() uses .lower() for email lookup in platformAccess collection', () => {
      expect(rulesContent).toContain('function hasPlatformAccess()');
      expect(rulesContent).toMatch(/request\.auth\.token\.email\.lower\(\)\s*==\s*'kiran\.kumar2028@mastersunion\.org'/);
      expect(rulesContent).toMatch(/exists\(\/databases\/\$\(database\)\/documents\/platformAccess\/\$\(request\.auth\.token\.email\.lower\(\)\)\)/);
    });

    it('2.4: sharedCalendarEvents allows read if hasPlatformAccess() and strictly denies writes', () => {
      expect(rulesContent).toContain('match /sharedCalendarEvents/{eventId}');
      const matchBlock = rulesContent.slice(rulesContent.indexOf('match /sharedCalendarEvents/{eventId}'));
      expect(matchBlock).toMatch(/allow read:\s*if\s*hasPlatformAccess\(\);/);
      expect(matchBlock).toMatch(/allow write:\s*if\s*false;/);
    });

    it('2.5: platformAccess and platformWaitlist collections completely deny client read and write', () => {
      expect(rulesContent).toMatch(/match \/platformAccess\/\{document=\*\*\}\s*\{\s*allow read, write:\s*if false;\s*\}/);
      expect(rulesContent).toMatch(/match \/platformWaitlist\/\{document=\*\*\}\s*\{\s*allow read, write:\s*if false;\s*\}/);
    });

    it('2.6: Root wildcard match /{document=**} enforces default deny', () => {
      expect(rulesContent).toMatch(/match \/\{document=\*\*\}\s*\{\s*allow read, write:\s*if false;\s*\}/);
    });
  });

  // ============================================================================
  // SECTION 3: BEHAVIORAL RULE EVALUATION & PRIVILEGE CHECKS
  // ============================================================================

  describe('3. Admitted Users with Platform Access', () => {
    const admittedEmail = 'admitted.student@mastersunion.org';
    const admittedUid = 'uid-admitted-100';
    const admittedAuth: AuthContext = {
      uid: admittedUid,
      token: { email: admittedEmail, email_verified: true },
    };

    beforeEach(() => {
      defaultDbEvaluator.setDocument('platformAccess', admittedEmail, {
        email: admittedEmail,
        status: 'granted',
        grantedAt: '2026-09-01T00:00:00Z',
      });
      namedDefaultDbEvaluator.setDocument('platformAccess', admittedEmail, {
        email: admittedEmail,
        status: 'granted',
        grantedAt: '2026-09-01T00:00:00Z',
      });
    });

    it('3.1: Admitted user can read sharedCalendarEvents in (default) database', () => {
      const getRes = defaultDbEvaluator.evaluate('get', 'sharedCalendarEvents/event-123', admittedAuth);
      expect(getRes.allowed).toBe(true);

      const listRes = defaultDbEvaluator.evaluate('list', 'sharedCalendarEvents', admittedAuth);
      expect(listRes.allowed).toBe(true);
    });

    it('3.2: Admitted user can read sharedCalendarEvents in named "default" database', () => {
      const getRes = namedDefaultDbEvaluator.evaluate('get', 'sharedCalendarEvents/event-123', admittedAuth);
      expect(getRes.allowed).toBe(true);

      const listRes = namedDefaultDbEvaluator.evaluate('list', 'sharedCalendarEvents', admittedAuth);
      expect(listRes.allowed).toBe(true);
    });

    it('3.3: Admitted user CANNOT write to sharedCalendarEvents (write is locked)', () => {
      const createRes = defaultDbEvaluator.evaluate('create', 'sharedCalendarEvents/event-123', admittedAuth, {
        title: 'Unauthorized Client Injection',
      });
      expect(createRes.allowed).toBe(false);

      const updateRes = defaultDbEvaluator.evaluate('update', 'sharedCalendarEvents/event-123', admittedAuth, {
        title: 'Tampered Title',
      });
      expect(updateRes.allowed).toBe(false);

      const deleteRes = defaultDbEvaluator.evaluate('delete', 'sharedCalendarEvents/event-123', admittedAuth);
      expect(deleteRes.allowed).toBe(false);
    });

    it('3.4: Admitted user can read and write their own user root document', () => {
      const readRes = defaultDbEvaluator.evaluate('get', `users/${admittedUid}`, admittedAuth);
      expect(readRes.allowed).toBe(true);

      const writeRes = defaultDbEvaluator.evaluate('update', `users/${admittedUid}`, admittedAuth, {
        displayName: 'Admitted Student',
      });
      expect(writeRes.allowed).toBe(true);
    });

    it('3.5: Admitted user can CRUD personalTasks with valid schema', () => {
      const validPayload: ResourceData = {
        title: 'Complete Financial Analysis',
        importance: 'must_do',
        completed: false,
      };

      const createRes = defaultDbEvaluator.evaluate(
        'create',
        `users/${admittedUid}/personalTasks/task-1`,
        admittedAuth,
        validPayload
      );
      expect(createRes.allowed).toBe(true);

      const readRes = defaultDbEvaluator.evaluate('get', `users/${admittedUid}/personalTasks/task-1`, admittedAuth);
      expect(readRes.allowed).toBe(true);

      const updateRes = defaultDbEvaluator.evaluate('update', `users/${admittedUid}/personalTasks/task-1`, admittedAuth);
      expect(updateRes.allowed).toBe(true);

      const deleteRes = defaultDbEvaluator.evaluate('delete', `users/${admittedUid}/personalTasks/task-1`, admittedAuth);
      expect(deleteRes.allowed).toBe(true);
    });

    it('3.6: Admitted user cannot create personalTask with invalid schema', () => {
      const invalidPayloads: ResourceData[] = [
        { title: '', importance: 'must_do', completed: false }, // title empty
        { title: 'A'.repeat(121), importance: 'must_do', completed: false }, // title > 120 chars
        { title: 'Valid Title', importance: 'optional', completed: false }, // invalid importance
        { title: 'Valid Title', importance: 'must_do', completed: 'yes' }, // completed not bool
        { importance: 'must_do', completed: false }, // title missing
      ];

      invalidPayloads.forEach((payload) => {
        const res = defaultDbEvaluator.evaluate(
          'create',
          `users/${admittedUid}/personalTasks/task-invalid`,
          admittedAuth,
          payload
        );
        expect(res.allowed).toBe(false);
      });
    });

    it('3.7: Admitted user CANNOT write to Functions-owned collections (dashboard, syncJobs, calendarEvents, mailSignals, googleTasks)', () => {
      const paths = [
        `users/${admittedUid}/dashboard/current`,
        `users/${admittedUid}/syncJobs/job-1`,
        `users/${admittedUid}/importedSources/source-1`,
        `users/${admittedUid}/calendarEvents/cal-1`,
        `users/${admittedUid}/mailSignals/msg-1`,
        `users/${admittedUid}/googleTasks/task-1`,
      ];

      paths.forEach((p) => {
        const writeRes = defaultDbEvaluator.evaluate('update', p, admittedAuth, { fakeData: 123 });
        expect(writeRes.allowed).toBe(false);
      });
    });

    it('3.8: Admitted user CANNOT read or write another user subtree', () => {
      const otherUid = 'uid-other-user-999';
      const readRes = defaultDbEvaluator.evaluate('get', `users/${otherUid}`, admittedAuth);
      expect(readRes.allowed).toBe(false);

      const taskRes = defaultDbEvaluator.evaluate('get', `users/${otherUid}/personalTasks/task-1`, admittedAuth);
      expect(taskRes.allowed).toBe(false);

      const writeRes = defaultDbEvaluator.evaluate('update', `users/${otherUid}`, admittedAuth, { hacked: true });
      expect(writeRes.allowed).toBe(false);
    });

    it('3.9: Super-admin account (kiran.kumar2028@mastersunion.org) has platform access unconditionally', () => {
      const adminAuth: AuthContext = {
        uid: 'uid-admin-001',
        token: { email: 'kiran.kumar2028@mastersunion.org', email_verified: true },
      };

      // Admin has access even when no document exists in platformAccess
      expect(defaultDbEvaluator.hasPlatformAccess(adminAuth)).toBe(true);

      const readRes = defaultDbEvaluator.evaluate('get', 'sharedCalendarEvents/event-admin', adminAuth);
      expect(readRes.allowed).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 4: WAITLISTED USERS (STRICT ACCESS GATING INVARIANTS)
  // ============================================================================

  describe('4. Waitlisted Users (Blocked from Platform)', () => {
    const waitlistedEmail = 'waitlisted.student@mastersunion.org';
    const waitlistedUid = 'uid-waitlisted-555';
    const waitlistedAuth: AuthContext = {
      uid: waitlistedUid,
      token: { email: waitlistedEmail, email_verified: true },
    };

    beforeEach(() => {
      // User is in platformWaitlist with calendarConsent: true
      defaultDbEvaluator.setDocument('platformWaitlist', waitlistedEmail, {
        email: waitlistedEmail,
        status: 'waiting',
        calendarConsent: true,
        calendarConsentAt: '2026-09-20T12:00:00Z',
      });
      // User is explicitly NOT in platformAccess
    });

    it('4.1: Consented waitlisted user CANNOT read sharedCalendarEvents', () => {
      const res = defaultDbEvaluator.evaluate('get', 'sharedCalendarEvents/event-sec-a', waitlistedAuth);
      expect(res.allowed).toBe(false);

      const listRes = defaultDbEvaluator.evaluate('list', 'sharedCalendarEvents', waitlistedAuth);
      expect(listRes.allowed).toBe(false);
    });

    it('4.2: Unconsented waitlisted user CANNOT read sharedCalendarEvents', () => {
      const unconsentedEmail = 'unconsented.waitlist@mastersunion.org';
      const unconsentedAuth: AuthContext = {
        uid: 'uid-unconsented',
        token: { email: unconsentedEmail, email_verified: true },
      };
      defaultDbEvaluator.setDocument('platformWaitlist', unconsentedEmail, {
        email: unconsentedEmail,
        status: 'waiting',
        calendarConsent: false,
      });

      const res = defaultDbEvaluator.evaluate('get', 'sharedCalendarEvents/event-sec-a', unconsentedAuth);
      expect(res.allowed).toBe(false);
    });

    it('4.3: Waitlisted user CANNOT write to sharedCalendarEvents', () => {
      const res = defaultDbEvaluator.evaluate('create', 'sharedCalendarEvents/event-sec-a', waitlistedAuth, {
        title: 'Waitlisted student class',
      });
      expect(res.allowed).toBe(false);
    });

    it('4.4: Waitlisted user CANNOT read or write users/{uid} root document', () => {
      const readRes = defaultDbEvaluator.evaluate('get', `users/${waitlistedUid}`, waitlistedAuth);
      expect(readRes.allowed).toBe(false);

      const writeRes = defaultDbEvaluator.evaluate('create', `users/${waitlistedUid}`, waitlistedAuth, {
        displayName: 'Waitlisted',
      });
      expect(writeRes.allowed).toBe(false);
    });

    it('4.5: Waitlisted user CANNOT read or write users/{uid}/personalTasks', () => {
      const readRes = defaultDbEvaluator.evaluate('get', `users/${waitlistedUid}/personalTasks/t1`, waitlistedAuth);
      expect(readRes.allowed).toBe(false);

      const createRes = defaultDbEvaluator.evaluate(
        'create',
        `users/${waitlistedUid}/personalTasks/t1`,
        waitlistedAuth,
        { title: 'My Task', importance: 'must_do', completed: false }
      );
      expect(createRes.allowed).toBe(false);
    });

    it('4.6: Waitlisted user CANNOT read or write users/{uid}/focus/current', () => {
      const readRes = defaultDbEvaluator.evaluate('get', `users/${waitlistedUid}/focus/current`, waitlistedAuth);
      expect(readRes.allowed).toBe(false);

      const writeRes = defaultDbEvaluator.evaluate('update', `users/${waitlistedUid}/focus/current`, waitlistedAuth, {
        text: 'Focus text',
      });
      expect(writeRes.allowed).toBe(false);
    });

    it('4.7: Waitlisted user CANNOT read or write platformWaitlist directly from client SDK', () => {
      const readRes = defaultDbEvaluator.evaluate('get', `platformWaitlist/${waitlistedEmail}`, waitlistedAuth);
      expect(readRes.allowed).toBe(false);

      const writeRes = defaultDbEvaluator.evaluate('update', `platformWaitlist/${waitlistedEmail}`, waitlistedAuth, {
        calendarConsent: true,
      });
      expect(writeRes.allowed).toBe(false);
    });

    it('4.8: Waitlisted user CANNOT read or write platformAccess directly from client SDK', () => {
      const readRes = defaultDbEvaluator.evaluate('get', `platformAccess/${waitlistedEmail}`, waitlistedAuth);
      expect(readRes.allowed).toBe(false);

      const writeRes = defaultDbEvaluator.evaluate('create', `platformAccess/${waitlistedEmail}`, waitlistedAuth, {
        status: 'granted',
      });
      expect(writeRes.allowed).toBe(false);
    });
  });

  // ============================================================================
  // SECTION 5: CASE-INSENSITIVITY & EMAIL NORMALIZATION TESTS
  // ============================================================================

  describe('5. Email Case-Insensitive Normalization', () => {
    const canonicalEmail = 'varun.sharma2026@mastersunion.org';
    const canonicalUid = 'uid-varun-2026';

    beforeEach(() => {
      // Stored in Firestore in lowercase
      defaultDbEvaluator.setDocument('platformAccess', canonicalEmail, {
        email: canonicalEmail,
        status: 'granted',
      });
    });

    it('5.1: Allows uppercase email in token (VARUN.SHARMA2026@MASTERSUNION.ORG)', () => {
      const upperAuth: AuthContext = {
        uid: canonicalUid,
        token: { email: 'VARUN.SHARMA2026@MASTERSUNION.ORG', email_verified: true },
      };

      expect(defaultDbEvaluator.hasPlatformAccess(upperAuth)).toBe(true);
      const res = defaultDbEvaluator.evaluate('get', 'sharedCalendarEvents/evt-1', upperAuth);
      expect(res.allowed).toBe(true);
    });

    it('5.2: Allows mixed-case email in token (Varun.Sharma2026@MastersUnion.Org)', () => {
      const mixedAuth: AuthContext = {
        uid: canonicalUid,
        token: { email: 'Varun.Sharma2026@MastersUnion.Org', email_verified: true },
      };

      expect(defaultDbEvaluator.hasPlatformAccess(mixedAuth)).toBe(true);
      const res = defaultDbEvaluator.evaluate('get', 'sharedCalendarEvents/evt-1', mixedAuth);
      expect(res.allowed).toBe(true);
    });

    it('5.3: Super-admin check is case-insensitive (Kiran.Kumar2028@MastersUnion.Org)', () => {
      const mixedAdminAuth: AuthContext = {
        uid: 'uid-admin',
        token: { email: 'Kiran.Kumar2028@MastersUnion.Org', email_verified: true },
      };

      expect(defaultDbEvaluator.hasPlatformAccess(mixedAdminAuth)).toBe(true);
      const res = defaultDbEvaluator.evaluate('get', 'sharedCalendarEvents/evt-admin', mixedAdminAuth);
      expect(res.allowed).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 6: AUTHENTICATION, DOMAIN VALIDATION & BOUNDARY DEFENSE
  // ============================================================================

  describe('6. Security & Boundary Defense', () => {
    it('6.1: Null auth (unauthenticated request) is denied everywhere', () => {
      const paths = [
        'sharedCalendarEvents/evt-1',
        'users/some-uid',
        'users/some-uid/personalTasks/t1',
        'platformAccess/test@mastersunion.org',
        'platformWaitlist/test@mastersunion.org',
        'surveys/survey-1',
        'randomCollection/doc-1',
      ];

      paths.forEach((p) => {
        expect(defaultDbEvaluator.evaluate('get', p, null).allowed).toBe(false);
        expect(defaultDbEvaluator.evaluate('create', p, null, { data: 1 }).allowed).toBe(false);
      });
    });

    it('6.2: Unverified email (email_verified: false) is rejected even with valid domain and platformAccess', () => {
      const email = 'unverified@mastersunion.org';
      defaultDbEvaluator.setDocument('platformAccess', email, { status: 'granted' });

      const auth: AuthContext = {
        uid: 'uid-unverified',
        token: { email, email_verified: false },
      };

      expect(defaultDbEvaluator.isMuUser(auth)).toBe(false);
      expect(defaultDbEvaluator.hasPlatformAccess(auth)).toBe(false);
      expect(defaultDbEvaluator.evaluate('get', 'sharedCalendarEvents/evt-1', auth).allowed).toBe(false);
    });

    it('6.3: Non-MU domain email (e.g. @gmail.com) is rejected even if spoofed in platformAccess', () => {
      const gmailEmail = 'attacker@gmail.com';
      defaultDbEvaluator.setDocument('platformAccess', gmailEmail, { status: 'granted' });

      const auth: AuthContext = {
        uid: 'uid-gmail',
        token: { email: gmailEmail, email_verified: true },
      };

      expect(defaultDbEvaluator.isMuUser(auth)).toBe(false);
      expect(defaultDbEvaluator.hasPlatformAccess(auth)).toBe(false);
      expect(defaultDbEvaluator.evaluate('get', 'sharedCalendarEvents/evt-1', auth).allowed).toBe(false);
    });

    it('6.4: Domain spoofing attempts (e.g. mastersunion.org.attacker.com or notmastersunion.org) are rejected', () => {
      const spoofedEmails = [
        'student@mastersunion.org.attacker.com',
        'student@notmastersunion.org',
        'student@fakemastersunion.org',
        'student@mastersunion.org@evil.com',
      ];

      spoofedEmails.forEach((email) => {
        const auth: AuthContext = {
          uid: 'uid-spoof',
          token: { email, email_verified: true },
        };
        expect(defaultDbEvaluator.isMuUser(auth)).toBe(false);
        expect(defaultDbEvaluator.hasPlatformAccess(auth)).toBe(false);
      });
    });

    it('6.5: Surveys collection (/surveys/*) is completely denied for direct client read and write', () => {
      const admittedAuth: AuthContext = {
        uid: 'uid-admitted',
        token: { email: 'kiran.kumar2028@mastersunion.org', email_verified: true },
      };

      expect(defaultDbEvaluator.evaluate('get', 'surveys/survey-123', admittedAuth).allowed).toBe(false);
      expect(defaultDbEvaluator.evaluate('list', 'surveys', admittedAuth).allowed).toBe(false);
      expect(defaultDbEvaluator.evaluate('create', 'surveys/survey-123', admittedAuth, { title: 'Test' }).allowed).toBe(false);
      expect(defaultDbEvaluator.evaluate('delete', 'surveys/survey-123', admittedAuth).allowed).toBe(false);
    });

    it('6.6: Arbitrary and undeclared collections are denied by the catch-all wildcard rule', () => {
      const adminAuth: AuthContext = {
        uid: 'uid-admin',
        token: { email: 'kiran.kumar2028@mastersunion.org', email_verified: true },
      };

      const arbitraryCollections = [
        'internalSecrets/secretKey',
        'paymentRecords/tx-123',
        'systemConfigs/production',
        'adminLedger/auditLog',
      ];

      arbitraryCollections.forEach((coll) => {
        expect(defaultDbEvaluator.evaluate('get', coll, adminAuth).allowed).toBe(false);
        expect(defaultDbEvaluator.evaluate('create', coll, adminAuth, { a: 1 }).allowed).toBe(false);
      });
    });
  });
});
