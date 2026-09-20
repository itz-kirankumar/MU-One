import { onCall, HttpsError } from "firebase-functions/v2/https";
import { google } from "googleapis";
import { requirePlatformAccess } from "../utils/domainCheck";
import { getAccessToken } from "../auth/tokenStore";
import { withBackoff } from "../utils/backoff";

const MAX_RECIPIENTS = 100;
const MAX_SUBJECT_LENGTH = 250;
const MAX_BODY_LENGTH = 10000;
const MAX_HTML_LENGTH = 30000;
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;

interface OutgoingAttachment {
  filename: string;
  mimeType: string;
  data: Buffer;
}

interface MimeInput {
  recipients: string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: OutgoingAttachment[];
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function toBase64Url(value: string): string {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64Lines(value: string | Buffer): string {
  return (Buffer.isBuffer(value) ? value.toString("base64") : Buffer.from(value).toString("base64")).match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function safeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function safeFilename(value: string): string {
  return safeHeader(value).replace(/["\\]/g, "_").slice(0, 180) || "attachment";
}

export function buildMimeMessage(input: MimeInput): string {
  const alternativeBoundary = `muone-alt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const mixedBoundary = `muone-mixed-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const attachments = input.attachments ?? [];
  const headers = [
    `To: ${input.recipients.join(", ")}`,
    `Subject: =?utf-8?B?${Buffer.from(safeHeader(input.subject)).toString("base64")}?=`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
  ];

  const alternativeParts = [
    `--${alternativeBoundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(input.body),
  ];
  if (input.html) alternativeParts.push(
    `--${alternativeBoundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(input.html),
  );
  alternativeParts.push(`--${alternativeBoundary}--`);

  if (!attachments.length) {
    return [...headers, `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`, "", ...alternativeParts].join("\r\n");
  }

  const parts = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    ...alternativeParts,
  ];
  for (const attachment of attachments) {
    const filename = safeFilename(attachment.filename);
    parts.push(
      `--${mixedBoundary}`,
      `Content-Type: ${safeHeader(attachment.mimeType)}; name="${filename}"`,
      `Content-Disposition: attachment; filename="${filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(attachment.data),
    );
  }
  parts.push(`--${mixedBoundary}--`);
  return parts.join("\r\n");
}

function parseAttachments(raw: unknown): OutgoingAttachment[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_ATTACHMENTS) throw new HttpsError("invalid-argument", `attachments must contain at most ${MAX_ATTACHMENTS} files.`);
  let totalBytes = 0;
  return raw.map((item, index) => {
    if (!item || typeof item !== "object") throw new HttpsError("invalid-argument", `Attachment ${index + 1} is invalid.`);
    const record = item as Record<string, unknown>;
    if (typeof record.filename !== "string" || typeof record.dataBase64 !== "string") throw new HttpsError("invalid-argument", `Attachment ${index + 1} is missing file data.`);
    const data = Buffer.from(record.dataBase64, "base64");
    totalBytes += data.length;
    if (totalBytes > MAX_ATTACHMENT_BYTES) throw new HttpsError("invalid-argument", "Attachments must total 6 MB or less.");
    return { filename: safeFilename(record.filename), mimeType: typeof record.mimeType === "string" && record.mimeType ? record.mimeType.slice(0, 120) : "application/octet-stream", data };
  });
}

export const sendMail = onCall({ timeoutSeconds: 180, memory: "512MiB" }, async (request) => {
  const uid = await requirePlatformAccess(request);
  const data = request.data as Record<string, unknown>;
  if (!Array.isArray(data.recipients) || !data.recipients.length) throw new HttpsError("invalid-argument", "recipients must be a non-empty array.");
  if (data.recipients.length > MAX_RECIPIENTS) throw new HttpsError("invalid-argument", `Cannot send to more than ${MAX_RECIPIENTS} recipients at once.`);
  const recipients = [...new Set(data.recipients.map(recipient => {
    if (typeof recipient !== "string" || !isValidEmail(recipient)) throw new HttpsError("invalid-argument", "Every recipient must be a valid email address.");
    return recipient.trim();
  }))];
  if (typeof data.subject !== "string" || !data.subject.trim()) throw new HttpsError("invalid-argument", "subject must be a non-empty string.");
  if (typeof data.body !== "string" || !data.body.trim()) throw new HttpsError("invalid-argument", "body must be a non-empty string.");
  if (data.body.length > MAX_BODY_LENGTH) throw new HttpsError("invalid-argument", `body must not exceed ${MAX_BODY_LENGTH} characters.`);
  if (data.html !== undefined && (typeof data.html !== "string" || data.html.length > MAX_HTML_LENGTH)) throw new HttpsError("invalid-argument", `html must not exceed ${MAX_HTML_LENGTH} characters.`);

  const subject = safeHeader(data.subject).slice(0, MAX_SUBJECT_LENGTH);
  const body = data.body;
  const html = typeof data.html === "string" && data.html.trim() ? data.html : undefined;
  const attachments = parseAttachments(data.attachments);
  const bulkMode = data.bulkMode === true && recipients.length > 1;
  const threadId = !bulkMode && typeof data.threadId === "string" && data.threadId.trim() ? data.threadId.trim() : undefined;

  const accessToken = await getAccessToken(uid);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });
  const recipientGroups = bulkMode ? recipients.map(recipient => [recipient]) : [recipients];
  const messageIds: string[] = [];

  try {
    for (const group of recipientGroups) {
      const raw = toBase64Url(buildMimeMessage({ recipients: group, subject, body, html, attachments }));
      const requestBody: { raw: string; threadId?: string } = { raw };
      if (threadId) requestBody.threadId = threadId;
      const response = await withBackoff(() => gmail.users.messages.send({ userId: "me", requestBody }));
      if (response.data.id) messageIds.push(response.data.id);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new HttpsError("internal", `Gmail send failed after ${messageIds.length} message(s): ${message}`);
  }

  return { success: true, messageId: messageIds[0], messageIds, sentCount: messageIds.length };
});
