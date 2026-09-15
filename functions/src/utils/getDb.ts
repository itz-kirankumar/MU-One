import * as admin from "firebase-admin";
import { getFirestore, Firestore } from "firebase-admin/firestore";

/**
 * Returns the Firestore instance configured with the correct databaseId.
 * Supports projects with custom database names like 'default' vs '(default)'.
 */
export function getDb(): Firestore {
  const databaseId = process.env.APP_DATABASE_ID || "default";
  if (process.env.NODE_ENV === "test") {
    return admin.firestore();
  }
  try {
    return getFirestore(databaseId);
  } catch {
    return admin.firestore();
  }
}
