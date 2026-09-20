import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { google } from "googleapis";
import { requirePlatformAccess } from "../utils/domainCheck";
import { validateTitle } from "../utils/inputValidation";
import { getAccessToken } from "../auth/tokenStore";
import { syncUserCalendar } from "../sync/syncUserCalendar";
import { withBackoff } from "../utils/backoff";
import { getDb } from "../utils/getDb";

const TIMEZONE = "Asia/Kolkata";

/**
 * Callable: creates a Google Calendar event for the authenticated user.
 *
 * - Auth + domain check
 * - Validates title (≤160 chars), start ISO, end ISO (end > start)
 * - Timezone: Asia/Kolkata
 * - Creates event in primary calendar
 * - Triggers syncUserCalendar (14 days) in background
 * - Returns { eventId, htmlLink, title }
 */
export const createCalendarEvent = onCall(async (request) => {
  const uid = await requirePlatformAccess(request);

  const {
    title: rawTitle,
    start: rawStart,
    end: rawEnd,
    description: rawDescription,
    allDay: rawAllDay,
  } = request.data as Record<string, unknown>;

  // Validate title
  const title = validateTitle(rawTitle, 160);

  // Validate start and end
  if (typeof rawStart !== "string" || !rawStart.trim()) {
    throw new HttpsError("invalid-argument", "start must be a non-empty ISO string.");
  }
  if (typeof rawEnd !== "string" || !rawEnd.trim()) {
    throw new HttpsError("invalid-argument", "end must be a non-empty ISO string.");
  }

  const startDate = new Date(rawStart.trim());
  const endDate = new Date(rawEnd.trim());

  if (isNaN(startDate.getTime())) {
    throw new HttpsError("invalid-argument", `Invalid start date: "${rawStart}".`);
  }
  if (isNaN(endDate.getTime())) {
    throw new HttpsError("invalid-argument", `Invalid end date: "${rawEnd}".`);
  }
  if (endDate.getTime() <= startDate.getTime()) {
    throw new HttpsError(
      "invalid-argument",
      "end must be after start."
    );
  }

  const description =
    typeof rawDescription === "string" ? rawDescription.slice(0, 5000) : "";
  const isAllDay = rawAllDay === true;

  // Build event body
  const eventBody: Record<string, unknown> = {
    summary: title,
    description,
  };

  if (isAllDay) {
    eventBody["start"] = { date: rawStart.trim().slice(0, 10) };
    eventBody["end"] = { date: rawEnd.trim().slice(0, 10) };
  } else {
    eventBody["start"] = { dateTime: startDate.toISOString(), timeZone: TIMEZONE };
    eventBody["end"] = { dateTime: endDate.toISOString(), timeZone: TIMEZONE };
  }

  // Get access token
  const accessToken = await getAccessToken(uid);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const calendarApi = google.calendar({ version: "v3", auth });

  // Create event
  let eventId: string;
  let htmlLink: string;
  try {
    const response = await withBackoff(() =>
      calendarApi.events.insert({
        calendarId: "primary",
        requestBody: eventBody,
      })
    );
    eventId = response.data.id ?? "";
    htmlLink = response.data.htmlLink ?? "";
    if (!eventId) {
      throw new HttpsError("internal", "Calendar API returned no event ID.");
    }
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError("internal", `Google Calendar API error: ${msg}`);
  }

  // Write to Firestore
  const db = getDb();
  const iCalUID = `${eventId}@google.com`;
  await db
    .collection("users")
    .doc(uid)
    .collection("calendarEvents")
    .doc(iCalUID)
    .set({
      googleEventId: eventId,
      iCalUID,
      title,
      sourceCalendarId: "primary",
      sourceCalendarName: "Primary",
      startIso: startDate.toISOString(),
      endIso: endDate.toISOString(),
      isAllDay,
      htmlLink,
      description,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // Background sync (non-blocking)
  syncUserCalendar(uid, 14).catch(() => {
    // Background sync failure should not affect the response
  });

  return { eventId, htmlLink, title };
});
