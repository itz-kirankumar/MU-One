import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { syncUserCalendar } from "./syncUserCalendar";
import { syncUserMail } from "./syncUserMail";
import { syncUserGoogleTasks } from "./syncUserGoogleTasks";
import { getDb } from "../utils/getDb";
import { EXPLABS_API_KEY, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY } from "../config/params";

const MAX_USERS_PER_RUN = 50;
const SYNC_DAYS = 30;
const MIN_SYNC_INTERVAL_MINUTES = 4;

/**
 * Scheduled Cloud Function: runs every 5 minutes.
 *
 * Queries Firestore for users where:
 *  - googleConnection.connected == true
 *  - googleConnection.lastSyncAt < now - 4 minutes (avoid double-syncing)
 *
 * For each user (up to 50 per invocation):
 *  - Runs calendar, mail, and task syncs in parallel.
 *  - Updates lastSyncAt after sync.
 *
 * Uses Firestore cursor for pagination across large user sets.
 */
export const scheduledSyncAllUsers = onSchedule(
  {
    schedule: "every 5 minutes",
    timeoutSeconds: 540, // 9 minutes max
    memory: "512MiB",
    secrets: [GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY, EXPLABS_API_KEY],
  },
  async (_event) => {
    const db = getDb();
    const cutoffTime = new Date(
      Date.now() - MIN_SYNC_INTERVAL_MINUTES * 60 * 1000
    );
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffTime);

    // Query users eligible for sync
    // Users where connected=true AND (lastSyncAt is null OR lastSyncAt < cutoff)
    // We run two queries and merge results since Firestore can't do OR on different fields

    const query1 = db
      .collection("users")
      .where("googleConnection.connected", "==", true)
      .where("googleConnection.lastSyncAt", "<", cutoffTimestamp)
      .orderBy("googleConnection.lastSyncAt", "asc")
      .limit(MAX_USERS_PER_RUN);

    const query2 = db
      .collection("users")
      .where("googleConnection.connected", "==", true)
      .where("googleConnection.lastSyncAt", "==", null)
      .limit(MAX_USERS_PER_RUN);

    let uids: string[] = [];
    try {
      const [snap1, snap2] = await Promise.all([query1.get(), query2.get()]);
      const uidSet = new Set<string>();
      snap1.docs.forEach((d) => uidSet.add(d.id));
      snap2.docs.forEach((d) => uidSet.add(d.id));
      uids = Array.from(uidSet).slice(0, MAX_USERS_PER_RUN);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Log job-level error without sensitive data
      console.error(`[scheduledSync] Failed to query users: ${msg}`);
      return;
    }

    if (uids.length === 0) {
      console.info("[scheduledSync] No users eligible for sync.");
      return;
    }

    console.info(`[scheduledSync] Syncing ${uids.length} users.`);

    // Process each user
    const results = await Promise.allSettled(
      uids.map(async (uid) => {
        try {
          const now = admin.firestore.Timestamp.now();

          // Optimistically mark lastSyncAt to prevent double-sync
          await db.collection("users").doc(uid).update({
            "googleConnection.lastSyncAt": now,
          });

          const [calResult, mailResult, tasksResult] = await Promise.allSettled([
            syncUserCalendar(uid, SYNC_DAYS),
            syncUserMail(uid),
            syncUserGoogleTasks(uid),
          ]);

          const sourceHealth: Record<string, string> = {};
          if (calResult.status === "fulfilled") {
            sourceHealth["calendar"] =
              calResult.value.warnings.length > 0 ? "warning" : "ok";
          } else {
            sourceHealth["calendar"] = "error";
          }
          if (mailResult.status === "fulfilled") {
            sourceHealth["mail"] =
              mailResult.value.warnings.length > 0 ? "warning" : "ok";
          } else {
            sourceHealth["mail"] = "error";
          }
          if (tasksResult.status === "fulfilled") {
            sourceHealth["tasks"] =
              tasksResult.value.warnings.length > 0 ? "warning" : "ok";
          } else {
            sourceHealth["tasks"] = "error";
          }

          const overallStatus = Object.values(sourceHealth).every(
            (h) => h === "ok"
          )
            ? "ok"
            : Object.values(sourceHealth).some((h) => h === "error")
            ? "partial_error"
            : "warning";

          const nowIso = now.toDate().toISOString();
          const nextSyncDate = new Date(Date.now() + 5 * 60 * 1000);
          const nextSyncIso = nextSyncDate.toISOString();

          await db
            .collection("users")
            .doc(uid)
            .collection("dashboard")
            .doc("current")
            .set(
              {
                sourceHealth,
                sync: {
                  status: overallStatus,
                  lastCompletedAt: now,
                  nextScheduledSyncAt: admin.firestore.Timestamp.fromDate(nextSyncDate),
                },
                syncStatus: {
                  syncing: false,
                  lastSyncedAt: nowIso,
                  nextSyncAt: nextSyncIso,
                  sourceHealth: {
                    calendar: { status: sourceHealth["calendar"], lastSyncedAt: nowIso },
                    gmail: { status: sourceHealth["mail"], lastSyncedAt: nowIso },
                    tasks: { status: sourceHealth["tasks"], lastSyncedAt: nowIso },
                  },
                },
                syncedAt: nowIso,
                updatedAt: now,
              },
              { merge: true }
            );

          return { uid, status: overallStatus };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[scheduledSync] uid=${uid} failed: ${msg}`);
          return { uid, status: "error" };
        }
      })
    );

    const succeeded = results.filter(
      (r) => r.status === "fulfilled"
    ).length;
    const failed = results.length - succeeded;
    console.info(
      `[scheduledSync] Completed. Succeeded: ${succeeded}, Failed: ${failed}`
    );
  }
);
