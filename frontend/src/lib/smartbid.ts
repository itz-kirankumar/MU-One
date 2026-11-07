// SmartBid — Term 3 elective bid tracker.
// Shared types, course metadata, CSV parsing and stats. Used by the
// /api/smartbid route (server) and the /smartbid page (client).

export const SMARTBID_SHEET_ID = '1bOG_CBA592nkS79cpCidwDETTKnNIpYUm8Ugm-_Atf0';
export const SMARTBID_RAW_GID = '87479504'; // Form responses
export const SMARTBID_SNAPSHOT_GID = '0'; // Snapshot (capacity per course)
export const SMARTBID_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SMARTBID_SHEET_ID}`;
/** Bidding form — responses can be edited after submitting. */
export const SMARTBID_FORM_URL = 'https://forms.gle/wZwicsruhAL2e7Ps9';

/** Official deadline: 7 Nov 2026, 11:59:59 PM IST. */
export const SMARTBID_DEADLINE_ISO = '2026-11-07T23:59:59+05:30';
export const POINTS_RESERVE = 5000;
export const MAX_ELECTIVE_CREDITS = 4;
export const POINTS_PER_CREDIT_GUIDE = 185;

export type Concentration = 'SAMA' | 'MAST' | 'FIFI' | 'DTP';

export const CONCENTRATIONS: Record<Concentration, { name: string; color: string }> = {
  SAMA: { name: 'Sales & Marketing', color: '#f472b6' },
  MAST: { name: 'Management & Strategy', color: '#38bdf8' },
  FIFI: { name: 'Finance & FinTech', color: '#4ade80' },
  DTP: { name: 'Data, Tech & Product', color: '#a78bfa' },
};

/** Students pick SAMA or FIFI, and MAST or DTP. */
export const CONCENTRATION_PAIRS: [Concentration, Concentration][] = [
  ['SAMA', 'FIFI'],
  ['MAST', 'DTP'],
];

export interface CourseMeta {
  code: string;
  name: string;
  concentration: Concentration;
  credits: number;
  /** Fallback only — live capacity comes from the snapshot tab. */
  capacity: number;
  faculty: { name: string; linkedin?: string }[];
}

export const COURSES: CourseMeta[] = [
  {
    code: 'SAMA7306',
    name: 'B2B Marketing',
    concentration: 'SAMA',
    credits: 2,
    capacity: 150,
    faculty: [{ name: 'Ashish Bajaj', linkedin: 'https://www.linkedin.com/in/ashish-bajaj-001/' }],
  },
  {
    code: 'MAST7309',
    name: 'Unit Economics',
    concentration: 'MAST',
    credits: 1,
    capacity: 150,
    faculty: [{ name: 'Shreyas Birajdar', linkedin: 'https://www.linkedin.com/in/shreyas-birajdar-8176bb124/' }],
  },
  {
    code: 'MAST7310',
    name: 'Category Management',
    concentration: 'MAST',
    credits: 2,
    capacity: 250,
    faculty: [
      { name: 'Sachi Bhandari', linkedin: 'https://www.linkedin.com/in/sachi-bhandari-62412618/' },
      { name: 'Ritesh Jaiswal', linkedin: 'https://www.linkedin.com/in/ritesh-jaiswal-0a157972/' },
    ],
  },
  {
    code: 'FIFI7304',
    name: 'Business Valuation',
    concentration: 'FIFI',
    credits: 2,
    capacity: 100,
    faculty: [{ name: 'Payal Jain', linkedin: 'https://www.linkedin.com/in/payalj316/' }],
  },
  {
    code: 'FIFI7305',
    name: 'Investment Analysis & Portfolio Mgmt',
    concentration: 'FIFI',
    credits: 2,
    capacity: 50,
    faculty: [{ name: 'Tarun Kehair', linkedin: 'https://www.linkedin.com/in/tarun-kehair-92aa045/' }],
  },
  {
    code: 'DTP7308',
    name: 'Product Growth',
    concentration: 'DTP',
    credits: 2,
    capacity: 150,
    faculty: [
      { name: 'Bhanu Potta', linkedin: 'https://www.linkedin.com/in/bhanupotta/' },
      { name: 'Malthi S', linkedin: 'https://www.linkedin.com/in/malthis/' },
    ],
  },
];

export type FillStatus = 'open' | 'filling' | 'oversubscribed';

export interface CourseStats extends CourseMeta {
  /** Sorted ascending, only bids > 0. */
  bids: number[];
  /** Responses that entered 0 for this course. */
  zeroBids: number;
  count: number;
  avg: number;
  median: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  fill: number; // count / capacity
  status: FillStatus;
  /**
   * Bid you must beat to get a seat if bidding closed now: the lowest bid still
   * inside the top `capacity` bids. `null` while bids ≤ seats (no cutoff — any
   * bid above 0 gets in).
   */
  cutoff: number | null;
  /** @deprecated Kept so tabs still running the previous build don't crash. Use `cutoff`. */
  clearingPrice: number;
  seatsLeft: number;
}

export interface SmartBidPayload {
  ok: true;
  fetchedAt: string;
  sheetUrl: string;
  responses: number;
  concentrationSplit: Record<Concentration, number>;
  courses: CourseStats[];
  totals: {
    activeBids: number;
    seats: number;
    fill: number;
    highestBid: { value: number; code: string } | null;
    oversubscribed: number;
  };
}

export interface SmartBidError {
  ok: false;
  error: string;
}

/** RFC 4180-ish CSV parser (handles quotes, escaped quotes and newlines inside cells). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function toNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  const cleaned = raw.replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Linear-interpolated percentile on an ascending array. */
export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Seat cutoff. While bids ≤ seats there is no cutoff (null). Once a course is
 * oversubscribed it is the bid holding the last seat — the capacity-th highest.
 */
export function cutoffFor(sortedAsc: number[], capacity: number): number | null {
  if (sortedAsc.length <= capacity) return null;
  return sortedAsc[sortedAsc.length - capacity];
}

export function statusFor(fill: number): FillStatus {
  if (fill > 1) return 'oversubscribed';
  if (fill >= 0.8) return 'filling';
  return 'open';
}

function codeFromHeader(header: string): string | null {
  const m = header.match(/\b([A-Z]{2,5}\d{4})\b/);
  return m ? m[1] : null;
}

function concentrationFromValue(value: string): Concentration | null {
  const m = value.match(/\((SAMA|MAST|FIFI|DTP)\)/);
  return m ? (m[1] as Concentration) : null;
}

/** Reads per-course capacity from the snapshot tab (column titled "Capacity"). */
export function parseCapacities(snapshotCsv: string): Record<string, number> {
  const rows = parseCsv(snapshotCsv);
  if (!rows.length) return {};
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const capIdx = header.findIndex((h) => h === 'capacity');
  if (capIdx < 0) return {};
  const out: Record<string, number> = {};
  for (const r of rows.slice(1)) {
    const code = codeFromHeader(r[0] ?? '') ?? codeFromHeader(r[1] ?? '');
    const cap = toNumber(r[capIdx]);
    if (code && cap && cap > 0) out[code] = cap;
  }
  return out;
}

export function buildPayload(rawCsv: string, capacities: Record<string, number>): SmartBidPayload {
  const rows = parseCsv(rawCsv);
  const header = rows[0] ?? [];
  const data = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ''));

  // Map course code -> column index by header text, so column re-ordering in the
  // form doesn't break the tracker.
  const colByCode: Record<string, number> = {};
  const concentrationCols: number[] = [];
  header.forEach((h, i) => {
    const code = codeFromHeader(h);
    if (code && /bid/i.test(h)) colByCode[code] = i;
    else concentrationCols.push(i);
  });

  // A response is a row with at least one bid cell filled (0 counts). Rows that
  // only carry a concentration choice (e.g. after a column was sorted or pasted
  // on its own in the sheet) are not counted as responses.
  const bidCols = Object.values(colByCode);
  const responses = data.filter((r) => bidCols.some((i) => toNumber(r[i]) != null));

  const concentrationSplit: Record<Concentration, number> = { SAMA: 0, MAST: 0, FIFI: 0, DTP: 0 };
  const courseByCode = Object.fromEntries(COURSES.map((c) => [c.code, c]));
  const positiveBidIn = (r: string[], conc: Concentration) =>
    Object.entries(colByCode).some(
      ([code, i]) => courseByCode[code]?.concentration === conc && (toNumber(r[i]) ?? 0) > 0,
    );
  for (const r of responses) {
    for (const [a, b] of CONCENTRATION_PAIRS) {
      // Use the row's stated choice; if it's blank, infer it from where the row bid.
      let chosen: Concentration | null = null;
      for (const i of concentrationCols) {
        const c = concentrationFromValue(r[i] ?? '');
        if (c === a || c === b) chosen = c;
      }
      if (!chosen) {
        const inA = positiveBidIn(r, a);
        const inB = positiveBidIn(r, b);
        if (inA !== inB) chosen = inA ? a : b;
      }
      if (chosen) concentrationSplit[chosen]++;
    }
  }

  const courses: CourseStats[] = COURSES.map((meta) => {
    const col = colByCode[meta.code];
    const bids: number[] = [];
    let zeroBids = 0;
    if (col != null) {
      for (const r of data) {
        const n = toNumber(r[col]);
        if (n == null) continue;
        if (n > 0) bids.push(n);
        else zeroBids++;
      }
    }
    bids.sort((a, b) => a - b);
    const capacity = capacities[meta.code] ?? meta.capacity;
    const count = bids.length;
    const fill = capacity ? count / capacity : 0;
    return {
      ...meta,
      capacity,
      bids,
      zeroBids,
      count,
      avg: count ? bids.reduce((a, b) => a + b, 0) / count : 0,
      median: percentile(bids, 0.5),
      min: bids[0] ?? 0,
      max: bids[count - 1] ?? 0,
      p25: percentile(bids, 0.25),
      p75: percentile(bids, 0.75),
      fill,
      status: statusFor(fill),
      cutoff: cutoffFor(bids, capacity),
      clearingPrice: cutoffFor(bids, capacity) ?? bids[0] ?? 0,
      seatsLeft: Math.max(0, capacity - count),
    };
  });

  const activeBids = courses.reduce((a, c) => a + c.count, 0);
  const seats = courses.reduce((a, c) => a + c.capacity, 0);
  let highestBid: SmartBidPayload['totals']['highestBid'] = null;
  for (const c of courses) {
    if (c.count && (!highestBid || c.max > highestBid.value)) highestBid = { value: c.max, code: c.code };
  }

  return {
    ok: true,
    fetchedAt: new Date().toISOString(),
    sheetUrl: SMARTBID_SHEET_URL,
    responses: responses.length,
    concentrationSplit,
    courses,
    totals: {
      activeBids,
      seats,
      fill: seats ? activeBids / seats : 0,
      highestBid,
      oversubscribed: courses.filter((c) => c.status === 'oversubscribed').length,
    },
  };
}

/** Where a bid would rank today: how many existing bids are strictly higher. */
export function rankForBid(sortedAsc: number[], bid: number): { higher: number; percentile: number } {
  let higher = 0;
  for (let i = sortedAsc.length - 1; i >= 0 && sortedAsc[i] > bid; i--) higher++;
  const below = sortedAsc.length - higher;
  return { higher, percentile: sortedAsc.length ? below / sortedAsc.length : 1 };
}
