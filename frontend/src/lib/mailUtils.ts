/**
 * Mail Due Date & Status Utilities
 * Robust extraction of deadlines from subject, snippet, and full email body.
 */

const MONTHS_MAP: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_NAMES = Object.keys(MONTHS_MAP).join('|');

export function cleanTextForDateParsing(text: string): string {
  return text
    .replace(/<https?:\/\/[^>]+>/gi, ' ')
    .replace(/\[https?:\/\/[^\]]+\]/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[<>[\]()]/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

function toIsoDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function toLocalDateIso(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Extracts a due date from email text (subject, snippet, or body).
 * Handles complex university formats like:
 *  - "Deadline to fill the FORM: 13 September, 11:59 PM"
 *  - "Please fill out this google form by 10 Sep if interested"
 *  - "The last registration date for the competition (independent application) is 20 Sep 2026."
 *  - "conclude on 15th Sept 2026, EOD"
 *  - "due today", "deadline tomorrow", "due 15-09-2026", "20/09/2026"
 */
export function extractMailDueDate(
  subject?: string,
  bodyOrSnippet?: string,
  receivedAt?: string,
  referenceToday?: Date
): string | null {
  const text = `${subject || ''}\n${bodyOrSnippet || ''}`;
  if (!text.trim()) return null;

  const baseDate = receivedAt ? new Date(receivedAt) : new Date();
  const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const today = referenceToday ? new Date(referenceToday) : new Date();
  const todayStr = toLocalDateIso(today);

  const cleaned = cleanTextForDateParsing(text);
  const lower = cleaned.toLowerCase();

  const candidates: { date: string; match: string }[] = [];

  const trigger =
    '(?:deadline(?:\\s*:|\\s+is|\\s*-)?|due(?:\\s+date)?(?:\\s*:|\\s+is|\\s*-)?|submit(?:\\s+by|\\s+before|\\s+on|\\s+until|\\s+on\\s+or\\s+before)?|submission(?:\\s+deadline|\\s+date|\\s+by|\\s+before|\\s+on)?|last\\s+date(?:\\s+for|\\s+to|\\s+is|\\s*:)?|last\\s+registration\\s+date|registration\\s+date|registration\\s+deadline|registration\\s+closes?|registration\\s+ends?|register\\s+by|apply\\s+by|apply\\s+before|apply\\s+on|application\\s+deadline|application\\s+closes?|fill\\s+(?:out\\s+)?(?:the\\s+|this\\s+)?(?:google\\s+)?form\\s+by|form\\s+by|form\\s+closes?|form\\s+deadline|closes?(?:\\s+on|\\s+by)?|ends?(?:\\s+on|\\s+by)?|concludes?(?:\\s+on|\\s+by)?|\\bby\\b|\\bbefore\\b|\\buntil\\b)';

  // Pattern 1: trigger ... Day Month [Year] or Day-Month / Day/Month
  const p1 = new RegExp(
    trigger + '([^\\n]{0,100}?)(\\b\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of\\s+|[-/\\s]+)(' + MONTH_NAMES + ')(?:[\\s,/-]+(\\d{4}))?\\b',
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = p1.exec(cleaned)) !== null) {
    const day = parseInt(m[2], 10);
    const month = MONTHS_MAP[m[3].toLowerCase()];
    let year = m[4] ? parseInt(m[4], 10) : validBase.getFullYear();
    if (!m[4] && month < validBase.getMonth() + 1 - 2) {
      year += 1;
    }
    if (month && day >= 1 && day <= 31) {
      candidates.push({
        date: toIsoDateStr(year, month, day),
        match: m[0],
      });
    }
  }

  // Pattern 2: trigger ... Month Day [Year] or Month-Day
  const p2 = new RegExp(
    trigger + '([^\\n]{0,100}?)(' + MONTH_NAMES + ')[-/\\s]+(\\d{1,2})(?:st|nd|rd|th)?(?:[\\s,/-]+(\\d{4}))?\\b',
    'gi'
  );
  while ((m = p2.exec(cleaned)) !== null) {
    const month = MONTHS_MAP[m[2].toLowerCase()];
    const day = parseInt(m[3], 10);
    let year = m[4] ? parseInt(m[4], 10) : validBase.getFullYear();
    if (!m[4] && month < validBase.getMonth() + 1 - 2) {
      year += 1;
    }
    if (month && day >= 1 && day <= 31) {
      candidates.push({
        date: toIsoDateStr(year, month, day),
        match: m[0],
      });
    }
  }

  // Pattern 3: trigger ... DD[-/]MM[-/]YYYY or trigger ... DD[-/]MM (DD Mon/MM without year)
  const p3 = new RegExp(
    trigger + '([^\\n]{0,100}?)(\\b\\d{1,2})[-/.](\\d{1,2})(?:[-/.](\\d{2,4}))?\\b',
    'gi'
  );
  while ((m = p3.exec(cleaned)) !== null) {
    const day = parseInt(m[2], 10);
    const month = parseInt(m[3], 10);
    let year = m[4] ? parseInt(m[4], 10) : validBase.getFullYear();
    if (m[4] && year < 100) year += 2000;
    if (!m[4] && month < validBase.getMonth() + 1 - 2) {
      year += 1;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      candidates.push({
        date: toIsoDateStr(year, month, day),
        match: m[0],
      });
    }
  }

  // Pattern 4: trigger ... YYYY-MM-DD
  const p4 = new RegExp(
    trigger + '([^\\n]{0,100}?)(\\d{4}-\\d{2}-\\d{2})\\b',
    'gi'
  );
  while ((m = p4.exec(cleaned)) !== null) {
    const d = new Date(m[2]);
    if (!isNaN(d.getTime())) {
      candidates.push({ date: m[2], match: m[0] });
    }
  }

  // Relative dates: "due today", "due tomorrow"
  if (candidates.length === 0) {
    const relTrigger = /\b(due|deadline|submit|submission|last\s+date|apply|closes?|ends?)\b[^.\n]{0,50}\b(today|tomorrow|tonight)\b/i;
    const relMatch = lower.match(relTrigger);
    if (relMatch) {
      const word = relMatch[2].toLowerCase();
      if (word === 'today' || word === 'tonight') {
        return toLocalDateIso(validBase);
      }
      if (word === 'tomorrow') {
        const tom = new Date(validBase);
        tom.setDate(tom.getDate() + 1);
        return toLocalDateIso(tom);
      }
    }
    return null;
  }

  // Deduplicate candidate dates
  const uniqueDates = Array.from(new Set(candidates.map((c) => c.date))).sort();

  // If any date is >= todayStr (active upcoming deadline), prioritize the earliest upcoming date
  const upcoming = uniqueDates.filter((d) => d >= todayStr);
  if (upcoming.length > 0) {
    return upcoming[0];
  }

  // Otherwise, all dates are passed: pick the latest past date
  return uniqueDates[uniqueDates.length - 1];
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
