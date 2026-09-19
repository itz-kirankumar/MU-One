import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { requireMuDomain } from '../utils/domainCheck';
import { fetchTestmailInbox, testmailAddress } from './testmail';

const TESTMAIL_API_KEY = defineSecret('TESTMAIL_API_KEY');
const TESTMAIL_NAMESPACE = defineString('TESTMAIL_NAMESPACE', { default: '' });
const TESTMAIL_ADMIN_EMAILS = defineString('TESTMAIL_ADMIN_EMAILS', { default: '' });

function requireTestmailAdmin(request: Parameters<typeof requireMuDomain>[0]): string {
  requireMuDomain(request);
  const email = String(request.auth?.token.email || '').trim().toLowerCase();
  const allowed = TESTMAIL_ADMIN_EMAILS.value().split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length || !allowed.includes(email)) {
    throw new HttpsError('permission-denied', 'Testmail access is restricted to configured administrators.');
  }
  return email;
}

/** Admin-only bridge for validating MU One email flows and deadline extraction. */
export const testmailPortal = onCall({
  region: 'us-central1',
  timeoutSeconds: 75,
  secrets: [TESTMAIL_API_KEY],
}, async request => {
  requireTestmailAdmin(request);
  const data = request.data && typeof request.data === 'object' ? request.data as Record<string, unknown> : {};
  const namespace = TESTMAIL_NAMESPACE.value();
  if (data.action === 'address') {
    return { address: testmailAddress(namespace, typeof data.tag === 'string' ? data.tag : 'mu-one') };
  }
  if (data.action !== 'list') throw new HttpsError('invalid-argument', 'Unknown Testmail action.');
  return fetchTestmailInbox({ apiKey: TESTMAIL_API_KEY.value(), namespace }, {
    tag: typeof data.tag === 'string' ? data.tag : undefined,
    tagPrefix: typeof data.tagPrefix === 'string' ? data.tagPrefix : undefined,
    timestampFrom: data.timestampFrom as number | undefined,
    limit: data.limit as number | undefined,
    offset: data.offset as number | undefined,
    liveQuery: data.liveQuery === true,
  });
});
