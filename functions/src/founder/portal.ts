/**
 * The single callable behind Founder Connect.
 *
 * One entry point per feature module, as with `surveyPortal`: the client names
 * an action, the dispatcher validates and runs it. A student reaches this only
 * after `requirePlatformAccess`, so the cohort boundary is enforced before any
 * profile is read.
 */

import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { EXPLABS_API_KEY, JEV_MODEL } from '../config/params';
import { requireMuDomain, requirePlatformAccess } from '../utils/domainCheck';
import { getDb } from '../utils/getDb';
import { runFounderAction } from './service';
import type { FounderMember } from './service';

export function founderMember(request: CallableRequest): FounderMember {
  const uid = requireMuDomain(request);
  if (request.auth?.token.email_verified !== true) {
    throw new HttpsError('permission-denied', 'Verify your MU email before using Founder Connect.');
  }
  const email = String(request.auth.token.email).toLowerCase();
  return {
    uid,
    email,
    name: String(request.auth.token.name || email.split('@')[0]).slice(0, 100),
    photoURL: String(request.auth.token.picture || '').slice(0, 500),
  };
}

export const founderPortal = onCall(
  // 120s because two actions make a model call: the SOP review at the end of
  // onboarding and the pairwise judgement on a cache miss.
  { region: 'us-central1', timeoutSeconds: 120, secrets: [EXPLABS_API_KEY] },
  async (request) => {
    await requirePlatformAccess(request);
    const member = founderMember(request);
    return runFounderAction(getDb(), member, request.data, {
      apiKey: EXPLABS_API_KEY.value(),
      model: JEV_MODEL.value(),
    });
  },
);
