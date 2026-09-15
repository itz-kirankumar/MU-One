/**
 * Tests for Google Task action callables.
 * Verifies that Firestore is NOT updated on API failure.
 */
export {};

// ── Mock firebase-admin ────────────────────────────────────────────────────
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn();

const firestoreMock = {
  collection: jest.fn().mockReturnValue({
    doc: jest.fn().mockReturnValue({
      set: mockSet,
      update: mockUpdate,
      get: mockGet,
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          set: mockSet,
          update: mockUpdate,
          get: mockGet,
        }),
      }),
    }),
  }),
};

jest.mock("firebase-admin", () => ({
  apps: [{}],
  initializeApp: jest.fn(),
  firestore: jest.fn().mockReturnValue(firestoreMock),
}));

const admin = require("firebase-admin");
admin.firestore.FieldValue = {
  serverTimestamp: () => "SERVER_TIMESTAMP",
  delete: () => "DELETE",
};
admin.firestore.Timestamp = {
  now: () => ({ toDate: () => new Date() }),
  fromDate: (d: Date) => ({ toDate: () => d }),
};

// ── Mock googleapis ──────────────────────────────────────────────────────────
const mockTasksInsert = jest.fn();
const mockTasksPatch = jest.fn();
const mockTasklistsList = jest.fn();

jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: jest.fn(),
      })),
    },
    tasks: jest.fn().mockReturnValue({
      tasklists: { list: mockTasklistsList },
      tasks: {
        insert: mockTasksInsert,
        patch: mockTasksPatch,
        list: jest.fn().mockResolvedValue({ data: { items: [] } }),
      },
    }),
  },
}));

// ── Mock auth/tokenStore ─────────────────────────────────────────────────────
jest.mock("../auth/tokenStore", () => ({
  getAccessToken: jest.fn().mockResolvedValue("fake-access-token"),
}));

// ── Mock domainCheck ─────────────────────────────────────────────────────────
jest.mock("../utils/domainCheck", () => ({
  requireMuDomain: jest.fn().mockReturnValue("test-uid"),
}));

// ── Mock sync ────────────────────────────────────────────────────────────────
jest.mock("../sync/syncUserGoogleTasks", () => ({
  syncUserGoogleTasks: jest.fn().mockResolvedValue({
    listsRead: 1,
    tasksNormalized: 1,
    warnings: [],
  }),
}));

// ── Mock firebase-functions/v2/https ─────────────────────────────────────────
jest.mock("firebase-functions/v2/https", () => ({
  onCall: (_opts: unknown, handler: unknown) => {
    if (typeof _opts === "function") return { handler: _opts };
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

const { HttpsError } = require("firebase-functions/v2/https");

// ── Helper ───────────────────────────────────────────────────────────────────

function getHandler(module: { handler?: unknown }): (...args: any[]) => Promise<any> {
  return (typeof module.handler === "function" ? module.handler : module) as (...args: any[]) => Promise<any>;
}

const fakeRequest = (data: Record<string, unknown>) => ({
  auth: { uid: "test-uid", token: { email: "test@mastersunion.org" } },
  data,
});

// ── createGoogleTask Tests ────────────────────────────────────────────────────

describe("createGoogleTask", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: API succeeds
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "list-001", title: "My Tasks" }] },
    });
    mockTasksInsert.mockResolvedValue({
      data: { id: "task-created-001" },
    });
  });

  it("creates a task and updates Firestore on success", async () => {
    const { createGoogleTask } = require("../actions/createGoogleTask");
    const handler = getHandler(createGoogleTask);

    const result = await handler(fakeRequest({ title: "Finish assignment", dueDate: "2024-09-20" }));

    expect(result.taskId).toBe("task-created-001");
    expect(result.title).toBe("Finish assignment");
    expect(mockTasksInsert).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledTimes(1); // Firestore written
  });

  it("does NOT update Firestore when Google Tasks API fails", async () => {
    mockTasksInsert.mockRejectedValue(new Error("Google API 500 error"));

    const { createGoogleTask } = require("../actions/createGoogleTask");
    const handler = getHandler(createGoogleTask);

    await expect(
      handler(fakeRequest({ title: "Finish assignment" }))
    ).rejects.toThrow();

    expect(mockSet).not.toHaveBeenCalled(); // Firestore NOT updated
  });

  it("throws invalid-argument for empty title", async () => {
    const { createGoogleTask } = require("../actions/createGoogleTask");
    const handler = getHandler(createGoogleTask);

    try {
      await handler(fakeRequest({ title: "" }));
      fail("Should have thrown");
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe("invalid-argument");
    }
  });

  it("throws invalid-argument for title exceeding 120 chars", async () => {
    const { createGoogleTask } = require("../actions/createGoogleTask");
    const handler = getHandler(createGoogleTask);

    try {
      await handler(fakeRequest({ title: "A".repeat(121) }));
      fail("Should have thrown");
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe("invalid-argument");
    }
  });
});

// ── completeGoogleTask Tests ──────────────────────────────────────────────────

describe("completeGoogleTask", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Task exists in Firestore
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        taskId: "task-001",
        taskListId: "list-001",
        title: "Finish reading",
        status: "needsAction",
      }),
    });

    mockTasksPatch.mockResolvedValue({ data: { id: "task-001", status: "completed" } });
  });

  it("marks task as completed in Firestore on API success", async () => {
    const { completeGoogleTask } = require("../actions/completeGoogleTask");
    const handler = getHandler(completeGoogleTask);

    const result = await handler(fakeRequest({ taskId: "task-001", taskListId: "list-001" }));

    expect(result.taskId).toBe("task-001");
    expect(result.completed).toBe(true);
    expect(mockTasksPatch).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" })
    );
  });

  it("does NOT update Firestore when Google Tasks API patch fails", async () => {
    mockTasksPatch.mockRejectedValue(new Error("Patch failed"));

    const { completeGoogleTask } = require("../actions/completeGoogleTask");
    const handler = getHandler(completeGoogleTask);

    await expect(
      handler(fakeRequest({ taskId: "task-001", taskListId: "list-001" }))
    ).rejects.toThrow();

    expect(mockUpdate).not.toHaveBeenCalled(); // Firestore NOT updated
  });

  it("throws not-found when task does not exist in Firestore", async () => {
    mockGet.mockResolvedValue({ exists: false, data: () => ({}) });

    const { completeGoogleTask } = require("../actions/completeGoogleTask");
    const handler = getHandler(completeGoogleTask);

    try {
      await handler(fakeRequest({ taskId: "missing-task", taskListId: "list-001" }));
      fail("Should have thrown");
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe("not-found");
    }
  });

  it("throws invalid-argument for missing taskId", async () => {
    const { completeGoogleTask } = require("../actions/completeGoogleTask");
    const handler = getHandler(completeGoogleTask);

    try {
      await handler(fakeRequest({ taskListId: "list-001" }));
      fail("Should have thrown");
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe("invalid-argument");
    }
  });
});
