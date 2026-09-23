import {
  LinkedInParseError, mergedMonths, parseDuration, parseLinkedInExport, parsePeriod,
} from '../founder/linkedin';
import { skillEvidence } from '../founder/traits';

/**
 * Shaped like LinkedIn's own "Save to PDF" output: an unlabelled head block,
 * then `Contact`, `Top Skills`, `Summary`, `Experience` and `Education`
 * headings on their own lines, with a page artifact thrown in.
 */
const EXPORT = `
Priya Raghavan
Building payment rails for Bharat | Ex-Razorpay
Bengaluru, Karnataka, India

Contact
www.linkedin.com/in/priya-raghavan-dev
priya@example.com

Top Skills
Node.js · PostgreSQL · Payment Systems
Distributed Systems

Summary
I spent three years on Razorpay's UPI stack, where I owned the reconciliation
service that settles 4 crore transactions a month. I left to build the same
primitive for offline merchants.

Page 1 of 3

Experience
Razorpay
Senior Backend Engineer
January 2022 - Present  (3 years 8 months)
Bengaluru, India
Owned the UPI reconciliation service. Cut settlement failures from 2.1% to 0.3%
by rewriting the ledger as an append-only log.

Backend Engineer
March 2021 - January 2022  (11 months)
Shipped the merchant payouts API used by 12,000 sellers.

Zerodha
Software Development Intern
June 2020 - August 2020  (3 months)
Built internal tooling for the clearing team.

Education
Masters' Union
Post Graduate Programme in Technology and Business Management · (2025 - 2026)

Birla Institute of Technology and Science
Bachelor of Engineering - BE, Computer Science · (2017 - 2021)
`;

describe('parseDuration', () => {
  test('reads the shapes LinkedIn prints', () => {
    expect(parseDuration('3 years 8 months')).toBe(44);
    expect(parseDuration('1 year 5 months')).toBe(17);
    expect(parseDuration('11 months')).toBe(11);
    expect(parseDuration('2 yrs 3 mos')).toBe(27);
    expect(parseDuration('no numbers here')).toBe(0);
  });
});

describe('parsePeriod', () => {
  test('prefers the stated duration over arithmetic on the dates', () => {
    const parsed = parsePeriod('January 2022 - December 2022  (2 years)');
    expect(parsed?.months).toBe(24);
  });

  test('falls back to the span when no duration is printed', () => {
    expect(parsePeriod('January 2022 - March 2022')?.months).toBe(3);
    expect(parsePeriod('2021 - 2023')?.months).toBe(25);
  });

  test('treats Present as now, so an open-ended role keeps accruing', () => {
    const parsed = parsePeriod('January 2020 - Present');
    const expected = (new Date().getFullYear() * 12 + new Date().getMonth()) - (2020 * 12) + 1;
    expect(parsed?.months).toBe(expected);
  });

  test('rejects lines that are not date ranges', () => {
    for (const line of ['Senior Backend Engineer', 'Bengaluru, India', '3 years 8 months', '']) {
      expect(parsePeriod(line)).toBeNull();
    }
  });
});

describe('mergedMonths', () => {
  test('counts an overlapping span once', () => {
    const overlapping = mergedMonths([
      { period: 'a', months: 12, start: 2020 * 12, end: 2020 * 12 + 11 },
      { period: 'b', months: 12, start: 2020 * 12 + 6, end: 2021 * 12 + 5 },
    ]);
    // Jan 2020 → Jun 2021 is 18 months, not the 24 the two roles claim.
    expect(overlapping).toBe(18);
  });

  test('adds adjacent spans without double-counting the boundary month', () => {
    expect(mergedMonths([
      { period: 'a', months: 6, start: 0, end: 5 },
      { period: 'b', months: 6, start: 6, end: 11 },
    ])).toBe(12);
  });

  test('still counts a role whose dates would not parse', () => {
    expect(mergedMonths([
      { period: 'a', months: 12, start: 0, end: 11 },
      { period: 'b', months: 5, start: null, end: null },
    ])).toBe(17);
  });
});

