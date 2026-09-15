import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { google } from "googleapis";
import { requireMuDomain } from "../utils/domainCheck";
import { validateTitle, validateDate } from "../utils/inputValidation";
import { getAccessToken } from "../auth/tokenStore";
import { syncUserGoogleTasks } from "../sync/syncUserGoogleTasks";
import { withBackoff } from "../utils/backoff";
import { getDb } from "../utils/getDb";

/**
 * Callable: creates a new Google Task for the authenticated user.
 *
 * - Auth + domain check
 * - Validates title (1–120 chars), optional dueDate
 * - Creates task in Google Tasks API
 * - On success: writes to /users/{uid}/googleTasks/{taskId}, triggers sync
 * - On API failure: returns structured error, does NOT update Firestore
 * - Returns { taskId, title, taskListId }
 */
export const createGoogleTask = onCall(async (request) => {
  const uid = requireMuDomain(request);

  const { title: rawTitle, dueDate: rawDueDate, taskListId: rawTaskListId } =
    request.data as Record<string, unknown>;

  const title = validateTitle(rawTitle, 120);
  let dueDate: string | undefined;
  if (rawDueDate !== undefined && rawDueDate !== null && rawDueDate !== "") {
    dueDate = validateDate(rawDueDate);
  }

  const accessToken = await getAccessToken(uid);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const tasksApi = google.tasks({ version: "v1", auth });

  // Determine target task list
  let taskListId: string;
  if (typeof rawTaskListId === "string" && rawTaskListId.trim()) {
    taskListId = rawTaskListId.trim();
  } else {
    // Use default task list (@default)
    try {
      const listsResponse = await withBackoff(() =>
        tasksApi.tasklists.list({ maxResults: 1 })
      );
      const items = listsResponse.data.items ?? [];
      if (items.length === 0) {
        throw new HttpsError("not-found", "No task lists found in your Google account.");
      }
      taskListId = items[0].id ?? "@default";
    } catch (err: unknown) {
      if (err instanceof HttpsError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpsError("internal", `Failed to retrieve task lists: ${msg}`);
    }
  }

  // Build task body
  const taskBody: Record<string, unknown> = { title };
  if (dueDate) {
    // Google Tasks API expects RFC 3339 date-time for due field
    taskBody["due"] = `${dueDate}T00:00:00.000Z`;
  }

  // Create task via API
  let createdTaskId: string;
  try {
    const createResponse = await withBackoff(() =>
      tasksApi.tasks.insert({
        tasklist: taskListId,
        requestBody: taskBody,
      })
    );
    createdTaskId = createResponse.data.id ?? "";
    if (!createdTaskId) {
      throw new HttpsError("internal", "Google Tasks API returned no task ID.");
    }
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    // Do NOT update Firestore on API failure
    throw new HttpsError("internal", `Google Tasks API error: ${msg}`);
  }

  // Write to Firestore on success
  const db = getDb();
  await db
    .collection("users")
    .doc(uid)
    .collection("googleTasks")
    .doc(createdTaskId)
    .set({
      taskId: createdTaskId,
      taskListId,
      title,
      notes: "",
      status: "needsAction",
      dueDate: dueDate ?? null,
      completed: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // Trigger background sync (non-blocking; errors are non-fatal)
  syncUserGoogleTasks(uid).catch(() => {
    // Background sync failure should not affect the response
  });

  return { taskId: createdTaskId, title, taskListId };
});
