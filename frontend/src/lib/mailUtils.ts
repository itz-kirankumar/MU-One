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

export function toLocalDateIso(date: Date = new Date()): string {
  return mailDateIso(date);
}

export function extractMailDueDate(subject?: string, bodyOrSnippet?: string, receivedAt?: string, referenceToday: Date = new Date()): string | null {
  const base = receivedAt ? new Date(receivedAt) : new Date();
  return parseMailDate([subject, bodyOrSnippet].filter(Boolean).join("\n"), isNaN(base.getTime()) ? new Date() : base, referenceToday);
}

/**
 * Categorizes a mail's deadline status relative to today:
 * - 'today': Deadline is today (highest priority!)
 * - 'upcoming': Deadline is in the future
 * - 'passed': Deadline has passed (mark in bold RED!)
 * - 'none': No deadline detected
 */
export function getMailDeadlineStatus(
  dueDate: string | null | undefined,
  todayStr: string = toLocalDateIso()
): 'today' | 'upcoming' | 'passed' | 'none' {
  if (!dueDate) return 'none';
  const cleanDue = dueDate.slice(0, 10);
  if (cleanDue === todayStr) return 'today';
  if (cleanDue < todayStr) return 'passed';
  return 'upcoming';
}

export function formatMailDueDate(isoDate: string): string {
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, monthIndex, day);
    if (!isNaN(d.getTime())) {
      const currentYear = new Date().getFullYear();
      const monthStr = d.toLocaleDateString('en-GB', { month: 'short' });
      if (year !== currentYear) {
        return `${day} ${monthStr} ${year}`;
      }
      return `${day} ${monthStr}`;
    }
  }
  return isoDate;
}
