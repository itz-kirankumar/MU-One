import { NextResponse } from 'next/server';
import {
  SMARTBID_RAW_GID,
  SMARTBID_SHEET_ID,
  SMARTBID_SNAPSHOT_GID,
  buildPayload,
  parseCapacities,
  type SmartBidError,
  type SmartBidPayload,
} from '@/lib/smartbid';

// Public, no-login endpoint. Reads the shared Google Sheet via its "anyone with
// the link" CSV export, so no Google credentials are stored on the server.
export const dynamic = 'force-dynamic';

const CACHE_MS = 15_000;
let cached: { at: number; payload: SmartBidPayload } | null = null;
let inflight: Promise<SmartBidPayload> | null = null;

function csvUrl(gid: string) {
  return `https://docs.google.com/spreadsheets/d/${SMARTBID_SHEET_ID}/gviz/tq?gid=${gid}&tqx=out:csv&_t=${Date.now()}`;
}

async function fetchCsv(gid: string): Promise<string> {
  const res = await fetch(csvUrl(gid), { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Google Sheets responded ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('csv')) throw new Error('Sheet is not publicly readable (got a sign-in page)');
  return res.text();
}

async function load(): Promise<SmartBidPayload> {
  const [raw, snapshot] = await Promise.all([
    fetchCsv(SMARTBID_RAW_GID),
    fetchCsv(SMARTBID_SNAPSHOT_GID).catch(() => ''),
  ]);
  return buildPayload(raw, snapshot ? parseCapacities(snapshot) : {});
}

export async function GET() {
  const headers = {
    // Let Vercel's edge serve repeat hits so hundreds of students refreshing
    // at once don't each hit Google.
    'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
  };

  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json(cached.payload, { headers });
  }

  try {
    inflight ??= load().finally(() => {
      inflight = null;
    });
    const payload = await inflight;
    cached = { at: Date.now(), payload };
    return NextResponse.json(payload, { headers });
  } catch (err) {
    // Serve the last good snapshot rather than an empty page; the client shows it as stale.
    if (cached) {
      return NextResponse.json(cached.payload, { headers: { ...headers, 'X-SmartBid-Stale': '1' } });
    }
    const body: SmartBidError = { ok: false, error: err instanceof Error ? err.message : 'Failed to load sheet' };
    return NextResponse.json(body, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
