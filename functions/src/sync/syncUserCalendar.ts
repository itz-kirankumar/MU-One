import * as admin from "firebase-admin";
import { createHash } from "node:crypto";
import { google } from "googleapis";
import { getAccessToken } from "../auth/tokenStore";
import { normalizeEvent } from "../utils/eventParsing";
import { withBackoff } from "../utils/backoff";
import { getDb } from "../utils/getDb";
import { isSharedCalendar, toPublicTimetableEvent } from "../utils/sharedTimetable";

const HOLIDAY_CALENDAR_KEYWORDS = [
  "holiday",
  "holidays in",
  "public holiday",
  "#holiday",
];

interface SyncCalendarResult {
  calendarsRead: number;
  eventsNormalized: number;
  warnings: string[];
}

interface CalendarSource {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
}

function sharedEventId(calendarId: string, googleEventId: string): string {
  return createHash("sha256").update(`${calendarId}|${googleEventId}`).digest("hex");
}

function publicTimetableRecord(event: ReturnType<typeof normalizeEvent>) {
  return {
    ...toPublicTimetableEvent(event),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

/**
 * Syncs Google Calendar events for a user into Firestore.
 *
 * - Retrieves all calendars, skipping holiday calendars.
 * - Fetches events from the start of the previous month through now + syncDays
 *   so month views include recent calendar history.
 * - De-duplicates by iCalUID.
 * - Writes events to /users/{uid}/calendarEvents/{iCalUID}.
 * - Updates dashboard/current.agenda and dashboard/current.deadlines.
 */
export async function syncUserCalendar(
  uid: string,
  syncDays: number
): Promise<SyncCalendarResult> {
  const warnings: string[] = [];
  const accessToken = await getAccessToken(uid);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const timeMax = new Date(now.getTime() + syncDays * 24 * 60 * 60 * 1000);
  let coverageComplete = true;

  // List all calendars
  let calendarList: CalendarSource[] = [];

  try {
    const calListResponse = await withBackoff(() =>
      calendar.calendarList.list({ maxResults: 250 })
    );
    const items = calListResponse.data.items ?? [];
    if (calListResponse.data.nextPageToken) coverageComplete = false;
    calendarList = items
      .filter((item) => {
        const name = (item.summary ?? "").toLowerCase();
        return !HOLIDAY_CALENDAR_KEYWORDS.some((kw) => name.includes(kw));
      })
      .map((item) => ({
        id: item.id ?? "",
        summary: item.summary ?? "",
        primary: item.primary ?? false,
        accessRole: item.accessRole ?? "",
      }))
      .filter((item) => item.id !== "");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Failed to list calendars: ${msg}`);
    return { calendarsRead: 0, eventsNormalized: 0, warnings };
  }

  // De-duplicate by iCalUID across all calendars
  const seenICalUIDs = new Set<string>();
  const allNormalizedEvents: ReturnType<typeof normalizeEvent>[] = [];
  const busyOccurrences: ReturnType<typeof normalizeEvent>[] = [];
  const sharedEvents = new Map<string, ReturnType<typeof normalizeEvent>>();
  const removedSharedEventIds = new Set<string>();

  for (const cal of calendarList) {
    try {
      const eventsResponse = await withBackoff(() =>
        calendar.events.list({
          calendarId: cal.id,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          showDeleted: true,
          orderBy: "startTime",
          maxResults: 500,
        })
      );

      const events = eventsResponse.data.items ?? [];
      if (eventsResponse.data.nextPageToken) coverageComplete = false;
      for (const event of events) {
        const googleEventId = event.id ?? "";
        const publicId = googleEventId ? sharedEventId(cal.id, googleEventId) : "";
        if (event.status === "cancelled") {
          if (isSharedCalendar(cal) && publicId) removedSharedEventIds.add(publicId);
          continue;
        }
        const normalized = normalizeEvent(event as Record<string, unknown>, cal.summary, cal.id);
        normalized.sharedTimetable = Boolean(
          isSharedCalendar(cal) && normalized.sectionCode && !normalized.isDeadline
        );
        if (normalized.sharedTimetable && publicId) sharedEvents.set(publicId, normalized);

        // Repeated instances share iCalUID. Availability must include every busy
        // occurrence even though the display/legacy ledger de-duplicates by UID.
        if (event.transparency !== 'transparent') {
          busyOccurrences.push(normalized);
        }
        const iCalUID = event.iCalUID ?? "";
        if (!iCalUID || seenICalUIDs.has(iCalUID)) {
          continue;
        }
        seenICalUIDs.add(iCalUID);
        allNormalizedEvents.push(normalized);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Calendar "${cal.summary}": ${msg}`);
    }
  }

  // Write to Firestore in batches of 500
  const db = getDb();
  const BATCH_SIZE = 500;
  for (let i = 0; i < allNormalizedEvents.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = allNormalizedEvents.slice(i, i + BATCH_SIZE);
    for (const event of chunk) {
      const ref = db
        .collection("users")
        .doc(uid)
        .collection("calendarEvents")
        .doc(event.iCalUID);
      batch.set(ref, { ...event, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  }

  // Publish only sanitized events from shared, non-owned calendars. Personal
  // primary calendars and personal secondary calendars never enter this ledger.
  const sharedWrites = [...sharedEvents.entries()];
  for (let i = 0; i < sharedWrites.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const [id, event] of sharedWrites.slice(i, i + BATCH_SIZE)) {
      batch.set(db.collection("sharedCalendarEvents").doc(id), publicTimetableRecord(event), { merge: true });
    }
    await batch.commit();
  }
  const sharedDeletes = [...removedSharedEventIds].filter(id => !sharedEvents.has(id));
  for (let i = 0; i < sharedDeletes.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const id of sharedDeletes.slice(i, i + BATCH_SIZE)) {
      batch.delete(db.collection("sharedCalendarEvents").doc(id));
    }
    await batch.commit();
  }

  // Build dashboard summaries
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = allNormalizedEvents
    .filter((event) => event.startIso >= todayStart.toISOString())
    .sort((a, b) => a.startIso.localeCompare(b.startIso))
    .slice(0, 50);

  const agenda = upcoming.filter((e) => !e.isDeadline);
  const deadlines = upcoming.filter((e) => e.isDeadline);

  await db
    .collection("users")
    .doc(uid)
    .collection("dashboard")
    .doc("current")
    .set(
      {
        agenda,
        events: agenda,
        deadlines,
        calendarAvailability: {
          events: busyOccurrences,
          from: timeMin.toISOString(),
          to: timeMax.toISOString(),
          complete: coverageComplete && warnings.length === 0,
          syncedAt: new Date().toISOString(),
        },
        metrics: {
          eventsCount: allNormalizedEvents.length,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return {
    calendarsRead: calendarList.length,
    eventsNormalized: allNormalizedEvents.length,
    warnings,
  };
}
