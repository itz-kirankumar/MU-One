import { NextResponse } from 'next/server';
import { buildPayload, type SmartBidPayload } from '@/lib/smartbid';
import { SMARTBID_FINAL_CSV, SMARTBID_FINAL_EXPORTED_AT } from '@/lib/smartbid-final-data';

// Public, no-login endpoint. Bidding closed on 7 Nov 2026 and the source sheet
// was made private, so this serves the frozen final export committed in
// lib/smartbid-final-data.ts instead of reading Google Sheets.

let payload: SmartBidPayload | null = null;

function finalPayload(): SmartBidPayload {
  payload ??= {
    ...buildPayload(SMARTBID_FINAL_CSV, {}),
    fetchedAt: new Date(SMARTBID_FINAL_EXPORTED_AT).toISOString(),
    final: true,
  };
  return payload;
}

export async function GET() {
  return NextResponse.json(finalPayload(), {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
