import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { getDb } from "./getDb";

export const PLATFORM_ADMIN_EMAIL = "kiran.kumar2028@mastersunion.org";

/**
 * Validates that the Firebase Auth token email ends with @mastersunion.org.
 * Throws HttpsError('permission-denied') if not authenticated or wrong domain.
 * @returns The authenticated user's UID.
 */
export function requireMuDomain(context: CallableRequest): string {
  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to call this function."
    );
  }

  const email: string = context.auth.token.email ?? "";

  if (!email.toLowerCase().endsWith("@mastersunion.org")) {
    throw new HttpsError(
      "permission-denied",
      "Access restricted to @mastersunion.org accounts."
    );
  }

  return context.auth.uid;
}

export function authenticatedEmail(context: CallableRequest): string {
  requireMuDomain(context);
  return String(context.auth?.token.email ?? "").trim().toLowerCase();
}

/** Require an authenticated user who has been explicitly admitted to MU One. */
export async function requirePlatformAccess(context: CallableRequest): Promise<string> {
  const uid = requireMuDomain(context);
  const email = authenticatedEmail(context);
  if (email === PLATFORM_ADMIN_EMAIL) return uid;

  const access = await getDb().collection("platformAccess").doc(email).get();
  if (!access.exists || access.get("status") !== "granted") {
    throw new HttpsError(
      "permission-denied",
      "MU One is currently in private beta. Join the waitlist to request access."
    );
  }
  return uid;
}

export function requirePlatformAdmin(context: CallableRequest): string {
  const uid = requireMuDomain(context);
  if (authenticatedEmail(context) !== PLATFORM_ADMIN_EMAIL) {
    throw new HttpsError("permission-denied", "Administrator access required.");
  }
  return uid;
}
