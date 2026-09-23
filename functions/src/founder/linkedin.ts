/**
 * Parses LinkedIn's own "Save to PDF" profile export into a `LinkedInRecord`.
 *
 * The student exports their profile from LinkedIn, the browser extracts the text
 * in the browser, and this module turns that text into structure. The separate
 * LinkedIn OIDC flow retrieves only basic identity fields. Experience and
 * skills come from this student-supplied export or manual entry.
 *
 * The export has a stable shape but not a strict one, so this parser is
 * deliberately forgiving: it anchors on the date ranges, which are the one thing
 * every role has, and reads outward from them. A partially parsed record is more
 * useful than a thrown error, because the student can see and correct the result
 * before it is saved.
 */

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Section headings LinkedIn emits on their own line, lowercased. */
const SECTION_HEADINGS = new Set([
  'contact', 'top skills', 'skills', 'languages', 'certifications', 'honors-awards',
  'honors & awards', 'publications', 'patents', 'projects', 'courses', 'summary',
  'experience', 'education', 'volunteer experience', 'organizations', 'test scores',
  'recommendations received', 'interests',
]);

const PAGE_ARTIFACT = /^page\s+\d+\s+of\s+\d+$/i;
/** "January 2023 - Present  (1 year 5 months)", "2021 - 2023", "Jan 2023 - Mar 2024". */
const DATE_RANGE = /^([A-Za-z]{3,9}\.?\s+\d{4}|\d{4})\s*[-–—]\s*(present|[A-Za-z]{3,9}\.?\s+\d{4}|\d{4})\b\s*(?:\(([^)]*)\))?\s*$/i;
/** A standalone duration line, which LinkedIn emits above grouped roles. */
const DURATION_ONLY = /^(?:\d+\s*(?:years?|yrs?|months?|mos?)\s*)+$/i;
const LOCATION_HINT = /(remote|hybrid|on-?site|india|united states|,\s*[A-Z][a-z]+$)/i;

export class LinkedInParseError extends Error {}

/** Absolute month index, so overlapping roles can be merged. */
function monthIndex(token: string): number | null {
  const trimmed = token.trim().toLowerCase().replace(/\./g, '');
  const yearOnly = /^\d{4}$/.exec(trimmed);
  if (yearOnly) return Number(yearOnly[0]) * 12;
  const parts = /^([a-z]{3,9})\s+(\d{4})$/.exec(trimmed);
  if (!parts) return null;
  const month = MONTH_NAMES.findIndex((name) => name.startsWith(parts[1].slice(0, 3)));
  return month < 0 ? null : Number(parts[2]) * 12 + month;
}

/** Reads "1 year 5 months" / "3 mos" / "2 yrs" into a month count. */
export function parseDuration(text: string): number {
  const years = /(\d+)\s*(?:years?|yrs?)/i.exec(text);
  const months = /(\d+)\s*(?:months?|mos?)/i.exec(text);
  if (!years && !months) return 0;
  return (years ? Number(years[1]) * 12 : 0) + (months ? Number(months[1]) : 0);
}

export interface ParsedPeriod {
  period: string;
  months: number;
  start: number | null;
  end: number | null;
}

/**
 * Prefers LinkedIn's own parenthesised duration over arithmetic on the dates,
 * because the dates are month-precision and the duration is what LinkedIn shows
 * the student. Falls back to the span when there is no duration.
 */
export function parsePeriod(line: string): ParsedPeriod | null {
  const match = DATE_RANGE.exec(line.trim());
  if (!match) return null;
  const [, startToken, endToken, duration] = match;
  const start = monthIndex(startToken);
  const isPresent = /present/i.test(endToken);
  const now = new Date();
  const end = isPresent ? now.getFullYear() * 12 + now.getMonth() : monthIndex(endToken);

  const stated = duration ? parseDuration(duration) : 0;
  const spanned = start !== null && end !== null ? Math.max(1, end - start + 1) : 0;

  return {
    period: line.trim(),
    months: stated || spanned,
    start,
    end,
  };
}

/** Sums month coverage, counting an overlapping span once. */
export function mergedMonths(periods: ParsedPeriod[]): number {
  const spans = periods
    .filter((entry): entry is ParsedPeriod & { start: number; end: number } =>
      entry.start !== null && entry.end !== null && entry.end >= entry.start)
    .map((entry) => [entry.start, entry.end] as const)
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let cursor = -Infinity;
  for (const [start, end] of spans) {
    const from = Math.max(start, cursor + 1);
    if (end >= from) total += end - from + 1;
    cursor = Math.max(cursor, end);
  }
  // Roles whose dates would not parse still count, just without overlap merging.
  const unspanned = periods.filter((entry) => entry.start === null || entry.end === null);
  return total + unspanned.reduce((sum, entry) => sum + entry.months, 0);
}

function cleanLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && !PAGE_ARTIFACT.test(line));
}

/** Splits the export into its labelled sections, keeping the unlabelled head. */
function sectionize(lines: string[]): { head: string[]; sections: Map<string, string[]> } {
  const head: string[] = [];
  const sections = new Map<string, string[]>();
  let current: string[] | null = null;

  for (const line of lines) {
    const heading = line.toLowerCase();
    if (SECTION_HEADINGS.has(heading)) {
      current = sections.get(heading) ?? [];
      sections.set(heading, current);
      continue;
    }
    (current ?? head).push(line);
  }
  return { head, sections };
}

interface ParsedRole {
  title: string;
  company: string;
  period: string;
  months: number;
  description: string;
  start: number | null;
  end: number | null;
}

