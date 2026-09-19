import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { requireMuDomain } from "../utils/domainCheck";
import { syncUserCalendar } from "./syncUserCalendar";
import { syncUserMail } from "./syncUserMail";
import { syncUserGoogleTasks } from "./syncUserGoogleTasks";
import { getDb } from "../utils/getDb";
import { EXPLABS_API_KEY, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY } from "../config/params";

const SYNC_COOLDOWN_MS = 60 * 1000; // 60 seconds
const FORCE_COOLDOWN_MS = 15 * 1000; // 15 seconds for manual force
const SYNC_DAYS = 30;

type SourceHealth = "ok" | "warning" | "error";

/**
 * Callable: triggers a full dashboard sync for the authenticated user.
 *
 * - Rate-limited: at most 1 call per 60 seconds per user (15s if force=true).
 * - Runs calendar, mail, and task syncs in parallel.
 * - Retains last successful data if a source fails.
 * - Updates dashboard/current.sync with live status.
 * - Returns { jobId, status }
 */
export const syncDashboard = onCall(
  { timeoutSeconds: 300, secrets: [GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY, EXPLABS_API_KEY] },
  async (request) => {
    const uid = requireMuDomain(request);
    const db = getDb();
    const isForce = Boolean(
      (request.data as Record<string, unknown> | undefined)?.force
    );
    const minCooldown = isForce ? FORCE_COOLDOWN_MS : SYNC_COOLDOWN_MS;

    const dashRef = db
      .collection("users")
      .doc(uid)
      .collection("dashboard")
      .doc("current");

    // Rate-limit check
    const dashSnap = await dashRef.get();
    if (dashSnap.exists) {
      const dashData = dashSnap.data() ?? {};
      const syncData = dashData["sync"] as Record<string, unknown> | undefined;
      const lastAtTs = syncData?.["lastCompletedAt"] as
        | admin.firestore.Timestamp
        | undefined;
      if (lastAtTs) {
        const lastAt = lastAtTs.toDate();
        if (Date.now() - lastAt.getTime() < minCooldown) {
          const secondsRemaining = Math.ceil(
            (minCooldown - (Date.now() - lastAt.getTime())) / 1000
          );
          throw new HttpsError(
            "resource-exhausted",
            `Sync rate-limited. Try again in ${secondsRemaining} seconds.`
          );
        }
      }
    }

    // Create a sync job document
    const jobRef = db
      .collection("users")
      .doc(uid)
      .collection("syncJobs")
      .doc();
    const jobId = jobRef.id;

    await jobRef.set({
      jobId,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "running",
      uid,
    });

    // Mark sync as in-progress on dashboard
    await dashRef.set(
      {
        sync: {
          status: "syncing",
          jobId,
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );

    // Run all three syncs in parallel
    const calendarHealth: SourceHealth = "ok";
    const mailHealth: SourceHealth = "ok";
    const tasksHealth: SourceHealth = "ok";

    const [calResult, mailResult, tasksResult] = await Promise.allSettled([
      syncUserCalendar(uid, SYNC_DAYS),
      syncUserMail(uid),
      syncUserGoogleTasks(uid),
    ]);

    // Evaluate results
    const sourceHealth: Record<string, SourceHealth> = {
      calendar: calendarHealth,
      mail: mailHealth,
      tasks: tasksHealth,
    };
    const allWarnings: string[] = [];
    const metrics: Record<string, unknown> = {};

    if (calResult.status === "fulfilled") {
      sourceHealth["calendar"] =
        calResult.value.warnings.length > 0 ? "warning" : "ok";
      metrics["calendarsCount"] = calResult.value.calendarsRead;
      metrics["eventsCount"] = calResult.value.eventsNormalized;
      allWarnings.push(...calResult.value.warnings.map((w) => `[calendar] ${w}`));
    } else {
      sourceHealth["calendar"] = "error";
      allWarnings.push(`[calendar] ${calResult.reason}`);
    }

    if (mailResult.status === "fulfilled") {
      sourceHealth["mail"] =
        mailResult.value.warnings.length > 0 ? "warning" : "ok";
      metrics["importantMailCount"] = mailResult.value.messagesNormalized;
      allWarnings.push(...mailResult.value.warnings.map((w) => `[mail] ${w}`));
    } else {
      sourceHealth["mail"] = "error";
      allWarnings.push(`[mail] ${mailResult.reason}`);
    }

    if (tasksResult.status === "fulfilled") {
      sourceHealth["tasks"] =
        tasksResult.value.warnings.length > 0 ? "warning" : "ok";
      metrics["googleTasksCount"] = tasksResult.value.tasksNormalized;
      allWarnings.push(...tasksResult.value.warnings.map((w) => `[tasks] ${w}`));
    } else {
      sourceHealth["tasks"] = "error";
      allWarnings.push(`[tasks] ${tasksResult.reason}`);
    }

    const now = admin.firestore.Timestamp.now();
    const nextSyncAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 5 * 60 * 1000)
    );

    const overallStatus = Object.values(sourceHealth).every((h) => h === "ok")
      ? "ok"
      : Object.values(sourceHealth).some((h) => h === "error")
      ? "partial_error"
      : "warning";

    const nowIso = now.toDate().toISOString();
    const nextSyncIso = nextSyncAt.toDate().toISOString();

    // Update dashboard with final sync status
    await dashRef.set(
      {
        sourceHealth,
        metrics,
        sync: {
          status: overallStatus,
          jobId,
          lastCompletedAt: now,
          nextScheduledSyncAt: nextSyncAt,
          warnings: allWarnings.slice(0, 50), // cap stored warnings
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

    // Update sync job
    await jobRef.update({
      status: overallStatus,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      sourceHealth,
      metrics,
      warnings: allWarnings.slice(0, 50),
    });

    // Update user's lastSyncAt
    await db.collection("users").doc(uid).update({
      "googleConnection.lastSyncAt": now,
    });

    return { jobId, status: overallStatus, metrics, warnings: allWarnings.slice(0, 10) };
  }
);
