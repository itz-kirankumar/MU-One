/**
 * Tests for importTodaySuggestionToGoogleTask — idempotency / duplicate prevention.
 */
export {};

// ── Mock firebase-admin ────────────────────────────────────────────────────
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn();

const firestoreMock = {
  collection: jest.fn().mockReturnValue({
    doc: jest.fn().mockReturnValue({
      set: mockSet,
      get: mockGet,
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({ set: mockSet, get: mockGet }),
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
      tasks: { insert: mockTasksInsert },
    }),
  },
}));

// ── Mock dependencies ────────────────────────────────────────────────────────
jest.mock("../auth/tokenStore", () => ({
  getAccessToken: jest.fn().mockResolvedValue("fake-access-token"),
}));
jest.mock("../utils/domainCheck", () => {
  const requireMuDomain = jest.fn().mockReturnValue("test-uid");
  return {
    requireMuDomain,
    requirePlatformAccess: jest.fn((request: unknown) => Promise.resolve(requireMuDomain(request))),
  };
});
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function getHandler(module: { handler?: unknown }): (...args: any[]) => Promise<any> {
  return (typeof module.handler === "function" ? module.handler : module) as (...args: any[]) => Promise<any>;
}

const fakeRequest = (data: Record<string, unknown>) => ({
  auth: { uid: "test-uid", token: { email: "test@mastersunion.org" } },
  data,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("importTodaySuggestionToGoogleTask — duplicate prevention", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTasklistsList.mockResolvedValue({
      data: { items: [{ id: "list-001", title: "My Tasks" }] },
    });
    mockTasksInsert.mockResolvedValue({
      data: { id: "task-new-001" },
    });
  });

  it("creates a new task when source has not been imported before", async () => {
    // importedSources doc does NOT exist
    mockGet.mockResolvedValue({ exists: false, data: () => ({}) });

    const { importTodaySuggestionToGoogleTask } = require(
      "../actions/importTodaySuggestionToGoogleTask"
    );
    const handler = getHandler(importTodaySuggestionToGoogleTask);

    const result = await handler(
      fakeRequest({
        sourceType: "calendar",
        sourceId: "event-abc-123",
        title: "Finance Quiz Deadline",
        dueDate: "2024-09-20",
      })
    );

    expect(result.existing).toBe(false);
    expect(result.taskId).toBe("task-new-001");
    expect(mockTasksInsert).toHaveBeenCalledTimes(1);
    // importedSources AND googleTasks should both be written
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it("returns existing task without creating a duplicate on second import", async () => {
    // importedSources doc ALREADY exists
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        taskId: "task-existing-001",
        taskListId: "list-001",
        title: "Finance Quiz Deadline",
        sourceType: "calendar",
        sourceId: "event-abc-123",
      }),
    });

    const { importTodaySuggestionToGoogleTask } = require(
      "../actions/importTodaySuggestionToGoogleTask"
    );
    const handler = getHandler(importTodaySuggestionToGoogleTask);

    const result = await handler(
      fakeRequest({
        sourceType: "calendar",
        sourceId: "event-abc-123",
        title: "Finance Quiz Deadline",
        dueDate: "2024-09-20",
      })
    );

    expect(result.existing).toBe(true);
    expect(result.taskId).toBe("task-existing-001");
    // Google Tasks API should NOT be called again
    expect(mockTasksInsert).not.toHaveBeenCalled();
    // Firestore should NOT be written again
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("allows different sources for the same user to both be imported", async () => {
    // Each call returns does-not-exist (different source keys)
    mockGet.mockResolvedValue({ exists: false, data: () => ({}) });
    mockTasksInsert
      .mockResolvedValueOnce({ data: { id: "task-cal-001" } })
      .mockResolvedValueOnce({ data: { id: "task-mail-001" } });

    const { importTodaySuggestionToGoogleTask } = require(
      "../actions/importTodaySuggestionToGoogleTask"
    );
    const handler = getHandler(importTodaySuggestionToGoogleTask);

    const result1 = await handler(
      fakeRequest({
        sourceType: "calendar",
        sourceId: "event-001",
        title: "Calendar Task",
      })
    );
    const result2 = await handler(
      fakeRequest({
        sourceType: "mail",
        sourceId: "msg-001",
        title: "Mail Task",
      })
    );

    expect(result1.existing).toBe(false);
    expect(result1.taskId).toBe("task-cal-001");
    expect(result2.existing).toBe(false);
    expect(result2.taskId).toBe("task-mail-001");
    // Both tasks created
    expect(mockTasksInsert).toHaveBeenCalledTimes(2);
  });

  it("throws invalid-argument for invalid sourceType", async () => {
    const { importTodaySuggestionToGoogleTask } = require(
      "../actions/importTodaySuggestionToGoogleTask"
    );
    const handler = getHandler(importTodaySuggestionToGoogleTask);

    try {
      await handler(
        fakeRequest({
          sourceType: "unknown",
          sourceId: "id-001",
          title: "Test",
        })
      );
      fail("Should have thrown");
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe("invalid-argument");
    }
  });

  it("throws invalid-argument for missing sourceId", async () => {
    const { importTodaySuggestionToGoogleTask } = require(
      "../actions/importTodaySuggestionToGoogleTask"
    );
    const handler = getHandler(importTodaySuggestionToGoogleTask);

    try {
      await handler(
        fakeRequest({
          sourceType: "calendar",
          title: "Test",
        })
      );
      fail("Should have thrown");
    } catch (err: unknown) {
      expect((err as { code: string }).code).toBe("invalid-argument");
    }
  });
});