describe('parseLinkedInExport', () => {
  const parsed = parseLinkedInExport(EXPORT);

  test('reads the head block', () => {
    expect(parsed.name).toBe('Priya Raghavan');
    expect(parsed.headline).toContain('payment rails');
    expect(parsed.location).toBe('Bengaluru, Karnataka, India');
    expect(parsed.profileUrl).toBe('https://www.linkedin.com/in/priya-raghavan-dev');
  });

  test('drops the page artifact instead of treating it as content', () => {
    expect(JSON.stringify(parsed)).not.toMatch(/Page 1 of 3/);
  });

  test('finds every role, with the company carried down a grouped block', () => {
    expect(parsed.roles.map((role) => role.title)).toEqual([
      'Senior Backend Engineer', 'Backend Engineer', 'Software Development Intern',
    ]);
    expect(parsed.roles[0].company).toBe('Razorpay');
    // The second role sits under the same company heading, separated only by a
    // title line, so the walk upward has to skip past it.
    expect(parsed.roles[1].company).toBe('Razorpay');
    expect(parsed.roles[2].company).toBe('Zerodha');
    expect(parsed.roles[0].months).toBe(44);
    expect(parsed.roles[1].months).toBe(11);
  });

  test('keeps the role description but not the location line above it', () => {
    expect(parsed.roles[0].description).toContain('append-only log');
    expect(parsed.roles[0].description).not.toContain('Bengaluru, India');
  });

  test('does not swallow the next role into this one description', () => {
    expect(parsed.roles[0].description).not.toContain('merchant payouts');
  });

  test('splits the skills line on the separators LinkedIn uses', () => {
    expect(parsed.skills).toEqual(
      expect.arrayContaining(['Node.js', 'PostgreSQL', 'Payment Systems', 'Distributed Systems']),
    );
  });

  test('reads education with the years pulled out of the degree line', () => {
    expect(parsed.education[0]).toEqual({
      school: "Masters' Union",
      degree: 'Post Graduate Programme in Technology and Business Management',
      period: '2025 - 2026',
    });
    expect(parsed.education).toHaveLength(2);
  });

  test('total experience merges the overlap rather than summing the claims', () => {
    const claimed = parsed.roles.reduce((sum, role) => sum + role.months, 0);
    expect(parsed.totalMonths).toBeLessThan(claimed);
    expect(parsed.totalMonths).toBeGreaterThan(40);
  });

  test('feeds the skill evidence that lifts a self-rating', () => {
    const evidence = skillEvidence({
      source: 'pdf',
      profileUrl: parsed.profileUrl,
      headline: parsed.headline,
      location: parsed.location,
      summary: parsed.summary,
      roles: parsed.roles,
      education: parsed.education,
      skills: parsed.skills,
      totalMonths: parsed.totalMonths,
      importedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(evidence.engineering).toBeGreaterThan(0);
    expect(evidence.legal_regulatory).toBe(0);
  });

  test('refuses a file with almost no text', () => {
    expect(() => parseLinkedInExport('short')).toThrow(LinkedInParseError);
  });

  test('refuses a document that is not a profile export', () => {
    const invoice = 'INVOICE\n'.repeat(30);
    expect(() => parseLinkedInExport(invoice)).toThrow(LinkedInParseError);
  });

  test('returns what it can when a section is missing, rather than throwing', () => {
    const summaryOnly = `Anil Kumar\nProduct at a seed-stage fintech\n\nSummary\n${'I build things for merchants. '.repeat(6)}`;
    const result = parseLinkedInExport(summaryOnly);
    expect(result.roles).toEqual([]);
    expect(result.summary).toContain('merchants');
    expect(result.totalMonths).toBe(0);
  });
});
