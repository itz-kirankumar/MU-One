import { onCall, HttpsError } from "firebase-functions/v2/https";
import { google } from "googleapis";
import { requirePlatformAccess } from "../utils/domainCheck";
import { getAccessToken } from "../auth/tokenStore";
import { withBackoff } from "../utils/backoff";
import { sanitizeEmailHtml, formatPlainTextToHtml } from "../utils/sanitizeEmailHtml";
import { extractMailDateText, inferDueDate } from "../utils/mailParsing";
import { getDb } from "../utils/getDb";

interface MailAttachmentInfo {
  filename: string;
  mimeType: string;
  size: number;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function findAttachments(parts: Array<Record<string, unknown>>): MailAttachmentInfo[] {
  const attachments: MailAttachmentInfo[] = [];
  for (const part of parts) {
    const filename = typeof part["filename"] === "string" ? part["filename"] : "";
    const mimeType = typeof part["mimeType"] === "string" ? part["mimeType"] : "";
    const body = part["body"] as Record<string, unknown> | undefined;
    const size = typeof body?.["size"] === "number" ? body["size"] : 0;
    const attachmentId = typeof body?.["attachmentId"] === "string" ? body["attachmentId"] : "";

    // Ignore inline images without filenames; only keep actual files/documents
    if (filename && (attachmentId || size > 0)) {
      attachments.push({ filename, mimeType, size });
    }

    if (Array.isArray(part["parts"])) {
      attachments.push(...findAttachments(part["parts"] as Array<Record<string, unknown>>));
    }
  }
  return attachments;
}

function extractEmailContent(payload: Record<string, unknown>): { html: string; text: string } {
  let html = "";
  let text = "";

  function traverse(part: Record<string, unknown>) {
    const mimeType = typeof part["mimeType"] === "string" ? part["mimeType"] : "";
    const body = part["body"] as Record<string, unknown> | undefined;
    const data = typeof body?.["data"] === "string" ? body["data"] : "";
    const filename = typeof part["filename"] === "string" ? part["filename"] : "";

    // Skip attachments so we never dump raw file data into the body text
    if (filename) return;

    if (data) {
      const decoded = decodeBase64Url(data);
      if (mimeType === "text/html" && !html) {
        html = decoded;
      } else if (mimeType === "text/plain" && !text) {
        text = decoded;
      }
    }

    if (Array.isArray(part["parts"])) {
      for (const subPart of part["parts"]) {
        traverse(subPart as Record<string, unknown>);
      }
    }
  }

  traverse(payload);
  return { html, text };
}

/**
 * Callable: fetches the full body of a Gmail message for in-app viewing.
 *
 * - Auth + domain check
 * - Validates messageId
 * - Fetches full message from Gmail API
 * - Sanitizes rich HTML (strips scripts, trackers, preserves structure)
 * - Collects attachment metadata without base64 binary blobs
 * - Returns { messageId, from, to, subject, date, body, formattedHtml, attachments, snippet }
 */
export const getFullMailMessage = onCall(async (request) => {
  const uid = await requirePlatformAccess(request);

  const { messageId: rawMessageId } = request.data as Record<string, unknown>;

  if (typeof rawMessageId !== "string" || !rawMessageId.trim()) {
    throw new HttpsError(
      "invalid-argument",
      "messageId must be a non-empty string."
    );
  }
  const messageId = rawMessageId.trim();

  const accessToken = await getAccessToken(uid);
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  let messageData: Record<string, unknown>;
  try {
    const response = await withBackoff(() =>
      gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      })
    );
    messageData = response.data as Record<string, unknown>;
  } catch (err: unknown) {
    if (err instanceof HttpsError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404") || msg.includes("not found")) {
      throw new HttpsError("not-found", `Message ${messageId} not found.`);
    }
    throw new HttpsError("internal", `Gmail API error: ${msg}`);
  }

  // Extract headers
  const payload = (messageData["payload"] as Record<string, unknown>) ?? {};
  const headers = (payload["headers"] as Array<Record<string, string>>) ?? [];

  const getHeader = (name: string): string => {
    const h = headers.find(
      (h) => h["name"]?.toLowerCase() === name.toLowerCase()
    );
    return h?.["value"] ?? "";
  };

  const from = getHeader("From");
  const to = getHeader("To");
  const subject = getHeader("Subject");
  const date = getHeader("Date");
  const snippet =
    typeof messageData["snippet"] === "string" ? messageData["snippet"] : "";

  // Extract content and attachments
  const { html, text } = extractEmailContent(payload);
  const partsList = Array.isArray(payload["parts"])
    ? (payload["parts"] as Array<Record<string, unknown>>)
    : [];
  const attachments = findAttachments(partsList);

  const formattedHtml = html
    ? sanitizeEmailHtml(html)
    : formatPlainTextToHtml(text || snippet);

  const receivedAtDate = date ? new Date(date) : new Date();
  const validReceivedAt = isNaN(receivedAtDate.getTime()) ? new Date() : receivedAtDate;
  const fullContent = [subject, extractMailDateText(payload), snippet].join("\n");
  const extractedDueDate = inferDueDate(fullContent, validReceivedAt);

  // If a due date is discovered from full mail body, save it to Firestore mailSignals
  if (extractedDueDate) {
    const db = getDb();
    db.collection("users")
      .doc(uid)
      .collection("mailSignals")
      .doc(messageId)
      .set({ dueDate: extractedDueDate }, { merge: true })
      .catch(() => {});
  }

  return {
    messageId,
    from,
    to,
    subject,
    date,
    body: text || snippet,
    bodyText: text || snippet,
    formattedHtml,
    attachments,
    snippet,
    extractedDueDate: extractedDueDate ?? undefined,
  };
});
