/**
 * Comprehensive Unit Test Suite for Waitlist Calendar Consent, OAuth Authorization & Sync Isolation
 *
 * Requirements: ORIGINAL_REQUEST.md (R1)
 * Specifications: PROJECT.md (Features F1, F2, F12, Interface Contracts §1)
 * Dispatch: .agents/worker_m1/DISPATCH.md
 *
 * Invariants Tested:
 *  1. Consent tracking: calendarConsent is explicitly stored and toggled on platformWaitlist/{email}.
 *  2. Joining the waitlist does NOT equal consent (defaults to false).
 *  3. Consented waitlist users NEVER receive platformAccess records (remain strictly blocked).
 *  4. Non-consented waitlist users are blocked from connecting Google Calendar.
 *  5. Consented waitlist users can connect Google Calendar and redirect to waitlist gate with ?google=connected.
 *  6. Calendar sync isolation: For waitlisted contributors, syncUserCalendar IS executed,
 *     while syncUserMail and syncUserGoogleTasks are NEVER executed.
 *  7. Lifecycle transitions: Consent granted -> syncs; consent revoked -> excluded from sync.
 */

// ── In-Memory Firestore Mock Implementation ─────────────────────────────────

interface MockDocData {
  [key: string]: unknown;
}

class MemoryStore {
  collections = new Map<string, Map<string, MockDocData>>();

  getCollection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    return this.collections.get(name)!;
  }

  getDoc(coll: string, id: string): MockDocData | null {
    const map = this.getCollection(coll);
    const data = map.get(id);
    return data ? JSON.parse(JSON.stringify(data)) : null;
  }

  setDoc(coll: string, id: string, data: MockDocData, merge = false) {
    const map = this.getCollection(coll);
    const existing = map.get(id);
    if (existing && merge) {
      map.set(id, { ...existing, ...JSON.parse(JSON.stringify(data)) });
    } else {
      map.set(id, JSON.parse(JSON.stringify(data)));
    }
  }

  updateDoc(coll: string, id: string, updates: Record<string, unknown>) {
    const map = this.getCollection(coll);
    const existing = map.get(id) || {};
    const updated = { ...existing };
    for (const [k, v] of Object.entries(updates)) {
      if (k.includes('.')) {
        const parts = k.split('.');
        let curr: any = updated;
        for (let i = 0; i < parts.length - 1; i++) {
          curr[parts[i]] = curr[parts[i]] || {};
          curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = v;
      } else {
        updated[k] = v;
      }
    }
    map.set(id, updated);
  }

  deleteDoc(coll: string, id: string) {
    this.getCollection(coll).delete(id);
  }

  clear() {
    this.collections.clear();
  }
}

const memoryStore = new MemoryStore();

function createMockDocRef(collName: string, docId: string): any {
  return {
    id: docId,
    get: jest.fn().mockImplementation(async () => {
      const data = memoryStore.getDoc(collName, docId);
      return {
        exists: data !== null,
        id: docId,
        data: () => data ?? {},
        get: (field: string) => {
          if (!data) return undefined;
          if (field.includes('.')) {
            const parts = field.split('.');
            let curr: any = data;
            for (const p of parts) {
              if (curr == null) return undefined;
              curr = curr[p];
            }
            return curr;
          }
          return data[field];
        },
      };
    }),
    set: jest.fn().mockImplementation(async (data: any, options?: { merge?: boolean }) => {
      memoryStore.setDoc(collName, docId, data, options?.merge ?? false);
    }),
    update: jest.fn().mockImplementation(async (updates: any) => {
      memoryStore.updateDoc(collName, docId, updates);
    }),
    delete: jest.fn().mockImplementation(async () => {
      memoryStore.deleteDoc(collName, docId);
    }),
    collection: (subCollName: string) => createMockCollectionRef(`${collName}/${docId}/${subCollName}`),
  };
}

function createMockCollectionRef(collName: string): any {
  return {
    doc: (docId: string) => createMockDocRef(collName, docId),
    where: (field: string, op: string, val: any) => createMockQuery(collName, [{ field, op, val }]),
    orderBy: () => createMockQuery(collName, []),
    limit: (n: number) => createMockQuery(collName, [], n),
    get: async () => createMockQuery(collName, []).get(),
  };
}

