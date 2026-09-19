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

  const hasDeadlineKeyword = DEADLINE_SIGNAL_TERMS.some(
    (term) =>
      subjectLower.includes(term) ||
      bodyLower.includes(term) ||
      snippetLower.includes(term)
  );

  const receivedAtDate = new Date(receivedAt);
  const dueDate = inferDueDate([subject, extractMailDateText(payload ?? {}), snippet].join("\n"), receivedAtDate);

  const gmailLink = `https://mail.google.com/mail/u/0/#inbox/${messageId}`;

  return {
    messageId,
    sender,
    subject,
    snippet,
    receivedAt,
    isDeadlineSignal: hasDeadlineKeyword || dueDate !== null,
    dueDate,
    gmailLink,
  };
}

/** Read every inline text representation for dates, including HTML-only details.
 * Attachments are deliberately excluded: they are not the email body.
 */
export function extractMailDateText(payload: Record<string, unknown>): string {
  if (payload["filename"]) return "";
  const mimeType = typeof payload["mimeType"] === "string" ? payload["mimeType"] : "";
  if (mimeType.startsWith("multipart/")) {
    const parts = Array.isArray(payload["parts"]) ? payload["parts"] : [];
    return parts.filter((part): part is Record<string, unknown> => !!part && typeof part === "object")
      .map(extractMailDateText).join("\n");
  }
  if (mimeType !== "text/plain" && mimeType !== "text/html") return "";
  const body = payload["body"] as Record<string, unknown> | undefined;
  return typeof body?.["data"] === "string"
    ? cleanTextForDateParsing(Buffer.from(body["data"], "base64url").toString("utf8")) : "";
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

// Kept identical in the frontend fallback and Functions parser; parity-tested.
const MAIL_MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

export function cleanTextForDateParsing(text: string): string {
  return text
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>|<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<https?:\/\/[^>]+>|\[https?:\/\/[^\]]+\]|https?:\/\/\S+/gi, ' ')
    .replace(/<\/?(?:sup|span|b|strong|em|i)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, value: string) => {
      const code = value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
    })
    .replace(/&(?:nbsp|ensp|emsp|thinsp);/gi, ' ')
    .replace(/&(?:ndash|mdash);/gi, '-')
    .replace(/&amp;/gi, '&')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[<>\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMailDate(text: string, receivedAt: Date, referenceToday: Date): string | null {
  const cleaned = cleanTextForDateParsing(text);
  if (!cleaned || isNaN(receivedAt.getTime())) return null;
  const months = Object.keys(MAIL_MONTHS).sort((a, b) => b.length - a.length).join('|');
  const ordinal = '(?:st|nd|rd|th)?';
  const year = '(?:[\\s,/-]+(\\d{4})(?!\\d|:))?';
  const patterns = [
    { kind: 'iso', regex: /(?<![\w./-])(\d{4})-(\d{1,2})-(\d{1,2})(?![\w/-])/gi },
    { kind: 'day', regex: new RegExp('(?<!\\w)(\\d{1,2})' + ordinal + '(?:\\s+of\\s+|[-/\\s]+)(' + months + ')\\b\\.?' + year, 'gi') },
    { kind: 'month', regex: new RegExp('\\b(' + months + ')\\b\\.?[-/\\s]+(\\d{1,2})' + ordinal + '\\b' + year, 'gi') },
    { kind: 'numeric', regex: /(?<![\w./-])(\d{1,2})([-/.])(\d{1,2})(?:\2(\d{4}|\d{2}))?(?![\w/.-]|\d)/gi },
    { kind: 'relative', regex: /\b(today|tomorrow|tonight)\b/gi },
  ];
  const matches: { kind: string; match: RegExpExecArray }[] = [];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(cleaned)) !== null) matches.push({ kind: pattern.kind, match });
  }
  matches.sort((a, b) => a.match.index - b.match.index || b.match[0].length - a.match[0].length);
  const candidates: { date: string; explicit: boolean }[] = [];
  const trigger = /\b(?:deadline|due|submit|submission|last\s+date|register\s+by|registration\s+(?:date|deadline|closes?|ends?)|apply\s+(?:by|before|on)|application\s+(?:deadline|closes?)|closes?|ends?|concludes?|by|before|until)\b/i;
  let previousEnd = 0;
  for (const { kind, match } of matches) {
    if (match.index < previousEnd) continue;
    // Do not let a trigger bind to another date beyond the first date it describes.
    const prefix = cleaned.slice(Math.max(previousEnd, match.index - 100), match.index)
      .split(/[.!?;](?:\s|$)/).pop() ?? '';
    const suffix = cleaned.slice(match.index + match[0].length, match.index + match[0].length + 40);
    const explicit = trigger.test(prefix) || (!match[0].endsWith('.') &&
      /^\s*(?:is\s+(?:the\s+)?)?(?:deadline|due\s+date|last\s+date)\b/i.test(suffix));
    previousEnd = match.index + match[0].length;
    let day: number;
    let month: number;
    let explicitYear: string | undefined;
    if (kind === 'relative') {
      if (!explicit) continue;
      const date = new Date(receivedAt);
      if (match[1].toLowerCase() === 'tomorrow') date.setDate(date.getDate() + 1);
      candidates.push({ date: mailDateIso(date), explicit });
      continue;
    } else if (kind === 'iso') {
      explicitYear = match[1]; month = Number(match[2]); day = Number(match[3]);
    } else if (kind === 'day') {
      day = Number(match[1]); month = MAIL_MONTHS[match[2].toLowerCase()]; explicitYear = match[3];
    } else if (kind === 'month') {
      month = MAIL_MONTHS[match[1].toLowerCase()]; day = Number(match[2]); explicitYear = match[3];
    } else {
      day = Number(match[1]); month = Number(match[3]); explicitYear = match[4];
      // Short hyphen/dot pairs can be team sizes or decimal numbers.
      if (!explicitYear && match[2] !== '/' && day <= 12 && !explicit) continue;
      // Unambiguous US numeric dates are accepted; ambiguous ones remain day-first.
      if (month > 12 && day <= 12) [day, month] = [month, day];
    }
    const baseYear = receivedAt.getFullYear();
    const years = explicitYear
      ? [Number(explicitYear) + (explicitYear.length === 2 ? 2000 : 0)]
      : [baseYear - 1, baseYear, baseYear + 1];
    const validDates = years.map(y => new Date(y, month - 1, day))
      .filter(d => d.getMonth() === month - 1 && d.getDate() === day);
    if (!validDates.length) continue;
    // Anchor year inference to receipt, not the day the user opens an old email.
    validDates.sort((a, b) => Math.abs(a.getTime() - receivedAt.getTime()) - Math.abs(b.getTime() - receivedAt.getTime()));
    candidates.push({ date: mailDateIso(validDates[0]), explicit });
  }
  const explicit = candidates.filter(c => c.explicit);
  const dates = [...new Set((explicit.length ? explicit : candidates).map(c => c.date))].sort();
  const today = mailDateIso(referenceToday);
  return dates.find(date => date >= today) ?? dates[dates.length - 1] ?? null;
}

function mailDateIso(date: Date): string {
  return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

export function inferDueDate(text: string, receivedAt: Date, referenceToday: Date = new Date()): string | null {
  return parseMailDate(text, receivedAt, referenceToday);
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
