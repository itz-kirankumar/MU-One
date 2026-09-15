import { onCall, HttpsError } from "firebase-functions/v2/https";
import { google } from "googleapis";
import { requireMuDomain } from "../utils/domainCheck";
import { getAccessToken } from "../auth/tokenStore";
import { withBackoff } from "../utils/backoff";

const MAX_RECIPIENTS = 20;
const MAX_SUBJECT_LENGTH = 250;
const MAX_BODY_LENGTH = 10000;

/**
 * Validates an email address format.
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Encodes a string as base64url (URL-safe base64 without padding).
 */
function toBase64Url(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Callable: sends an email via Gmail API on behalf of the authenticated user.
 *
 * - Auth + domain check
 * - Validates recipients (1–20 valid email addresses), subject (≤250), body (≤10000)
 * - Builds RFC 2822 message, base64url encodes it
 * - Calls Gmail API: users.messages.send
 * - Returns { messageId, threadId }
 *
 * Security: Never logs email body or recipient addresses.
 */
export const sendMail = onCall(async (request) => {
  const uid = requireMuDomain(request);

  const {
    recipients: rawRecipients,
    subject: rawSubject,
    body: rawBody,
    threadId: rawThreadId,
  } = request.data as Record<string, unknown>;

  // Validate recipients
  if (!Array.isArray(rawRecipients) || rawRecipients.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "recipients must be a non-empty array."
    );
  }
  if (rawRecipients.length > MAX_RECIPIENTS) {
    throw new HttpsError(
      "invalid-argument",
      `Cannot send to more than ${MAX_RECIPIENTS} recipients at once.`
    );
  }
  const recipients: string[] = rawRecipients.map((r: unknown) => {
    if (typeof r !== "string") {
      throw new HttpsError("invalid-argument", "Each recipient must be a string.");
    }
    const trimmed = r.trim();
    if (!isValidEmail(trimmed)) {
      throw new HttpsError("invalid-argument", `Invalid email address: "${trimmed}".`);
    }
    return trimmed;
  });

  // Validate subject
  if (typeof rawSubject !== "string" || !rawSubject.trim()) {
    throw new HttpsError("invalid-argument", "subject must be a non-empty string.");
  }
  const subject = rawSubject.trim().slice(0, MAX_SUBJECT_LENGTH);

  // Validate body
  if (typeof rawBody !== "string" || !rawBody.trim()) {
    throw new HttpsError("invalid-argument", "body must be a non-empty string.");
  }
  if (rawBody.length > MAX_BODY_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `body must not exceed ${MAX_BODY_LENGTH} characters.`
    );
  }
  const body = rawBody;

  const threadId =
    typeof rawThreadId === "string" && rawThreadId.trim()
      ? rawThreadId.trim()
      : undefined;

  // Get access token
  const accessToken = await getAccessToken(uid);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  // Build RFC 2822 email message
  const toLine = recipients.join(", ");
  const date = new Date().toUTCString();
  const messageParts = [
    `To: ${toLine}`,
    `Subject: =?utf-8?B?${Buffer.from(subject).toString("base64")}?=`,
    `Date: ${date}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(body).toString("base64"),
  ];
  const rawMessage = messageParts.join("\r\n");
  const encodedMessage = toBase64Url(rawMessage);

  // Send via Gmail API
  let messageId: string;
  let returnedThreadId: string;
  try {
    const sendBody: Record<string, unknown> = { raw: encodedMessage };
    if (threadId) sendBody["threadId"] = threadId;

    const response = await withBackoff(() =>
      gmail.users.messages.send({
        userId: "me",
        requestBody: sendBody,
      })
    );

    messageId = response.data.id ?? "";
    returnedThreadId = response.data.threadId ?? "";
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError("internal", `Gmail send failed: ${msg}`);
  }

  return { messageId, threadId: returnedThreadId };
});
