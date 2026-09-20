import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { OAuth2Client } from "google-auth-library";
import { storeTokens } from "./tokenStore";
import { getDb } from "../utils/getDb";
import {
  DASHBOARD_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  TOKEN_ENCRYPTION_KEY,
} from "../config/params";
import { buildDashboardRedirect } from "./oauthRedirect";
import { PLATFORM_ADMIN_EMAIL, requirePlatformAccess } from "../utils/domainCheck";

const REQUIRED_SCOPES = [
  // Read/write: createCalendarEvent needs write access, so requesting
  // calendar.readonly here would make event creation fail after consent.
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/tasks",
  "openid",
  "email",
  "profile",
];

function buildOAuth2Client(): OAuth2Client {
  return new OAuth2Client(
    GOOGLE_CLIENT_ID.value(),
    GOOGLE_CLIENT_SECRET.value(),
    GOOGLE_REDIRECT_URI.value()
  );
}

/**
 * Callable function: returns the Google OAuth authorization URL.
 * The client redirects the user to this URL to begin the OAuth flow.
 */
export const getGoogleAuthUrl = onCall({ secrets: [GOOGLE_CLIENT_SECRET] }, async (request) => {
  const uid = await requirePlatformAccess(request);

  const oauth2Client = buildOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: REQUIRED_SCOPES,
    prompt: "consent",
    state: uid, // Pass uid so the redirect handler knows which user to update
  });

  return { authUrl };
});

/**
 * HTTPS endpoint (OAuth redirect handler).
 * Google redirects here after the user grants permission.
 * Query params: code, state (uid), error (if denied)
 *
 * Flow:
 *  1. Validate state param (Firebase UID)
 *  2. Exchange authorization code for tokens
 *  3. Verify tokeninfo email ends with @mastersunion.org
 *  4. Encrypt and store refresh token
 *  5. Update user profile in Firestore
 *  6. Redirect to dashboard
 */
export const connectGoogleAccount = onRequest({
  secrets: [GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY],
}, async (req, res) => {
  const { code, state: uid, error } = req.query as Record<string, string>;

  if (error) {
    res.redirect(buildDashboardRedirect(DASHBOARD_URL.value(), "denied", error));
    return;
  }

  if (!code || !uid) {
    res.status(400).send("Missing code or state parameter.");
    return;
  }

  try {
    // Verify uid is a valid Firestore user
    let userRecord: admin.auth.UserRecord;
    try {
      userRecord = await admin.auth().getUser(uid);
    } catch {
      res.status(400).send("Invalid state parameter.");
      return;
    }

    // Exchange authorization code for tokens
    const oauth2Client = buildOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      // No refresh token means user already authorized before without consent prompt
      res.redirect(
        buildDashboardRedirect(DASHBOARD_URL.value(), "error", "no_refresh_token")
      );
      return;
    }

    // Verify token email matches @mastersunion.org
    oauth2Client.setCredentials(tokens);
    const tokenInfoResponse = await oauth2Client.getTokenInfo(
      tokens.access_token ?? ""
    );
    const tokenEmail = tokenInfoResponse.email ?? "";

    if (!tokenEmail.toLowerCase().endsWith("@mastersunion.org")) {
      res.redirect(
        buildDashboardRedirect(DASHBOARD_URL.value(), "error", "wrong_domain")
      );
      return;
    }

    // Verify the tokenEmail matches the Firebase Auth user
    const firebaseEmail = (userRecord.email ?? "").toLowerCase();
    if (firebaseEmail !== tokenEmail.toLowerCase()) {
      res.redirect(
        buildDashboardRedirect(DASHBOARD_URL.value(), "error", "email_mismatch")
      );
      return;
    }

    if (firebaseEmail !== PLATFORM_ADMIN_EMAIL) {
      const access = await getDb().collection("platformAccess").doc(firebaseEmail).get();
      if (!access.exists || access.get("status") !== "granted") {
        res.redirect(
          buildDashboardRedirect(DASHBOARD_URL.value(), "error", "access_not_granted")
        );
        return;
      }
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600_000);

    const scopesGranted = typeof tokens.scope === "string"
      ? tokens.scope.split(" ")
      : REQUIRED_SCOPES;

    // Encrypt and store tokens
    await storeTokens(
      uid,
      tokens.refresh_token,
      tokens.access_token ?? "",
      expiresAt,
      scopesGranted
    );

    // Update user profile. Fields are written flat to match the client's
    // UserProfile type, and googleConnection.connected must be set true or the
    // dashboard can never tell that the account was linked.
    const db = getDb();
    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          uid,
          email: tokenEmail,
          displayName: userRecord.displayName ?? "",
          photoURL: userRecord.photoURL ?? "",
          domainVerified: true,
          timezone: "Asia/Kolkata",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          googleConnection: {
            connected: true,
            email: tokenEmail,
            scopes: scopesGranted,
            tokenStatus: "active",
            connectedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );

    res.redirect(buildDashboardRedirect(DASHBOARD_URL.value(), "success"));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Do not log tokens or sensitive data
    res.redirect(
      buildDashboardRedirect(DASHBOARD_URL.value(), "error", message)
    );
  }
});
