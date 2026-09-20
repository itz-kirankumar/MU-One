import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { syncUserCalendar } from "./syncUserCalendar";
import { syncUserMail } from "./syncUserMail";
import { syncUserGoogleTasks } from "./syncUserGoogleTasks";
import { getDb } from "../utils/getDb";
import { EXPLABS_API_KEY, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY } from "../config/params";
import { PLATFORM_ADMIN_EMAIL } from "../utils/domainCheck";

const MAX_USERS_PER_RUN = 50;
const MAX_CONNECTED_USERS_SCAN = 250;
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

    let uids: string[] = [];
    try {
      // Filter the small connected-user set in memory. This avoids a fragile
      // composite-index dependency and handles missing/null lastSyncAt values.
      const snapshot = await db
        .collection("users")
        .where("googleConnection.connected", "==", true)
        .limit(MAX_CONNECTED_USERS_SCAN)
        .get();
      const eligibleUsers = snapshot.docs
        .map(doc => {
          const lastSync = doc.get("googleConnection.lastSyncAt") as admin.firestore.Timestamp | null | undefined;
          return {
            uid: doc.id,
            email: String(doc.get("email") || "").trim().toLowerCase(),
            lastSyncMs: lastSync?.toMillis?.() ?? 0,
          };
        })
        .filter(user => user.lastSyncMs < cutoffTimestamp.toMillis())
        .sort((a, b) => a.lastSyncMs - b.lastSyncMs);

      const nonAdmin = eligibleUsers.filter(user => user.email && user.email !== PLATFORM_ADMIN_EMAIL);
      const accessSnapshots = nonAdmin.length
        ? await db.getAll(...nonAdmin.map(user => db.collection("platformAccess").doc(user.email)))
        : [];
      const grantedEmails = new Set(
        accessSnapshots
          .filter(access => access.exists && access.get("status") === "granted")
          .map(access => access.id)
      );

      uids = eligibleUsers
        .filter(user => user.email === PLATFORM_ADMIN_EMAIL || grantedEmails.has(user.email))
        .slice(0, MAX_USERS_PER_RUN)
        .map(user => user.uid);
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
