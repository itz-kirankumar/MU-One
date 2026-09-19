import { HttpsError } from 'firebase-functions/v2/https';
import { cleanTextForDateParsing, inferDueDate } from '../utils/mailParsing';

const TESTMAIL_ENDPOINT = 'https://api.testmail.app/api/json';
const MAX_LIMIT = 50;

export interface TestmailConfig {
  apiKey: string;
  namespace: string;
}

export interface TestmailInboxOptions {
  tag?: string;
  tagPrefix?: string;
  timestampFrom?: number;
  limit?: number;
  offset?: number;
  liveQuery?: boolean;
}

export interface TestmailMessage {
  id: string;
  tag: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  receivedAt: string;
  dueDate: string | null;
  attachments: Array<{ filename: string; contentType: string; size: number }>;
}

interface TestmailApiResponse {
  result?: string;
  message?: string | null;
  count?: number;
  limit?: number;
  offset?: number;
  emails?: unknown[];
}

function required(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new HttpsError('failed-precondition', `${label} is not configured.`);
  return trimmed;
}

function safeToken(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) {
    throw new HttpsError('invalid-argument', `${label} contains unsupported characters.`);
  }
  return value;
}

function safeInt(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new HttpsError('invalid-argument', `Expected an integer between ${min} and ${max}.`);
  }
  return Number(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function timestamp(value: unknown): Date {
  const millis = typeof value === 'number' ? value * 1000 : Date.parse(asString(value));
  const parsed = new Date(millis);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(0);
}

export function testmailAddress(namespace: string, tag: string): string {
  return `${safeToken(namespace, 'namespace')}.${safeToken(tag, 'tag')}@inbox.testmail.app`;
}

export function normalizeTestmailMessage(value: unknown, referenceToday = new Date()): TestmailMessage {
  const email = asRecord(value);
  const html = asString(email.html);
  const text = cleanTextForDateParsing(asString(email.text) || html);
  const subject = cleanTextForDateParsing(asString(email.subject));
  const received = timestamp(email.timestamp ?? email.receivedAt ?? email.date);
  const rawAttachments = Array.isArray(email.attachments) ? email.attachments : [];
  return {
    id: asString(email.id) || asString(email._id),
    tag: asString(email.tag),
    from: cleanTextForDateParsing(asString(email.from)),
    to: cleanTextForDateParsing(Array.isArray(email.to) ? email.to.join(', ') : asString(email.to)),
    subject,
    text: text.slice(0, 20_000),
    receivedAt: received.toISOString(),
    dueDate: inferDueDate(`${subject}\n${text}`, received, referenceToday),
    attachments: rawAttachments.slice(0, 20).map(raw => {
      const attachment = asRecord(raw);
      return {
        filename: cleanTextForDateParsing(asString(attachment.filename) || asString(attachment.name)).slice(0, 255),
        contentType: asString(attachment.contentType) || asString(attachment.content_type),
        size: typeof attachment.size === 'number' && attachment.size >= 0 ? attachment.size : 0,
      };
    }),
  };
}

export async function fetchTestmailInbox(
  config: TestmailConfig,
  options: TestmailInboxOptions = {},
  fetcher: typeof fetch = fetch,
): Promise<{ messages: TestmailMessage[]; count: number; limit: number; offset: number }> {
  const apiKey = required(config.apiKey, 'TESTMAIL_API_KEY');
  const namespace = safeToken(required(config.namespace, 'TESTMAIL_NAMESPACE'), 'namespace')!;
  const limit = safeInt(options.limit, 20, 1, MAX_LIMIT);
  const offset = safeInt(options.offset, 0, 0, 10_000);
  const url = new URL(TESTMAIL_ENDPOINT);
  url.searchParams.set('apikey', apiKey);
  url.searchParams.set('namespace', namespace);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  const tag = safeToken(options.tag, 'tag');
  const tagPrefix = safeToken(options.tagPrefix, 'tag prefix');
  if (tag && tagPrefix) throw new HttpsError('invalid-argument', 'Use tag or tagPrefix, not both.');
  if (tag) url.searchParams.set('tag', tag);
  if (tagPrefix) url.searchParams.set('tag_prefix', tagPrefix);
  if (options.timestampFrom !== undefined) {
    url.searchParams.set('timestamp_from', String(safeInt(options.timestampFrom, 0, 0, 4_102_444_800)));
  }
  if (options.liveQuery) url.searchParams.set('livequery', 'true');

  let response: Response;
  try {
    response = await fetcher(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(options.liveQuery ? 65_000 : 15_000) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    throw new HttpsError('unavailable', `Testmail is unavailable: ${message}`);
  }
  let payload: TestmailApiResponse;
  try {
    payload = await response.json() as TestmailApiResponse;
  } catch {
    throw new HttpsError('unavailable', `Testmail returned HTTP ${response.status} with an invalid response.`);
  }
  if (!response.ok || payload.result !== 'success') {
    throw new HttpsError(response.status === 429 ? 'resource-exhausted' : 'failed-precondition',
      payload.message || `Testmail request failed with HTTP ${response.status}.`);
  }
  const emails = Array.isArray(payload.emails) ? payload.emails : [];
  return {
    messages: emails.map(email => normalizeTestmailMessage(email)),
    count: typeof payload.count === 'number' ? payload.count : emails.length,
    limit: typeof payload.limit === 'number' ? payload.limit : limit,
    offset: typeof payload.offset === 'number' ? payload.offset : offset,
  };
}
