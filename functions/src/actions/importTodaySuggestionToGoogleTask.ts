import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { google } from "googleapis";
import { requireMuDomain } from "../utils/domainCheck";
import { validateTitle, validateDate } from "../utils/inputValidation";
import { getAccessToken } from "../auth/tokenStore";
import { withBackoff } from "../utils/backoff";
import { getDb } from "../utils/getDb";

type SourceType = "calendar" | "mail";

/**
 * Callable: imports a suggested item (from calendar or mail) as a Google Task.
 * Idempotent — second import of the same source returns the existing task.
 *
 * - Auth + domain check
 * - Validates sourceType (calendar|mail), sourceId, title (≤120), dueDate
 * - Checks /users/{uid}/importedSources/{sourceType_sourceId} for existing import
 * - Gets default task list
 * - Creates Google Task
 * - Writes to /users/{uid}/importedSources/{sourceKey}
 * - Returns { taskId, taskListId, title } or { existing: true, taskId }
 */
export const importTodaySuggestionToGoogleTask = onCall(async (request) => {
  const uid = requireMuDomain(request);

  const {
    sourceType: rawSourceType,
    sourceId: rawSourceId,
    title: rawTitle,
    dueDate: rawDueDate,
  } = request.data as Record<string, unknown>;

  // Validate sourceType
  if (rawSourceType !== "calendar" && rawSourceType !== "mail") {
    throw new HttpsError(
      "invalid-argument",
      'sourceType must be "calendar" or "mail".'
    );
  }
  const sourceType: SourceType = rawSourceType;

  // Validate sourceId
  if (typeof rawSourceId !== "string" || !rawSourceId.trim()) {
    throw new HttpsError("invalid-argument", "sourceId must be a non-empty string.");
  }
  const sourceId = rawSourceId.trim();

  // Validate title
  const title = validateTitle(rawTitle, 120);

  // Validate optional dueDate
  let dueDate: string | undefined;
  if (rawDueDate !== undefined && rawDueDate !== null && rawDueDate !== "") {
    dueDate = validateDate(rawDueDate);
  }

  const sourceKey = `${sourceType}_${sourceId}`;
  const db = getDb();

  // Idempotency check
  const importedRef = db
    .collection("users")
    .doc(uid)
    .collection("importedSources")
    .doc(sourceKey);
  const importedSnap = await importedRef.get();

  if (importedSnap.exists) {
    const importedData = importedSnap.data() ?? {};
    return {
      existing: true,
      taskId: importedData["taskId"] as string,
      taskListId: importedData["taskListId"] as string,
      title: importedData["title"] as string,
    };
  }

  // Get access token and default task list
  const accessToken = await getAccessToken(uid);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const tasksApi = google.tasks({ version: "v1", auth });

  let taskListId: string;
  try {
    const listsResponse = await withBackoff(() =>
      tasksApi.tasklists.list({ maxResults: 10 })
    );
    const items = listsResponse.data.items ?? [];
    // Prefer a list named "MU One" if it exists, otherwise use the first list
    const muList = items.find((tl) =>
      (tl.title ?? "").toLowerCase().includes("mu one")
    );
    taskListId = muList?.id ?? items[0]?.id ?? "@default";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError("internal", `Failed to get task lists: ${msg}`);
  }

  // Build task body
  const taskBody: Record<string, unknown> = { title };
  if (dueDate) {
    taskBody["due"] = `${dueDate}T00:00:00.000Z`;
  }
  if (sourceType === "calendar") {
    taskBody["notes"] = `Imported from calendar event: ${sourceId}`;
  } else {
    taskBody["notes"] = `Imported from email: ${sourceId}`;
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
    throw new HttpsError("internal", `Google Tasks API error: ${msg}`);
  }

  // Record the import (idempotency marker)
  await importedRef.set({
    taskId: createdTaskId,
    taskListId,
    title,
    sourceType,
    sourceId,
    sourceKey,
    dueDate: dueDate ?? null,
    importedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Write to googleTasks collection
  await db
    .collection("users")
    .doc(uid)
    .collection("googleTasks")
    .doc(createdTaskId)
    .set({
      taskId: createdTaskId,
      taskListId,
      title,
      notes: taskBody["notes"],
      status: "needsAction",
      dueDate: dueDate ?? null,
      completed: null,
      importedFrom: { sourceType, sourceId },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  return { taskId: createdTaskId, taskListId, title, existing: false };
});
