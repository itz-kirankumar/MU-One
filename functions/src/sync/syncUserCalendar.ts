import * as admin from "firebase-admin";
import { google } from "googleapis";
import { getAccessToken } from "../auth/tokenStore";
import { normalizeEvent } from "../utils/eventParsing";
import { withBackoff } from "../utils/backoff";
import { getDb } from "../utils/getDb";

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

/**
 * Syncs Google Calendar events for a user into Firestore.
 *
 * - Retrieves all calendars, skipping holiday calendars.
 * - Fetches events in the window [now, now + syncDays].
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
  const timeMax = new Date(now.getTime() + syncDays * 24 * 60 * 60 * 1000);

  // List all calendars
  let calendarList: {
    id: string;
    summary: string;
    primary: boolean;
  }[] = [];

  try {
    const calListResponse = await withBackoff(() =>
      calendar.calendarList.list({ maxResults: 250 })
    );
    const items = calListResponse.data.items ?? [];
    calendarList = items
      .filter((item) => {
        const name = (item.summary ?? "").toLowerCase();
        return !HOLIDAY_CALENDAR_KEYWORDS.some((kw) => name.includes(kw));
      })
      .map((item) => ({
        id: item.id ?? "",
        summary: item.summary ?? "",
        primary: item.primary ?? false,
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

  for (const cal of calendarList) {
    try {
      const eventsResponse = await withBackoff(() =>
        calendar.events.list({
          calendarId: cal.id,
          timeMin: now.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 500,
        })
      );

      const events = eventsResponse.data.items ?? [];
      for (const event of events) {
        const iCalUID = event.iCalUID ?? "";
        if (!iCalUID || seenICalUIDs.has(iCalUID)) {
          continue;
        }
        seenICalUIDs.add(iCalUID);
        const normalized = normalizeEvent(
          event as Record<string, unknown>,
          cal.summary,
          cal.id
        );
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

  // Build dashboard summaries
  const upcoming = allNormalizedEvents
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