function createMockQuery(collName: string, filters: Array<{ field: string; op: string; val: any }>, limitNum?: number): any {
  return {
    where: (field: string, op: string, val: any) =>
      createMockQuery(collName, [...filters, { field, op, val }], limitNum),
    orderBy: () => createMockQuery(collName, filters, limitNum),
    limit: (n: number) => createMockQuery(collName, filters, n),
    get: async () => {
      const coll = memoryStore.getCollection(collName);
      let docs: any[] = [];
      for (const [id, data] of coll.entries()) {
        let match = true;
        for (const f of filters) {
          let actualVal: any;
          if (f.field.includes('.')) {
            const parts = f.field.split('.');
            let curr: any = data;
            for (const p of parts) {
              if (curr == null) break;
              curr = curr[p];
            }
            actualVal = curr;
          } else {
            actualVal = data[f.field];
          }
          if (f.op === '==' && actualVal !== f.val) match = false;
        }
        if (match) {
          docs.push({
            id,
            data: () => JSON.parse(JSON.stringify(data)),
            get: (field: string) => {
              if (field.includes('.')) {
                const parts = field.split('.');
                let curr: any = data;
                for (const p of parts) {
                  if (curr == null) return undefined;
                  curr = curr[p];
                }
                return curr;
              }
              return data[field];
            },
          });
        }
      }
      if (limitNum && limitNum > 0) {
        docs = docs.slice(0, limitNum);
      }
      return { docs, size: docs.length, empty: docs.length === 0 };
    },
  };
}

const mockDb = {
  collection: (collName: string) => createMockCollectionRef(collName),
  getAll: async (...docRefs: any[]) => {
    return Promise.all(docRefs.map(ref => ref.get()));
  },
  batch: () => {
    const operations: Array<() => Promise<void>> = [];
    return {
      set: (docRef: any, data: any, opts?: any) => {
        operations.push(() => docRef.set(data, opts));
      },
      delete: (docRef: any) => {
        operations.push(() => docRef.delete());
      },
      commit: async () => {
        for (const op of operations) await op();
      },
    };
  },
};

// ── Mock Dependencies ───────────────────────────────────────────────────────

jest.mock('../utils/getDb', () => ({
  getDb: () => mockDb,
}));

jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  return {
    ...actualAdmin,
    apps: [{}],
    initializeApp: jest.fn(),
    firestore: Object.assign(() => mockDb, {
      FieldValue: {
        serverTimestamp: () => 'MOCK_SERVER_TIMESTAMP',
        delete: () => 'MOCK_DELETE',
      },
      Timestamp: {
        now: () => ({
          toMillis: () => Date.now(),
          toDate: () => new Date(),
        }),
        fromDate: (d: Date) => ({
          toMillis: () => d.getTime(),
          toDate: () => d,
        }),
      },
    }),
    auth: () => ({
      getUser: jest.fn(async (uid: string) => {
        const userDoc = memoryStore.getDoc('users', uid);
        return {
          uid,
          email: userDoc?.email || `${uid}@mastersunion.org`,
          displayName: userDoc?.displayName || 'Test User',
          photoURL: '',
        };
      }),
    }),
  };
});

// Mock Google auth library
const mockGetToken = jest.fn();
const mockGetTokenInfo = jest.fn();
const mockGenerateAuthUrl = jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?mock=true');
const mockSetCredentials = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: mockGetToken,
    getTokenInfo: mockGetTokenInfo,
    setCredentials: mockSetCredentials,
  })),
}));

// Mock tokenStore
const mockStoreTokens = jest.fn().mockResolvedValue(undefined);
jest.mock('../auth/tokenStore', () => ({
  storeTokens: (...args: any[]) => mockStoreTokens(...args),
  getAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
}));

