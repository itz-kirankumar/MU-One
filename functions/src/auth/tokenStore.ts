import * as admin from "firebase-admin";
import { OAuth2Client } from "google-auth-library";
import { encryptToken, decryptToken } from "../utils/encryption";
import { getDb } from "../utils/getDb";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";

function getOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

/**
 * Stores encrypted OAuth tokens in Firestore under /users/{uid}.
 * The refresh token is AES-256-GCM encrypted before storage.
 * Never logs tokens.
 */
export async function storeTokens(
  uid: string,
  refreshToken: string,
  accessToken: string,
  expiresAt: Date,
  scopesGranted: string[]
): Promise<void> {
  const db = getDb();
  const encryptedRefreshToken = encryptToken(refreshToken);

  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        googleConnection: {
          connected: true,
          encryptedRefreshToken,
          accessToken, // short-lived; acceptable to store plaintext
          accessTokenExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          scopesGranted,
          connectedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSyncAt: null,
        },
      },
      { merge: true }
    );
}

/**
 * Retrieves a valid access token for the given user.
 * If the stored access token is expired, uses the encrypted refresh token
 * to obtain a new one via google-auth-library OAuth2Client, then persists
 * the refreshed tokens back to Firestore.
 *
 * @throws If the refresh token is missing or has been revoked.
 */
export async function getAccessToken(uid: string): Promise<string> {
  const db = getDb();
  const userDoc = await db.collection("users").doc(uid).get();

  if (!userDoc.exists) {
    throw new Error(`User document not found for uid: ${uid}`);
  }

  const data = userDoc.data() ?? {};
  const gc = data["googleConnection"] as Record<string, unknown> | undefined;

  if (!gc || !gc["connected"]) {
    throw new Error("Google account is not connected for this user.");
  }

  const encryptedRefreshToken = gc["encryptedRefreshToken"] as string | undefined;
  if (!encryptedRefreshToken) {
    throw new Error("No refresh token found. Please reconnect your Google account.");
  }

  const storedAccessToken = gc["accessToken"] as string | undefined;
  const expiresAtTs = gc["accessTokenExpiresAt"] as admin.firestore.Timestamp | undefined;
  const expiresAt = expiresAtTs?.toDate();

  // Return stored access token if still valid (with 60s buffer)
  if (
    storedAccessToken &&
    expiresAt &&
    expiresAt.getTime() > Date.now() + 60_000
  ) {
    return storedAccessToken;
  }

  // Decrypt refresh token and request new access token
  let refreshToken: string;
  try {
    refreshToken = decryptToken(encryptedRefreshToken);
  } catch {
    throw new Error("Failed to decrypt refresh token. Please reconnect your Google account.");
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // Use a typed variable to hold the response
  let tokenResponse: { token?: string | null; res?: unknown };
  try {
    const raw = await oauth2Client.getAccessToken();
    tokenResponse = raw as { token?: string | null; res?: unknown };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error refreshing token";
    if (
      message.includes("invalid_grant") ||
      message.includes("Token has been expired or revoked")
    ) {
      // Mark as disconnected
      await db
        .collection("users")
        .doc(uid)
        .update({ "googleConnection.connected": false });
      throw new Error(
        "Google refresh token revoked. Please reconnect your Google account."
      );
    }
    throw new Error(`Failed to refresh access token: ${message}`);
  }

  const newAccessToken = tokenResponse.token;
  if (!newAccessToken) {
    throw new Error("Received empty access token from Google.");
  }

  // Retrieve updated credentials from oauth2Client
  const credentials = oauth2Client.credentials;
  const newExpiresAt = credentials.expiry_date
    ? new Date(credentials.expiry_date)
    : new Date(Date.now() + 3600_000);

  // Persist refreshed token
  const updatePayload: Record<string, unknown> = {
    "googleConnection.accessToken": newAccessToken,
    "googleConnection.accessTokenExpiresAt":
      admin.firestore.Timestamp.fromDate(newExpiresAt),
  };

  // If a new refresh token was issued, encrypt and update it
  if (credentials.refresh_token && credentials.refresh_token !== refreshToken) {
    updatePayload["googleConnection.encryptedRefreshToken"] = encryptToken(
      credentials.refresh_token
    );
  }

  await db.collection("users").doc(uid).update(updatePayload);

  return newAccessToken;
}
