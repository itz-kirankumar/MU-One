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
  "registration",
  "register",
  "competition",
  "challenge",
  "contest",
  "last date",
  "closes on",
  "ends on",
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

  // Decode body data (handle standard base64 and base64url safely)
  const bodyObj = payload["body"] as Record<string, unknown> | undefined;
  const data = typeof bodyObj?.["data"] === "string" ? bodyObj["data"] : "";
  if (!data) return "";

  const normalizedBase64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = Buffer.from(normalizedBase64, "base64").toString("utf8");

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
 * Strips noisy URLs, brackets, and collapses whitespace before date parsing
 * so URLs and link tags do not break regex token distances or introduce periods.
 */
function cleanTextForDateParsing(text: string): string {
  return text
    .replace(/<https?:\/\/[^>]+>/gi, " ")
    .replace(/\[https?:\/\/[^\]]+\]/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[<>[\]()]/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Infers a due date from email text.
 * Robust, multi-pattern extractor supporting:
 *  - "Deadline to fill the FORM: 13 September, 11:59 PM"
 *  - "Please fill out this google form by 10 Sep if interested"
 *  - "The last registration date for the competition (independent application) is 20 Sep 2026."
 *  - "due today" / "deadline today" / "submit by today"
 *  - "due tomorrow" / "deadline tomorrow" / "submit by tomorrow"
 *  - "due YYYY-MM-DD"
 *  - "due dd/mm/yyyy" or "due dd-mm-yyyy"
 *  - "due 15 September [2026]"
 *  - "due September 15 [, 2026]"
 *
 * If multiple deadlines are found, prioritizes active upcoming dates closest to today,
 * or the most recent past deadline.
 *
 * @returns ISO date string (YYYY-MM-DD) or null.
 */
export function inferDueDate(
  text: string,
  receivedAt: Date,
  referenceToday: Date = new Date()
): string | null {
  if (!text || !text.trim()) return null;

  const cleaned = cleanTextForDateParsing(text);
  const lower = cleaned.toLowerCase();

  const candidates: { date: string; match: string }[] = [];

  const trigger =
    "(?:deadline(?:\\s*:|\\s+is|\\s*-)?|due(?:\\s+date)?(?:\\s*:|\\s+is|\\s*-)?|submit(?:\\s+by|\\s+before|\\s+on|\\s+until|\\s+on\\s+or\\s+before)?|submission(?:\\s+deadline|\\s+date|\\s+by|\\s+before|\\s+on)?|last\\s+date(?:\\s+for|\\s+to|\\s+is|\\s*:)?|last\\s+registration\\s+date|registration\\s+date|registration\\s+deadline|registration\\s+closes?|registration\\s+ends?|register\\s+by|apply\\s+by|apply\\s+before|apply\\s+on|application\\s+deadline|application\\s+closes?|fill\\s+(?:out\\s+)?(?:the\\s+|this\\s+)?(?:google\\s+)?form\\s+by|form\\s+by|form\\s+closes?|form\\s+deadline|closes?(?:\\s+on|\\s+by)?|ends?(?:\\s+on|\\s+by)?|concludes?(?:\\s+on|\\s+by)?|\\bby\\b|\\bbefore\\b|\\buntil\\b)";

  const MONTHS: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
    sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  };
  const MONTH_NAMES = Object.keys(MONTHS).join("|");

  // Pattern 1: trigger ... Day Month [Year] or Day-Month / Day/Month
  // Matches: "Deadline to fill the FORM: 13 September, 11:59 PM", "by 10 Sep", "conclude on 15th Sept 2026", "10-Sep", "10/Sep"
  const p1 = new RegExp(
    trigger + "([^\\n]{0,100}?)(\\b\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of\\s+|[-/\\s]+)(" + MONTH_NAMES + ")(?:[\\s,/-]+(\\d{4}))?\\b",
    "gi"
  );
  let m: RegExpExecArray | null;
  while ((m = p1.exec(cleaned)) !== null) {
    const day = parseInt(m[2], 10);
    const month = MONTHS[m[3].toLowerCase()];
    let year = m[4] ? parseInt(m[4], 10) : receivedAt.getFullYear();
    if (!m[4] && month < receivedAt.getMonth() + 1 - 2) {
      year += 1;
    }
    if (month && day >= 1 && day <= 31) {
      candidates.push({
        date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        match: m[0],
      });
    }
  }

  // Pattern 2: trigger ... Month Day [Year] or Month-Day
  // Matches: "due September 15, 2024", "Deadline: Sept 15th, 2026", "Sep-15"
  const p2 = new RegExp(
    trigger + "([^\\n]{0,100}?)(" + MONTH_NAMES + ")[-/\\s]+(\\d{1,2})(?:st|nd|rd|th)?(?:[\\s,/-]+(\\d{4}))?\\b",
    "gi"
  );
  while ((m = p2.exec(cleaned)) !== null) {
    const month = MONTHS[m[2].toLowerCase()];
    const day = parseInt(m[3], 10);
    let year = m[4] ? parseInt(m[4], 10) : receivedAt.getFullYear();
    if (!m[4] && month < receivedAt.getMonth() + 1 - 2) {
      year += 1;
    }
    if (month && day >= 1 && day <= 31) {
      candidates.push({
        date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        match: m[0],
      });
    }
  }

  // Pattern 3: trigger ... DD[-/]MM[-/]YYYY or trigger ... DD[-/]MM (DD Mon/MM without year)
  const p3 = new RegExp(
    trigger + "([^\\n]{0,100}?)(\\b\\d{1,2})[-/.](\\d{1,2})(?:[-/.](\\d{2,4}))?\\b",
    "gi"
  );
  while ((m = p3.exec(cleaned)) !== null) {
    const day = parseInt(m[2], 10);
    const month = parseInt(m[3], 10);
    let year = m[4] ? parseInt(m[4], 10) : receivedAt.getFullYear();
    if (m[4] && year < 100) year += 2000;
    if (!m[4] && month < receivedAt.getMonth() + 1 - 2) {
      year += 1;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      candidates.push({
        date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        match: m[0],
      });
    }
  }

  // Pattern 4: trigger ... YYYY-MM-DD
  const p4 = new RegExp(
    trigger + "([^\\n]{0,100}?)(\\d{4}-\\d{2}-\\d{2})\\b",
    "gi"
  );
  while ((m = p4.exec(cleaned)) !== null) {
    const d = new Date(m[2]);
    if (!isNaN(d.getTime())) {
      candidates.push({ date: m[2], match: m[0] });
    }
  }

  // If no calendar dates found, check relative triggers: "due today", "due tomorrow"
  if (candidates.length === 0) {
    const relTrigger = /\b(due|deadline|submit|submission|last\s+date|apply|closes?|ends?)\b[^.\n]{0,50}\b(today|tomorrow|tonight)\b/i;
    const relMatch = lower.match(relTrigger);
    if (relMatch) {
      const word = relMatch[2].toLowerCase();
      if (word === "today" || word === "tonight") {
        return toIsoDate(receivedAt);
      }
      if (word === "tomorrow") {
        const tom = new Date(receivedAt);
        tom.setDate(tom.getDate() + 1);
        return toIsoDate(tom);
      }
    }
    return null;
  }

  // Deduplicate candidate dates
  const uniqueDates = Array.from(new Set(candidates.map((c) => c.date))).sort();
  const todayStr = toIsoDate(referenceToday);

  // If any candidate date is >= today (active upcoming deadline), pick the earliest upcoming deadline
  const upcoming = uniqueDates.filter((d) => d >= todayStr);
  if (upcoming.length > 0) {
    return upcoming[0];
  }

  // Otherwise, all dates are in the past: pick the latest past date (the deadline that just expired)
  return uniqueDates[uniqueDates.length - 1];
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
