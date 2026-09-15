import { HttpsError } from "firebase-functions/v2/https";

/**
 * Validates a title string.
 * @param title - The title value to validate (unknown type from request).
 * @param maxLen - Maximum allowed character length.
 * @returns The trimmed title string.
 */
export function validateTitle(title: unknown, maxLen: number): string {
  if (typeof title !== "string") {
    throw new HttpsError("invalid-argument", "Title must be a string.");
  }
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new HttpsError("invalid-argument", "Title must not be empty.");
  }
  if (trimmed.length > maxLen) {
    throw new HttpsError(
      "invalid-argument",
      `Title must not exceed ${maxLen} characters.`
    );
  }
  return trimmed;
}

/**
 * Validates a date value and returns an ISO 8601 date string (YYYY-MM-DD).
 * @param value - The date value to validate (unknown type from request).
 * @returns ISO date string (YYYY-MM-DD).
 */
export function validateDate(value: unknown): string {
  if (typeof value !== "string") {
    throw new HttpsError("invalid-argument", "Date must be a string.");
  }
  const trimmed = value.trim();
  // Accept ISO 8601 date (YYYY-MM-DD) or ISO 8601 datetime
  const dateObj = new Date(trimmed);
  if (isNaN(dateObj.getTime())) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid date: "${trimmed}". Expected ISO 8601 format.`
    );
  }
  // Return just the date portion
  return dateObj.toISOString().slice(0, 10);
}

/**
 * Validates an importance value.
 * @param value - The importance value to validate (unknown type from request).
 * @returns 'important' or 'must_do'.
 */
export function validateImportance(value: unknown): "important" | "must_do" {
  if (value !== "important" && value !== "must_do") {
    throw new HttpsError(
      "invalid-argument",
      'Importance must be "important" or "must_do".'
    );
  }
  return value;
}
