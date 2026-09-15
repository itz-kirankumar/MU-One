import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { google } from "googleapis";
import { requireMuDomain } from "../utils/domainCheck";
import { getAccessToken } from "../auth/tokenStore";
import { withBackoff } from "../utils/backoff";
import { getDb } from "../utils/getDb";

/**
 * Callable: marks a Google Task as completed.
 *
 * - Auth + domain check
 * - Validates taskId and taskListId
 * - Calls Google Tasks API: tasks.patch {status: 'completed'}
 * - On success: updates /users/{uid}/googleTasks/{taskId}.status
 * - On API failure: returns structured error, does NOT update Firestore optimistically
 * - Returns { taskId, completed: true }
 */
export const completeGoogleTask = onCall(async (request) => {
  const uid = requireMuDomain(request);

  const { taskId: rawTaskId, taskListId: rawTaskListId } =
    request.data as Record<string, unknown>;

  if (typeof rawTaskId !== "string" || !rawTaskId.trim()) {
    throw new HttpsError("invalid-argument", "taskId must be a non-empty string.");
  }
  if (typeof rawTaskListId !== "string" || !rawTaskListId.trim()) {
    throw new HttpsError("invalid-argument", "taskListId must be a non-empty string.");
  }

  const taskId = rawTaskId.trim();
  const taskListId = rawTaskListId.trim();

  // Verify the task belongs to this user
  const db = getDb();
  const taskDoc = await db
    .collection("users")
    .doc(uid)
    .collection("googleTasks")
    .doc(taskId)
    .get();

  if (!taskDoc.exists) {
    throw new HttpsError(
      "not-found",
      "Task not found. It may have already been deleted."
    );
  }

  const taskData = taskDoc.data() ?? {};
  if (taskData["taskListId"] !== taskListId) {
    throw new HttpsError(
      "permission-denied",
      "Task list ID does not match stored task."
    );
  }

  // Call Google Tasks API
  const accessToken = await getAccessToken(uid);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const tasksApi = google.tasks({ version: "v1", auth });

  try {
    await withBackoff(() =>
      tasksApi.tasks.patch({
        tasklist: taskListId,
        task: taskId,
        requestBody: {
          id: taskId,
          status: "completed",
        },
      })
    );
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    // Do NOT update Firestore on API failure
    throw new HttpsError("internal", `Google Tasks API error: ${msg}`);
  }

  // Update Firestore only after confirmed API success
  await db
    .collection("users")
    .doc(uid)
    .collection("googleTasks")
    .doc(taskId)
    .update({
      status: "completed",
      completed: new Date().toISOString(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return { taskId, completed: true };
});
