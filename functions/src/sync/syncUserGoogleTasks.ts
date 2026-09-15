import * as admin from "firebase-admin";
import { google } from "googleapis";
import { getAccessToken } from "../auth/tokenStore";
import { withBackoff } from "../utils/backoff";
import { getDb } from "../utils/getDb";

interface NormalizedGoogleTask {
  taskId: string;
  taskListId: string;
  taskListTitle: string;
  title: string;
  notes: string;
  status: "needsAction" | "completed";
  dueDate: string | null;
  completed: string | null;
  updatedAt: string;
  position: string;
  selfLink: string;
}

interface SyncGoogleTasksResult {
  listsRead: number;
  tasksNormalized: number;
  warnings: string[];
}

function normalizeTask(
  task: Record<string, unknown>,
  taskListId: string,
  taskListTitle: string
): NormalizedGoogleTask {
  return {
    taskId: typeof task["id"] === "string" ? task["id"] : "",
    taskListId,
    taskListTitle,
    title: typeof task["title"] === "string" ? task["title"] : "",
    notes: typeof task["notes"] === "string" ? task["notes"] : "",
    status:
      task["status"] === "completed" ? "completed" : "needsAction",
    dueDate: typeof task["due"] === "string" ? task["due"].slice(0, 10) : null,
    completed:
      typeof task["completed"] === "string" ? task["completed"] : null,
    updatedAt: typeof task["updated"] === "string" ? task["updated"] : "",
    position: typeof task["position"] === "string" ? task["position"] : "",
    selfLink: typeof task["selfLink"] === "string" ? task["selfLink"] : "",
  };
}

/**
 * Syncs Google Tasks for a user into Firestore.
 *
 * - Lists all task lists.
 * - For each list, fetches active tasks (showCompleted=false).
 * - Normalizes and writes to /users/{uid}/googleTasks/{taskId}.
 * - Updates dashboard/current.googleTasks.
 */
export async function syncUserGoogleTasks(
  uid: string
): Promise<SyncGoogleTasksResult> {
  const warnings: string[] = [];
  const accessToken = await getAccessToken(uid);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const tasksApi = google.tasks({ version: "v1", auth });

  // List all task lists
  let taskLists: { id: string; title: string }[] = [];
  try {
    const listResponse = await withBackoff(() =>
      tasksApi.tasklists.list({ maxResults: 100 })
    );
    const items = listResponse.data.items ?? [];
    taskLists = items
      .map((tl) => ({ id: tl.id ?? "", title: tl.title ?? "" }))
      .filter((tl) => tl.id !== "");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Failed to list task lists: ${msg}`);
    return { listsRead: 0, tasksNormalized: 0, warnings };
  }

  const db = getDb();
  const allTasks: NormalizedGoogleTask[] = [];

  for (const taskList of taskLists) {
    try {
      const tasksResponse = await withBackoff(() =>
        tasksApi.tasks.list({
          tasklist: taskList.id,
          showCompleted: false,
          showHidden: false,
          maxResults: 100,
        })
      );
      const tasks = tasksResponse.data.items ?? [];
      for (const task of tasks) {
        const normalized = normalizeTask(
          task as Record<string, unknown>,
          taskList.id,
          taskList.title
        );
        if (normalized.taskId) {
          allTasks.push(normalized);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Task list "${taskList.title}": ${msg}`);
    }
  }

  // Write to Firestore in batches
  const BATCH_SIZE = 500;
  for (let i = 0; i < allTasks.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = allTasks.slice(i, i + BATCH_SIZE);
    for (const task of chunk) {
      const ref = db
        .collection("users")
        .doc(uid)
        .collection("googleTasks")
        .doc(task.taskId);
      batch.set(
        ref,
        { ...task, syncedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
  }

  // Dashboard summary: up to 30 active tasks sorted by due date
  const dashboardTasks = allTasks
    .filter((t) => t.status === "needsAction")
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 30);

  await db
    .collection("users")
    .doc(uid)
    .collection("dashboard")
    .doc("current")
    .set(
      {
        googleTasks: dashboardTasks,
        metrics: {
          googleTasksCount: allTasks.length,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return {
    listsRead: taskLists.length,
    tasksNormalized: allTasks.length,
    warnings,
  };
}
