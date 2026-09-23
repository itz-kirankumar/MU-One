import { randomBytes } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { DASHBOARD_URL, LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI, LINKEDIN_OIDC_ENABLED } from '../config/params';
import { PLATFORM_ADMIN_EMAIL, requirePlatformAccess } from '../utils/domainCheck';
import { getDb } from '../utils/getDb';

const STATE_COLLECTION = 'founderLinkedInStates';
const CONNECTION_COLLECTION = 'founderLinkedInConnections';
const STATE_TTL_MS = 10 * 60_000;

function redirect(status: 'success' | 'error' | 'denied', reason = ''): string {
  const url = new URL(DASHBOARD_URL.value() || 'https://muone.live/dashboard');
  url.searchParams.set('founder_connect', status);
  if (reason) url.searchParams.set('reason', reason.slice(0, 80));
  return url.toString();
}

export const getLinkedInAuthUrl = onCall({
  region: 'us-central1',
  secrets: [LINKEDIN_CLIENT_SECRET],
}, async (request) => {
  const uid = await requirePlatformAccess(request);
  if (request.auth?.token.email_verified !== true) {
    throw new HttpsError('permission-denied', 'Verify your MU email before connecting LinkedIn.');
  }
  const clientId = LINKEDIN_CLIENT_ID.value();
  const callback = LINKEDIN_REDIRECT_URI.value();
  if (!clientId || !callback || !LINKEDIN_CLIENT_SECRET.value() || LINKEDIN_OIDC_ENABLED.value() !== 'true') {
    throw new HttpsError('failed-precondition', 'LinkedIn sign-in is not configured yet. You can still import your profile PDF or enter your background manually.');
  }
  const state = randomBytes(32).toString('base64url');
  await getDb().collection(STATE_COLLECTION).doc(state).create({
    uid,
    email: String(request.auth.token.email).toLowerCase(),
    expiresAt: Date.now() + STATE_TTL_MS,
    createdAt: new Date().toISOString(),
  });
  const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', callback);
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', state);
  return { authUrl: url.toString() };
});

export const connectLinkedIn = onRequest({
  region: 'us-central1',
  secrets: [LINKEDIN_CLIENT_SECRET],
}, async (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const denied = typeof req.query.error === 'string' ? req.query.error : '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(state)) {
    res.status(400).send('Invalid or missing LinkedIn state.');
    return;
  }
  const stateRef = getDb().collection(STATE_COLLECTION).doc(state);
  const saved = await getDb().runTransaction(async (tx) => {
    const snapshot = await tx.get(stateRef);
    if (!snapshot.exists) return null;
    tx.delete(stateRef); // A callback can consume the state exactly once.
    return snapshot.data() as { uid: string; email: string; expiresAt: number };
  });
  if (!saved || saved.expiresAt < Date.now()) {
    res.redirect(redirect('error', 'expired_state'));
    return;
  }
  if (denied) {
    res.redirect(redirect('denied'));
    return;
  }
  if (!code) {
    res.redirect(redirect('error', 'missing_code'));
    return;
  }
  try {
    const user = await getAuth().getUser(saved.uid);
    if (!user.emailVerified || user.email?.toLowerCase() !== saved.email) {
      res.redirect(redirect('error', 'account_changed'));
      return;
    }
    if (saved.email !== PLATFORM_ADMIN_EMAIL) {
      const access = await getDb().collection('platformAccess').doc(saved.email).get();
      if (access.get('status') !== 'granted') {
        res.redirect(redirect('error', 'access_not_granted'));
        return;
      }
    }
    const credentials = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: LINKEDIN_CLIENT_ID.value(),
      client_secret: LINKEDIN_CLIENT_SECRET.value(),
      redirect_uri: LINKEDIN_REDIRECT_URI.value(),
    });
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: credentials,
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenResponse.ok) throw new Error('LinkedIn token exchange failed');
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) throw new Error('LinkedIn did not issue an access token');
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!profileResponse.ok) throw new Error('LinkedIn profile request failed');
    const profile = await profileResponse.json() as {
      sub?: string; name?: string; given_name?: string; family_name?: string;
      email?: string; email_verified?: boolean; picture?: string;
    };
    if (!profile.sub || profile.sub.length > 200) throw new Error('LinkedIn identity is missing');
    // OIDC grants identity, photo and sometimes email. It does not grant work
    // history or skills; those come from the member's own PDF export or input.
    await getDb().collection(CONNECTION_COLLECTION).doc(saved.uid).set({
      sub: profile.sub,
      name: (profile.name || `${profile.given_name || ''} ${profile.family_name || ''}`.trim()).slice(0, 150),
      email: (profile.email || '').slice(0, 250),
      emailVerified: profile.email_verified === true,
      picture: (profile.picture || '').slice(0, 1000),
      linkedAt: new Date().toISOString(),
    });
    res.redirect(redirect('success'));
  } catch (error) {
    console.error('Founder LinkedIn OAuth callback failed:', error instanceof Error ? error.message : error);
    res.redirect(redirect('error', 'linkedin_connect_failed'));
  }
});
