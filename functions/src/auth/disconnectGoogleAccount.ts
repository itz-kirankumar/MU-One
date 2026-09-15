import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { OAuth2Client } from "google-auth-library";
import { requireMuDomain } from "../utils/domainCheck";
import { decryptToken } from "../utils/encryption";
import { getDb } from "../utils/getDb";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";

function buildOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

/**
 * Callable: disconnects the user's Google account.
 *
 * Steps:
 *  1. Auth + domain check
 *  2. Retrieve and decrypt the refresh token
 *  3. Revoke the token via Google API
 *  4. Delete token fields from Firestore
 *  5. Update googleConnection.connected = false
 *  6. Clear dashboard/current
 */
export const disconnectGoogleAccount = onCall(async (request) => {
  const uid = requireMuDomain(request);
  const db = getDb();

  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User document not found.");
  }

  const data = userDoc.data() ?? {};
  const gc = data["googleConnection"] as Record<string, unknown> | undefined;

  const encryptedRefreshToken = gc?.["encryptedRefreshToken"] as string | undefined;

  // Attempt to revoke the refresh token (non-fatal if it fails)
  if (encryptedRefreshToken) {
    try {
      const refreshToken = decryptToken(encryptedRefreshToken);
      const oauth2Client = buildOAuth2Client();
      await oauth2Client.revokeToken(refreshToken);
    } catch {
      // Token may already be revoked or decryption failed — continue cleanup
    }
  }

  // Delete tokens and mark disconnected
  await db.collection("users").doc(uid).update({
    "googleConnection.connected": false,
    "googleConnection.encryptedRefreshToken":
      admin.firestore.FieldValue.delete(),
    "googleConnection.accessToken": admin.firestore.FieldValue.delete(),
    "googleConnection.accessTokenExpiresAt":
      admin.firestore.FieldValue.delete(),
    "googleConnection.lastSyncAt": admin.firestore.FieldValue.delete(),
  });

  // Clear dashboard/current
  const dashboardRef = db
    .collection("users")
    .doc(uid)
    .collection("dashboard")
    .doc("current");

  await dashboardRef.set(
    {
      agenda: [],
      deadlines: [],
      importantMail: [],
      googleTasks: [],
      sourceHealth: {
        calendar: "disconnected",
        mail: "disconnected",
        tasks: "disconnected",
      },
      sync: {
        lastCompletedAt: null,
        nextScheduledSyncAt: null,
        status: "disconnected",
      },
    },
    { merge: false }
  );

  return { success: true, message: "Google account disconnected successfully." };
});