// Mock sync modules
const mockSyncUserCalendar = jest.fn().mockResolvedValue({
  calendarsRead: 1,
  eventsNormalized: 5,
  warnings: [],
});
const mockSyncUserMail = jest.fn().mockResolvedValue({
  messagesScanned: 5,
  messagesNormalized: 4,
  warnings: [],
});
const mockSyncUserGoogleTasks = jest.fn().mockResolvedValue({
  listsRead: 1,
  tasksNormalized: 2,
  warnings: [],
});

jest.mock('../sync/syncUserCalendar', () => ({
  syncUserCalendar: (...args: any[]) => mockSyncUserCalendar(...args),
}));
jest.mock('../sync/syncUserMail', () => ({
  syncUserMail: (...args: any[]) => mockSyncUserMail(...args),
}));
jest.mock('../sync/syncUserGoogleTasks', () => ({
  syncUserGoogleTasks: (...args: any[]) => mockSyncUserGoogleTasks(...args),
}));

// Mock resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'msg-1' }) },
  })),
}));

// Mock firebase-functions/v2
jest.mock('firebase-functions/v2/https', () => {
  return {
    onCall: (optsOrHandler: any, maybeHandler?: any) => {
      const handler = typeof optsOrHandler === 'function' ? optsOrHandler : maybeHandler;
      return Object.assign(handler, { run: handler });
    },
    onRequest: (optsOrHandler: any, maybeHandler?: any) => {
      const handler = typeof optsOrHandler === 'function' ? optsOrHandler : maybeHandler;
      return Object.assign(handler, { run: handler });
    },
    HttpsError: class HttpsError extends Error {
      code: string;
      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    },
  };
});

jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (optsOrHandler: any, maybeHandler?: any) => {
    const handler = typeof optsOrHandler === 'function' ? optsOrHandler : maybeHandler;
    return Object.assign(handler, { run: handler });
  },
}));

// ── Import Target Modules Under Test ────────────────────────────────────────

import { accessPortal } from '../access/portal';
import { getGoogleAuthUrl, connectGoogleAccount } from '../auth/connectGoogleAccount';
import { scheduledSyncAllUsers } from '../sync/scheduledSyncAllUsers';
import { PLATFORM_ADMIN_EMAIL } from '../utils/domainCheck';

// ── Helper to construct Callable Requests ───────────────────────────────────

function createCallableRequest(uid: string | null, email: string | null, data: Record<string, unknown> = {}): any {
  if (!uid || !email) {
    return { auth: null, data };
  }
  return {
    auth: {
      uid,
      token: {
        email,
        uid,
        name: 'Student Name',
      },
    },
    data,
  };
}

// ── Test Suites ─────────────────────────────────────────────────────────────

