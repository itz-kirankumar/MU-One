import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  // Redirect to the auth callback page preserving search parameters
  const redirectUrl = new URL(`/auth/callback${searchParams ? `?${searchParams}` : ''}`, request.url);
  return NextResponse.redirect(redirectUrl);
}
