import 'server-only';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = 'REQUEST_FAILED') {
    super(message);
  }
}

/** Verify signature, expiry, issuer and audience, then enforce the campus account policy. */
export async function requireCampusUser(request: Request): Promise<string> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ') || header.length > 8192) {
    throw new ApiError(401, 'Sign in with your Masters’ Union account to continue.', 'AUTH_REQUIRED');
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new ApiError(503, 'Account verification is not configured.', 'AUTH_UNAVAILABLE');
  const name = 'mu-one-api';
  const app = getApps().find((candidate) => candidate.name === name) || initializeApp({ projectId }, name);
  let token;
  try {
    token = await getAuth(app).verifyIdToken(header.slice(7));
  } catch {
    throw new ApiError(401, 'Your session has expired. Sign in again.', 'AUTH_INVALID');
  }
  if (!token.email_verified || typeof token.email !== 'string' || !/^[^@\s]+@mastersunion\.org$/i.test(token.email)) {
    throw new ApiError(403, 'A verified Masters’ Union account is required.', 'CAMPUS_ACCOUNT_REQUIRED');
  }
  return token.uid;
}

// Per-process abuse protection. Deployments with multiple instances must also use
// a shared rate limiter / gateway quota; these counters reset on cold starts.
const buckets = new Map<string, { count: number; reset: number }>();
const inFlight = new Set<string>();

export function enforceRateLimit(uid: string, scope: string, limit = 30, windowMs = 600_000) {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.reset <= now) buckets.delete(key);
  const key = `${scope}:${uid}`;
  const bucket = buckets.get(key) || { count: 0, reset: now + windowMs };
  if (bucket.count >= limit) throw new ApiError(429, 'Too many requests. Please try again in a few minutes.', 'RATE_LIMITED');
  // Bound memory even if many authenticated accounts reach a single instance.
  if (!buckets.has(key) && buckets.size >= 10_000) throw new ApiError(503, 'The service is busy. Please try again shortly.', 'SERVICE_BUSY');
  bucket.count += 1;
  buckets.set(key, bucket);
}

export function acquirePitchSlot(uid: string): () => void {
  if (inFlight.has(uid)) throw new ApiError(409, 'A pitch analysis is already running. Wait for it to finish.', 'ALREADY_RUNNING');
  inFlight.add(uid);
  return () => { inFlight.delete(uid); };
}

export async function readJsonBody(request: Request, maxBytes = 32_768): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new ApiError(415, 'Send a JSON request.', 'INVALID_CONTENT_TYPE');
  }
  if (Number(request.headers.get('content-length')) > maxBytes) throw new ApiError(413, 'This brief is too long. Shorten it and try again.', 'BODY_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'A request body is required.', 'INVALID_INPUT');
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, 'This brief is too long. Shorten it and try again.', 'BODY_TOO_LARGE');
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'The request must contain valid JSON.', 'INVALID_INPUT');
  } finally {
    reader.releaseLock();
  }
}

export function apiErrorResponse(error: unknown): Response {
  const known = error instanceof ApiError;
  return Response.json({
    error: known ? error.message : 'The request could not be completed. Please try again.',
    code: known ? error.code : 'INTERNAL_ERROR',
  }, {
    status: known ? error.status : 500,
    headers: { 'Cache-Control': 'no-store', ...(known && error.status === 429 ? { 'Retry-After': '600' } : {}) },
  });
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'Invalid request data.', 'INVALID_INPUT');
  return value as Record<string, unknown>;
}