describe('Milestone 1: Waitlist Consent, OAuth Authorization & Sync Isolation', () => {
  beforeEach(() => {
    memoryStore.clear();
    jest.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Waitlist Consent Management (portal.ts)
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Waitlist Consent Management (portal.ts)', () => {
    const studentEmail = 'student.waitlist@mastersunion.org';
    const studentUid = 'uid-waitlist-1';

    it('1.1: Action "status" returns calendarConsent: false for non-consented waitlist user', async () => {
      memoryStore.setDoc('platformWaitlist', studentEmail, {
        email: studentEmail,
        status: 'waiting',
        calendarConsent: false,
      });

      const req = createCallableRequest(studentUid, studentEmail, { action: 'status' });
      const res = await (accessPortal as any).run(req);

      expect(res.hasAccess).toBe(false);
      expect(res.waitlistStatus).toBe('waiting');
      expect(res.calendarConsent).toBe(false);
    });

    it('1.2: Action "status" returns calendarConsent: true when consent was granted', async () => {
      memoryStore.setDoc('platformWaitlist', studentEmail, {
        email: studentEmail,
        status: 'waiting',
        calendarConsent: true,
      });

      const req = createCallableRequest(studentUid, studentEmail, { action: 'status' });
      const res = await (accessPortal as any).run(req);

      expect(res.hasAccess).toBe(false);
      expect(res.waitlistStatus).toBe('waiting');
      expect(res.calendarConsent).toBe(true);
    });

    it('1.3: INVARIANT: Joining the waitlist does NOT equal consent (defaults to false)', async () => {
      const req = createCallableRequest(studentUid, studentEmail, {
        action: 'join',
        program: 'TBM',
        section: 'B',
      });
      const res = await (accessPortal as any).run(req);

      expect(res.success).toBe(true);
      expect(res.status).toBe('waiting');

      const waitlistDoc = memoryStore.getDoc('platformWaitlist', studentEmail);
      expect(waitlistDoc).not.toBeNull();
      expect(waitlistDoc?.calendarConsent).toBe(false);

      // INVARIANT: Under NO circumstance may platformAccess records be created!
      const accessDoc = memoryStore.getDoc('platformAccess', studentEmail);
      expect(accessDoc).toBeNull();
    });

    it('1.4: Action "join" records explicit consent when passed in parameters', async () => {
      const req = createCallableRequest(studentUid, studentEmail, {
        action: 'join',
        program: 'YLC',
        section: 'A',
        calendarConsent: true,
      });
      const res = await (accessPortal as any).run(req);

      expect(res.success).toBe(true);
      expect(res.calendarConsent).toBe(true);

      const waitlistDoc = memoryStore.getDoc('platformWaitlist', studentEmail);
      expect(waitlistDoc?.calendarConsent).toBe(true);
      expect(waitlistDoc?.calendarConsentAt).toBeDefined();

      // INVARIANT: Still no platform access granted
      const accessDoc = memoryStore.getDoc('platformAccess', studentEmail);
      expect(accessDoc).toBeNull();
    });

    it('1.5: Action "updateCalendarConsent" updates consent and timestamp in platformWaitlist', async () => {
      memoryStore.setDoc('platformWaitlist', studentEmail, {
        email: studentEmail,
        status: 'waiting',
        calendarConsent: false,
      });

      const req = createCallableRequest(studentUid, studentEmail, {
        action: 'updateCalendarConsent',
        consent: true,
      });
      const res = await (accessPortal as any).run(req);

      expect(res).toEqual({ success: true, calendarConsent: true });

      const waitlistDoc = memoryStore.getDoc('platformWaitlist', studentEmail);
      expect(waitlistDoc?.calendarConsent).toBe(true);
      expect(waitlistDoc?.calendarConsentAt).toBe('MOCK_SERVER_TIMESTAMP');

      // CRITICAL INVARIANT: NEVER write to platformAccess!
      const accessDoc = memoryStore.getDoc('platformAccess', studentEmail);
      expect(accessDoc).toBeNull();
    });

    it('1.6: Action "updateCalendarConsent" can revoke consent', async () => {
      memoryStore.setDoc('platformWaitlist', studentEmail, {
        email: studentEmail,
        status: 'waiting',
        calendarConsent: true,
      });

      const req = createCallableRequest(studentUid, studentEmail, {
        action: 'updateCalendarConsent',
        consent: false,
      });
      const res = await (accessPortal as any).run(req);

      expect(res).toEqual({ success: true, calendarConsent: false });

      const waitlistDoc = memoryStore.getDoc('platformWaitlist', studentEmail);
      expect(waitlistDoc?.calendarConsent).toBe(false);
    });

    it('1.7: Admin action "list" reports calendarConsent for all waitlist entries', async () => {
      memoryStore.setDoc('platformWaitlist', 'user1@mastersunion.org', {
        email: 'user1@mastersunion.org',
        calendarConsent: true,
      });
      memoryStore.setDoc('platformWaitlist', 'user2@mastersunion.org', {
        email: 'user2@mastersunion.org',
        calendarConsent: false,
      });

      const req = createCallableRequest('admin-uid', PLATFORM_ADMIN_EMAIL, { action: 'list' });
      const res = await (accessPortal as any).run(req);

      const u1 = res.waitlist.find((w: any) => w.email === 'user1@mastersunion.org');
      const u2 = res.waitlist.find((w: any) => w.email === 'user2@mastersunion.org');

      expect(u1?.calendarConsent).toBe(true);
      expect(u2?.calendarConsent).toBe(false);
    });

    it('1.8: Rejects unauthenticated or non-MU domain callers for updateCalendarConsent', async () => {
      const unauthReq = createCallableRequest(null, null, { action: 'updateCalendarConsent', consent: true });
      await expect((accessPortal as any).run(unauthReq)).rejects.toThrow();

      const gmailReq = createCallableRequest('g-uid', 'user@gmail.com', { action: 'updateCalendarConsent', consent: true });
      await expect((accessPortal as any).run(gmailReq)).rejects.toThrow();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Google OAuth Authorization for Consented Waitlist (connectGoogleAccount.ts)
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Google OAuth Authorization for Consented Waitlist (connectGoogleAccount.ts)', () => {
    const admittedEmail = 'admitted.student@mastersunion.org';
    const admittedUid = 'uid-admitted-1';
    const consentedWaitlistEmail = 'consented.waitlist@mastersunion.org';
    const consentedWaitlistUid = 'uid-waitlist-consented';
    const unconsentedWaitlistEmail = 'unconsented.waitlist@mastersunion.org';
    const unconsentedWaitlistUid = 'uid-waitlist-unconsented';

    beforeEach(() => {
      // Setup user documents in users collection for auth().getUser
      memoryStore.setDoc('users', admittedUid, {
        uid: admittedUid,
        email: admittedEmail,
        displayName: 'Admitted Student',
      });
      // Setup admitted student
      memoryStore.setDoc('platformAccess', admittedEmail, {
        email: admittedEmail,
        status: 'granted',
      });

      // Setup consented waitlist student
      memoryStore.setDoc('users', consentedWaitlistUid, {
        uid: consentedWaitlistUid,
        email: consentedWaitlistEmail,
        displayName: 'Consented Waitlist Student',
      });
      memoryStore.setDoc('platformWaitlist', consentedWaitlistEmail, {
        email: consentedWaitlistEmail,
        status: 'waiting',
        calendarConsent: true,
      });

      // Setup unconsented waitlist student
      memoryStore.setDoc('users', unconsentedWaitlistUid, {
        uid: unconsentedWaitlistUid,
        email: unconsentedWaitlistEmail,
        displayName: 'Unconsented Waitlist Student',
      });
      memoryStore.setDoc('platformWaitlist', unconsentedWaitlistEmail, {
        email: unconsentedWaitlistEmail,
        status: 'waiting',
        calendarConsent: false,
      });
    });

    it('2.1: getGoogleAuthUrl allows admitted student with platformAccess', async () => {
      const req = createCallableRequest(admittedUid, admittedEmail);
      const res = await (getGoogleAuthUrl as any).run(req);

      expect(res.authUrl).toContain('https://accounts.google.com');
      expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({ state: admittedUid })
      );
    });

    it('2.2: getGoogleAuthUrl allows consented waitlist user (calendarConsent === true)', async () => {
      const req = createCallableRequest(consentedWaitlistUid, consentedWaitlistEmail);
      const res = await (getGoogleAuthUrl as any).run(req);

      expect(res.authUrl).toContain('https://accounts.google.com');
      expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({ state: consentedWaitlistUid })
      );
    });

    it('2.3: getGoogleAuthUrl BLOCKS unconsented waitlist user (permission-denied)', async () => {
      const req = createCallableRequest(unconsentedWaitlistUid, unconsentedWaitlistEmail);

      await expect((getGoogleAuthUrl as any).run(req)).rejects.toThrow();
      try {
        await (getGoogleAuthUrl as any).run(req);
      } catch (err: any) {
        expect(err.code).toBe('permission-denied');
      }
    });

    it('2.4: getGoogleAuthUrl BLOCKS random user with neither access nor waitlist consent', async () => {
      const randomEmail = 'stranger@mastersunion.org';
      const req = createCallableRequest('uid-stranger', randomEmail);

      await expect((getGoogleAuthUrl as any).run(req)).rejects.toThrow();
      try {
        await (getGoogleAuthUrl as any).run(req);
      } catch (err: any) {
        expect(err.code).toBe('permission-denied');
      }
    });

    it('2.5: connectGoogleAccount redirects consented waitlist user to waitlist gate with ?google=connected', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'valid-access-token',
          refresh_token: 'valid-refresh-token',
          expiry_date: Date.now() + 3600_000,
          scope: 'https://www.googleapis.com/auth/calendar',
        },
      });
      mockGetTokenInfo.mockResolvedValue({ email: consentedWaitlistEmail });

      const req: any = {
        query: { code: 'auth-code-123', state: consentedWaitlistUid },
      };
      const redirectedUrls: string[] = [];
      const res: any = {
        redirect: (url: string) => redirectedUrls.push(url),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await (connectGoogleAccount as any).run(req, res);

      expect(redirectedUrls.length).toBe(1);
      const targetUrl = new URL(redirectedUrls[0]);
      expect(targetUrl.searchParams.get('google')).toBe('connected');

      // Verify tokens stored
      expect(mockStoreTokens).toHaveBeenCalledWith(
        consentedWaitlistUid,
        'valid-refresh-token',
        'valid-access-token',
        expect.any(Date),
        expect.any(Array)
      );

      // Verify user document updated with googleConnection.connected = true
      const userDoc = memoryStore.getDoc('users', consentedWaitlistUid);
      expect((userDoc?.googleConnection as any)?.connected).toBe(true);

      // CRITICAL INVARIANT: NEVER grant platformAccess record!
      const accessDoc = memoryStore.getDoc('platformAccess', consentedWaitlistEmail);
      expect(accessDoc).toBeNull();
    });

    it('2.6: connectGoogleAccount rejects unconsented waitlist user with access_not_granted', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'valid-access-token',
          refresh_token: 'valid-refresh-token',
          expiry_date: Date.now() + 3600_000,
        },
      });
      mockGetTokenInfo.mockResolvedValue({ email: unconsentedWaitlistEmail });

      const req: any = {
        query: { code: 'auth-code-456', state: unconsentedWaitlistUid },
      };
      const redirectedUrls: string[] = [];
      const res: any = {
        redirect: (url: string) => redirectedUrls.push(url),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await (connectGoogleAccount as any).run(req, res);

      expect(redirectedUrls.length).toBe(1);
      expect(redirectedUrls[0]).toContain('reason=access_not_granted');

      // Tokens should not be stored
      expect(mockStoreTokens).not.toHaveBeenCalled();
    });

    it('2.7: connectGoogleAccount redirects admitted student with standard dashboard success', async () => {
      mockGetToken.mockResolvedValue({
        tokens: {
          access_token: 'valid-access-token',
          refresh_token: 'valid-refresh-token',
          expiry_date: Date.now() + 3600_000,
        },
      });
      mockGetTokenInfo.mockResolvedValue({ email: admittedEmail });

      const req: any = {
        query: { code: 'auth-code-789', state: admittedUid },
      };
      const redirectedUrls: string[] = [];
      const res: any = {
        redirect: (url: string) => redirectedUrls.push(url),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await (connectGoogleAccount as any).run(req, res);

      expect(redirectedUrls.length).toBe(1);
      expect(redirectedUrls[0]).toContain('google_connect=success');
      expect(redirectedUrls[0]).not.toContain('google=connected');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Calendar Sync Isolation in scheduledSyncAllUsers
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Calendar Sync Isolation (scheduledSyncAllUsers.ts)', () => {
    const waitlistContributorEmail = 'waitlist.sync@mastersunion.org';
    const waitlistContributorUid = 'uid-waitlist-sync';

    const unconsentedEmail = 'unconsented.sync@mastersunion.org';
    const unconsentedUid = 'uid-unconsented-sync';

    const admittedEmail = 'admitted.sync@mastersunion.org';
    const admittedUid = 'uid-admitted-sync';

    beforeEach(() => {
      // 1. Waitlist contributor with consent & connected google
      memoryStore.setDoc('users', waitlistContributorUid, {
        uid: waitlistContributorUid,
        email: waitlistContributorEmail,
        googleConnection: {
          connected: true,
          lastSyncAt: null,
        },
      });
      memoryStore.setDoc('platformWaitlist', waitlistContributorEmail, {
        email: waitlistContributorEmail,
        status: 'waiting',
        calendarConsent: true,
      });

      // 2. Unconsented waitlist user with connected google
      memoryStore.setDoc('users', unconsentedUid, {
        uid: unconsentedUid,
        email: unconsentedEmail,
        googleConnection: {
          connected: true,
          lastSyncAt: null,
        },
      });
      memoryStore.setDoc('platformWaitlist', unconsentedEmail, {
        email: unconsentedEmail,
        status: 'waiting',
        calendarConsent: false,
      });

      // 3. Admitted user with connected google
      memoryStore.setDoc('users', admittedUid, {
        uid: admittedUid,
        email: admittedEmail,
        googleConnection: {
          connected: true,
          lastSyncAt: null,
        },
      });
      memoryStore.setDoc('platformAccess', admittedEmail, {
        email: admittedEmail,
        status: 'granted',
      });
    });

    it('3.1: ISOLATION INVARIANT: Executes syncUserCalendar ONLY for waitlisted contributors (NEVER mail or tasks)', async () => {
      await (scheduledSyncAllUsers as any).run({});

      // syncUserCalendar must be called for BOTH admitted user and waitlist contributor
      expect(mockSyncUserCalendar).toHaveBeenCalledWith(waitlistContributorUid, expect.any(Number));
      expect(mockSyncUserCalendar).toHaveBeenCalledWith(admittedUid, expect.any(Number));

      // syncUserMail must ONLY be called for admitted user, NEVER for waitlist contributor!
      expect(mockSyncUserMail).toHaveBeenCalledWith(admittedUid);
      expect(mockSyncUserMail).not.toHaveBeenCalledWith(waitlistContributorUid);

      // syncUserGoogleTasks must ONLY be called for admitted user, NEVER for waitlist contributor!
      expect(mockSyncUserGoogleTasks).toHaveBeenCalledWith(admittedUid);
      expect(mockSyncUserGoogleTasks).not.toHaveBeenCalledWith(waitlistContributorUid);
    });

    it('3.2: Non-consented waitlisted users are strictly EXCLUDED from scheduled sync', async () => {
      await (scheduledSyncAllUsers as any).run({});

      expect(mockSyncUserCalendar).not.toHaveBeenCalledWith(unconsentedUid, expect.any(Number));
      expect(mockSyncUserMail).not.toHaveBeenCalledWith(unconsentedUid);
      expect(mockSyncUserGoogleTasks).not.toHaveBeenCalledWith(unconsentedUid);
    });

    it('3.3: Lifecycle Transition: When waitlist contributor revokes consent, sync stops executing', async () => {
      // Phase 1: Consent active -> sync runs
      await (scheduledSyncAllUsers as any).run({});
      expect(mockSyncUserCalendar).toHaveBeenCalledWith(waitlistContributorUid, expect.any(Number));

      // Reset mocks and state for Phase 2
      jest.clearAllMocks();
      memoryStore.setDoc('platformWaitlist', waitlistContributorEmail, {
        email: waitlistContributorEmail,
        calendarConsent: false,
      });
      // Reset lastSyncAt to trigger eligibility
      memoryStore.updateDoc('users', waitlistContributorUid, {
        'googleConnection.lastSyncAt': null,
      });

      // Phase 2: Revoked consent -> sync skips contributor
      await (scheduledSyncAllUsers as any).run({});
      expect(mockSyncUserCalendar).not.toHaveBeenCalledWith(waitlistContributorUid, expect.any(Number));
      expect(mockSyncUserMail).not.toHaveBeenCalledWith(waitlistContributorUid);
      expect(mockSyncUserGoogleTasks).not.toHaveBeenCalledWith(waitlistContributorUid);
    });

    it('3.4: Waitlisted contributors remain blocked from platform throughout sync lifecycle', async () => {
      await (scheduledSyncAllUsers as any).run({});

      // Verify no platformAccess document was generated during or after sync
      const accessDoc = memoryStore.getDoc('platformAccess', waitlistContributorEmail);
      expect(accessDoc).toBeNull();
    });
  });
});
