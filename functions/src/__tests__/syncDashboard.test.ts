/**
 * Tests for syncDashboard callable.
 * Uses Jest mocks to avoid real Firebase/Google API calls.
 */

// ── Mock firebase-admin ────────────────────────────────────────────────────
const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockDocRef = { set: mockSet, update: mockUpdate, get: mockGet, id: "job-001" };
const mockDashRef = { set: mockSet, get: mockGet };

// Build a fake Firestore
const firestoreMock = {
  collection: jest.fn().mockReturnValue({
    doc: jest.fn().mockReturnValue({
      ...mockDocRef,
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue(mockDocRef),
      }),
    }),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: [] }),
  }),
};

jest.mock("firebase-admin", () => ({
  apps: [{}], // pretend already initialized
  initializeApp: jest.fn(),
  firestore: jest.fn().mockReturnValue(firestoreMock),
}));

// Add FieldValue and Timestamp to the mock
const admin = require("firebase-admin");
admin.firestore.FieldValue = {
  serverTimestamp: () => "SERVER_TIMESTAMP",
  delete: () => "DELETE",
};
admin.firestore.Timestamp = {
  now: () => ({ toDate: () => new Date() }),
  fromDate: (d: Date) => ({ toDate: () => d }),
};

// ── Mock sync modules ────────────────────────────────────────────────────────
jest.mock("../sync/syncUserCalendar", () => ({
  syncUserCalendar: jest.fn(),
}));
jest.mock("../sync/syncUserMail", () => ({
  syncUserMail: jest.fn(),
}));
jest.mock("../sync/syncUserGoogleTasks", () => ({
  syncUserGoogleTasks: jest.fn(),
}));

import {
  syncUserCalendar,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
} from "../sync/syncUserCalendar";
import { syncUserMail } from "../sync/syncUserMail";
import { syncUserGoogleTasks } from "../sync/syncUserGoogleTasks";

// ── Mock firebase-functions/v2/https ─────────────────────────────────────────
jest.mock("firebase-functions/v2/https", () => ({
  onCall: (opts: unknown, handler: unknown) => {
    // onCall with options
    if (typeof opts === "function") {
      return { handler: opts };
    }
    return { handler };
  },
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// ── Mock domainCheck ─────────────────────────────────────────────────────────
jest.mock("../utils/domainCheck", () => {
  const requireMuDomain = jest.fn().mockReturnValue("test-uid");
  return {
    requireMuDomain,
    requirePlatformAccess: jest.fn((request: unknown) => Promise.resolve(requireMuDomain(request))),
  };
});

import { requireMuDomain } from "../utils/domainCheck";
const { HttpsError } = require("firebase-functions/v2/https");

// ── Helper ───────────────────────────────────────────────────────────────────

function getHandler(module: { handler?: unknown }): (...args: any[]) => Promise<any> {
  return (typeof module.handler === "function" ? module.handler : module) as (...args: any[]) => Promise<any>;
}

async function callSyncDashboard(dashData: Record<string, unknown> | null) {
  // Set up the mock to return the given dashboard data
  mockGet.mockResolvedValue({
    exists: dashData !== null,
    data: () => dashData ?? {},
  });

  // Load the module dynamically so mocks are in place
  const { syncDashboard } = require("../sync/syncDashboard");
  const handler = getHandler(syncDashboard);

  return handler({ auth: { uid: "test-uid", token: { email: "test@mastersunion.org" } }, data: {} });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("syncDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireMuDomain as jest.Mock).mockReturnValue("test-uid");

    // Default: all syncs succeed
    (syncUserCalendar as jest.Mock).mockResolvedValue({
      calendarsRead: 3,
      eventsNormalized: 15,
      warnings: [],
    });
    (syncUserMail as jest.Mock).mockResolvedValue({
      messagesScanned: 10,
      messagesNormalized: 8,
      warnings: [],
    });
    (syncUserGoogleTasks as jest.Mock).mockResolvedValue({
      listsRead: 2,
      tasksNormalized: 5,
      warnings: [],
    });
  });

  it("rejects non-MU caller", async () => {
    (requireMuDomain as jest.Mock).mockImplementation(() => {
      throw new HttpsError("permission-denied", "Not MU domain");
    });

    await expect(callSyncDashboard(null)).rejects.toThrow();
    try {
      await callSyncDashboard(null);
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe("permission-denied");
    }
  });

  it("skips a second automatic sync when the dashboard was just synced", async () => {
    const recentSync = new Date(Date.now() - 30 * 1000); // 30 seconds ago (within 60s cooldown)
    const dashData = {
      sync: {
        lastCompletedAt: {
          toDate: () => recentSync,
        },
        status: "ok",
      },
    };

    mockGet.mockResolvedValue({
      exists: true,
      data: () => dashData,
    });

    const { syncDashboard } = require("../sync/syncDashboard");
    const handler =
      typeof syncDashboard.handler === "function"
        ? syncDashboard.handler
        : syncDashboard;

    const result = await handler({
      auth: { uid: "test-uid", token: { email: "test@mastersunion.org" } },
      data: {},
    });

    expect(result.status).toBe("up_to_date");
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(mockSet).not.toHaveBeenCalled();
    expect(syncUserCalendar).not.toHaveBeenCalled();
  });

  it("rate-limits a forced sync within the 15-second manual cooldown", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        sync: { lastCompletedAt: { toDate: () => new Date(Date.now() - 5_000) } },
      }),
    });

    const { syncDashboard } = require("../sync/syncDashboard");
    await expect(getHandler(syncDashboard)({
      auth: { uid: "test-uid", token: { email: "test@mastersunion.org" } },
      data: { force: true },
    })).rejects.toMatchObject({ code: "resource-exhausted" });
  });

  it("writes sync status to Firestore during sync", async () => {
    mockGet.mockResolvedValue({ exists: false, data: () => ({}) });

    const { syncDashboard } = require("../sync/syncDashboard");
    const handler = getHandler(syncDashboard);

    await handler({
      auth: { uid: "test-uid", token: { email: "test@mastersunion.org" } },
      data: {},
    });

    // set should have been called to mark sync as "syncing"
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ sync: expect.objectContaining({ status: "syncing" }) }),
      expect.anything()
    );
  });

  it("one source failure does not clear other source data", async () => {
    // Mail sync fails
    (syncUserMail as jest.Mock).mockRejectedValue(new Error("Gmail API error"));
    mockGet.mockResolvedValue({ exists: false, data: () => ({}) });

    const { syncDashboard } = require("../sync/syncDashboard");
    const handler = getHandler(syncDashboard);

    const result = await handler({
      auth: { uid: "test-uid", token: { email: "test@mastersunion.org" } },
      data: {},
    });

    // Should complete with partial_error status
    expect(result.status).toBe("partial_error");

    // Calendar and tasks syncs should still have run
    expect(syncUserCalendar).toHaveBeenCalled();
    expect(syncUserGoogleTasks).toHaveBeenCalled();

    // Firestore set should have been called with partial source health
    const lastSetCall = mockSet.mock.calls[mockSet.mock.calls.length - 1];
    const setData = lastSetCall[0] as Record<string, unknown>;
    const health = setData["sourceHealth"] as Record<string, string> | undefined;
    if (health) {
      expect(health["calendar"]).toBe("ok");
      expect(health["mail"]).toBe("error");
      expect(health["tasks"]).toBe("ok");
    }
  });
});
