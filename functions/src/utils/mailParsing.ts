/**
 * Mail parsing utilities, ported from Flask app.py.
 * Normalizes raw Gmail messages into a consistent MU One schema.
 */

export interface NormalizedMailSignal {
  messageId: string;
  sender: string;
  subject: string;
  snippet: string;
  receivedAt: string; // ISO
  isDeadlineSignal: boolean;
  dueDate: string | null; // ISO date (YYYY-MM-DD) or null
  gmailLink: string;
}

const DEADLINE_SIGNAL_TERMS = [
  "deadline",
  "due",
  "submit",
  "submission",
  "assignment",
  "quiz",
  "assessment",
  "deliverable",
  "placement",
  "opportunity",
  "application",
];

/**
 * Normalizes a raw Gmail message object into a NormalizedMailSignal.
 */
export function normalizeMessage(message: Record<string, unknown>): NormalizedMailSignal {
  const messageId = typeof message["id"] === "string" ? message["id"] : "";
  const snippet = typeof message["snippet"] === "string" ? message["snippet"] : "";

  const payload = message["payload"] as Record<string, unknown> | undefined;
  const headers = (payload?.["headers"] as Array<Record<string, string>>) ?? [];

  const getHeader = (name: string): string => {
    const h = headers.find(
      (h) => h["name"]?.toLowerCase() === name.toLowerCase()
    );
    return h?.["value"] ?? "";
  };

  const fromHeader = getHeader("From");
  const subject = getHeader("Subject");
  const dateHeader = getHeader("Date");

  const sender = fromHeader;
  const receivedAt = dateHeader
    ? new Date(dateHeader).toISOString()
    : new Date().toISOString();

  const bodyText = extractPlainText(payload ?? {});
  const subjectLower = subject.toLowerCase();
  const bodyLower = bodyText.toLowerCase();
  const snippetLower = snippet.toLowerCase();

  const isDeadlineSignal = DEADLINE_SIGNAL_TERMS.some(
    (term) =>
      subjectLower.includes(term) ||
      bodyLower.includes(term) ||
      snippetLower.includes(term)
  );

  const receivedAtDate = new Date(receivedAt);
  const dueDate = inferDueDate(subject + "\n" + bodyText, receivedAtDate);

  const gmailLink = `https://mail.google.com/mail/u/0/#inbox/${messageId}`;

  return {
    messageId,
    sender,
    subject,
    snippet,
    receivedAt,
    isDeadlineSignal,
    dueDate,
    gmailLink,
  };
}

/**
 * Extracts plain text content from a Gmail message payload.
 * Prefers text/plain parts; falls back to stripping HTML from text/html.
 * Handles multipart messages recursively.
 */
export function extractPlainText(payload: Record<string, unknown>): string {
  const mimeType =
    typeof payload["mimeType"] === "string" ? payload["mimeType"] : "";

  // Handle multipart recursively
  if (mimeType.startsWith("multipart/")) {
    const parts = payload["parts"] as Array<Record<string, unknown>> | undefined;
    if (parts && parts.length > 0) {
      // Prefer text/plain first
      const plainPart = parts.find((p) => {
        const mt = typeof p["mimeType"] === "string" ? p["mimeType"] : "";
        return mt === "text/plain";
      });
      if (plainPart) {
        return extractPlainText(plainPart);
      }
      // Try text/html
      const htmlPart = parts.find((p) => {
        const mt = typeof p["mimeType"] === "string" ? p["mimeType"] : "";
        return mt === "text/html";
      });
      if (htmlPart) {
        return extractPlainText(htmlPart);
      }
      // Recurse into nested multipart
      for (const part of parts) {
        const text = extractPlainText(part as Record<string, unknown>);
        if (text.trim()) return text;
      }
    }
    return "";
  }

  // Decode body data
  const bodyObj = payload["body"] as Record<string, unknown> | undefined;
  const data = typeof bodyObj?.["data"] === "string" ? bodyObj["data"] : "";
  if (!data) return "";

  const decoded = Buffer.from(data, "base64").toString("utf8");

  if (mimeType === "text/html") {
    return stripHtml(decoded);
  }

  return decoded;
}