/**
 * Roles are found by locating every date range in the Experience section.
 * A group may omit the company on its second role, so retain the previous
 * company unless a short, heading-like line precedes the next title.
 */
function parseExperience(lines: string[]): ParsedRole[] {
  const roles: ParsedRole[] = [];
  const dateIndexes = lines
    .map((line, index) => ({ index, parsed: parsePeriod(line) }))
    .filter((entry): entry is { index: number; parsed: ParsedPeriod } => entry.parsed !== null);

  const companyBefore = (dateIndex: number): string => {
    const candidate = lines[dateIndex - 2] ?? '';
    return candidate.length <= 100 && !/[.!?]$/.test(candidate)
      && !/^(?:by|built|led|managed|owned|shipped|developed|created|worked)\b/i.test(candidate)
      && !DURATION_ONLY.test(candidate) && !parsePeriod(candidate) ? candidate : '';
  };

  dateIndexes.forEach((entry, position) => {
    const title = lines[entry.index - 1] ?? '';
    const company = companyBefore(entry.index) || roles[roles.length - 1]?.company || '';

    const nextDate = dateIndexes[position + 1];
    // Stop two lines short of the next role so its company and title are not
    // swallowed into this role's description.
    const bodyEnd = nextDate
      ? Math.max(entry.index + 1, nextDate.index - (companyBefore(nextDate.index) ? 2 : 1))
      : lines.length;
    const body = lines.slice(entry.index + 1, bodyEnd);
    const description = body
      .filter((line, index) => !(index === 0 && LOCATION_HINT.test(line) && line.length < 60))
      .join(' ')
      .slice(0, 2000);

    if (!title && !company) return;
    roles.push({
      title: title.slice(0, 200),
      company: company.slice(0, 200),
      period: entry.parsed.period,
      months: entry.parsed.months,
      description,
      start: entry.parsed.start,
      // A saved export may be months old. For a Present role with LinkedIn's
      // stated duration, count the coverage at export time, not at import time.
      end: /present/i.test(entry.parsed.period) && /\([^)]*\)/.test(entry.parsed.period)
        && entry.parsed.start !== null
        ? entry.parsed.start + entry.parsed.months - 1
        : entry.parsed.end,
    });
  });

  return roles.slice(0, 25);
}

function parseEducation(lines: string[]) {
  const entries: Array<{ school: string; degree: string; period: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const school = lines[index];
    if (!school || parsePeriod(school)) continue;
    const next = lines[index + 1] ?? '';
    // LinkedIn puts the years on the degree line, in parentheses, after a dot.
    const years = /\((\d{4})\s*[-–—]\s*(\d{4}|present)\)/i.exec(next);
    entries.push({
      school: school.slice(0, 200),
      degree: next.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*·\s*$/, '').replace(/^·\s*/, '').slice(0, 200),
      period: years ? `${years[1]} - ${years[2]}` : '',
    });
    index += 1;
  }
  return entries.slice(0, 10);
}

function parseHead(head: string[]) {
  const name = head[0] ?? '';
  // The headline can wrap across lines; anything before a location-looking line
  // or the end of the head block belongs to it.
  const rest = head.slice(1);
  const locationAt = rest.findIndex((line) => LOCATION_HINT.test(line) && line.length < 80);
  const headline = (locationAt > 0 ? rest.slice(0, locationAt) : rest.slice(0, 2)).join(' ');
  return {
    name: name.slice(0, 150),
    headline: headline.slice(0, 300),
    location: (locationAt >= 0 ? rest[locationAt] : '').slice(0, 150),
  };
}

export interface ParsedLinkedIn {
  name: string;
  profileUrl: string;
  headline: string;
  location: string;
  summary: string;
  roles: Array<{ title: string; company: string; period: string; months: number; description: string }>;
  education: Array<{ school: string; degree: string; period: string }>;
  skills: string[];
  totalMonths: number;
}

export function parseLinkedInExport(text: string): ParsedLinkedIn {
  if (!text || text.trim().length < 80) {
    throw new LinkedInParseError('That file had almost no text in it. Export your profile from LinkedIn with "Save to PDF".');
  }

  const lines = cleanLines(text);
  const { head, sections } = sectionize(lines);

  const experience = sections.get('experience') ?? [];
  const summaryLines = sections.get('summary') ?? [];
  const hasStructure = experience.length > 0 || summaryLines.length > 0 || sections.has('education');
  if (!hasStructure) {
    throw new LinkedInParseError(
      'This does not look like a LinkedIn profile export. On your profile, use Resources → Save to PDF, then upload that file.',
    );
  }

  const roles = parseExperience(experience);
  const skills = [...(sections.get('top skills') ?? []), ...(sections.get('skills') ?? [])]
    .flatMap((line) => line.split(/\s*[·•|]\s*/))
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 1 && skill.length < 60);

  const contact = sections.get('contact') ?? [];
  const urlLine = [...contact, ...head].find((line) => /linkedin\.com\/in\//i.test(line)) ?? '';
  const url = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+/i.exec(urlLine);

  return {
    ...parseHead(head),
    profileUrl: url ? `https://www.${url[0].replace(/^https?:\/\//, '').replace(/^[a-z]{2,3}\./i, '')}` : '',
    summary: summaryLines.join(' ').slice(0, 4000),
    roles: roles.map(({ start: _start, end: _end, ...role }) => role),
    education: parseEducation(sections.get('education') ?? []),
    skills: [...new Set(skills)].slice(0, 60),
    totalMonths: mergedMonths(roles),
  };
}
