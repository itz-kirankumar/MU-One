import { CallableRequest, HttpsError } from "firebase-functions/v2/https";

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
