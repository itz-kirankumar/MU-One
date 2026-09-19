/**
 * MU One Cloud Functions — Entry Point
 *
 * Initializes Firebase Admin and exports all Cloud Functions.
 * All Google API calls are performed exclusively in these functions.
 */

import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK once
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// ── Auth Functions ─────────────────────────────────────────────────────────
export { connectGoogleAccount, getGoogleAuthUrl } from "./auth/connectGoogleAccount";
export { disconnectGoogleAccount } from "./auth/disconnectGoogleAccount";

// ── Sync Functions ─────────────────────────────────────────────────────────
export { syncDashboard } from "./sync/syncDashboard";
export { scheduledSyncAllUsers } from "./sync/scheduledSyncAllUsers";

// ── Action Functions ───────────────────────────────────────────────────────
export { createGoogleTask } from "./actions/createGoogleTask";
export { completeGoogleTask } from "./actions/completeGoogleTask";
export { importTodaySuggestionToGoogleTask } from "./actions/importTodaySuggestionToGoogleTask";
export { createCalendarEvent } from "./actions/createCalendarEvent";
export { sendMail } from "./actions/sendMail";
export { getFullMailMessage } from "./actions/getFullMailMessage";
export { researchMailTopic } from "./actions/researchMailTopic";
export { surveyPortal } from "./surveys/portal";
export { testmailPortal } from "./integrations/testmailPortal";