/**
 * Strips HTML tags from a string and decodes basic HTML entities.
 * NEVER returns raw HTML.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Infers a due date from email text.
 * Only returns a date when an explicit pattern is found — never guesses.
 *
 * Supported patterns:
 *  - "due today" / "deadline today" / "submit by today"
 *  - "due tomorrow" / "deadline tomorrow" / "submit by tomorrow"
 *  - "due YYYY-MM-DD"
 *  - "due dd/mm/yyyy"
 *  - "due 15 September" / "due 15 September 2024"
 *  - "due September 15" / "due September 15, 2024"
 *
 * @returns ISO date string (YYYY-MM-DD) or null.
 */
export function inferDueDate(text: string, receivedAt: Date): string | null {
  const lower = text.toLowerCase();

  const triggerPattern =
    /\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\b/i;
  if (!triggerPattern.test(text)) {
    return null;
  }

  // "due today" / "submit by today"
  if (/\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\b[^.]{0,35}\btoday\b/i.test(lower)) {
    return toIsoDate(receivedAt);
  }

  // "due tomorrow"
  if (/\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\b[^.]{0,35}\btomorrow\b/i.test(lower)) {
    const tomorrow = new Date(receivedAt);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toIsoDate(tomorrow);
  }

  // "due YYYY-MM-DD"
  const isoMatch = text.match(
    /\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\b[^.\d]{0,35}(\d{4}-\d{2}-\d{2})\b/i
  );
  if (isoMatch) {
    const d = new Date(isoMatch[2]);
    if (!isNaN(d.getTime())) return isoMatch[2];
  }

  // "due dd/mm/yyyy" or "due dd-mm-yyyy"
  const dmyMatch = text.match(
    /\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\b[^\d]{0,35}(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/i
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[2], 10);
    const month = parseInt(dmyMatch[3], 10);
    let year = parseInt(dmyMatch[4], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime())) return toIsoDate(d);
  }

  const MONTHS: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
    sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  };
  const MONTH_NAMES = Object.keys(MONTHS).join("|");

  // "due 15 September [2024]" or "Deadline: 15th Sept 2026"
  const dayMonthYearMatch = text.match(
    new RegExp(
      `\\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\\b[^.\\d]{0,35}(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTH_NAMES})(?:,?\\s*(\\d{4}))?\\b`,
      "i"
    )
  );
  if (dayMonthYearMatch) {
    const day = parseInt(dayMonthYearMatch[2], 10);
    const monthName = dayMonthYearMatch[3].toLowerCase();
    const month = MONTHS[monthName];
    const year = dayMonthYearMatch[4]
      ? parseInt(dayMonthYearMatch[4], 10)
      : receivedAt.getFullYear();
    if (month) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return toIsoDate(d);
    }
  }

  // "due September 15 [, 2024]" or "Deadline: Sept 15th, 2026"
  const monthDayYearMatch = text.match(
    new RegExp(
      `\\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\\b[^.\\d]{0,35}(${MONTH_NAMES})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`,
      "i"
    )
  );
  if (monthDayYearMatch) {
    const monthName = monthDayYearMatch[2].toLowerCase();
    const month = MONTHS[monthName];
    const day = parseInt(monthDayYearMatch[3], 10);
    const year = monthDayYearMatch[4]
      ? parseInt(monthDayYearMatch[4], 10)
      : receivedAt.getFullYear();
    if (month) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return toIsoDate(d);
    }
  }

  return null;
}

/**
 * Extracts the sender's domain from a From header value.
 * E.g. "John Doe <john@example.com>" → "example.com"
 */
export function senderDomain(fromHeader: string): string {
  const emailMatch = fromHeader.match(/<([^>]+)>/) ?? fromHeader.match(/(\S+@\S+)/);
  if (emailMatch) {
    const email = emailMatch[1];
    const parts = email.split("@");
    if (parts.length === 2) {
      return parts[1].toLowerCase().trim();
    }
  }
  return "";
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
