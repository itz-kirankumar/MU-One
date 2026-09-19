import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';
import { requireMuDomain } from '../utils/domainCheck';
import { getDb } from '../utils/getDb';
import { runSurveyAction, SurveyMember } from './service';

export function surveyMember(request: CallableRequest): SurveyMember {
  const uid = requireMuDomain(request);
  if (request.auth?.token.email_verified !== true) {
    throw new HttpsError('permission-denied', 'Verify your MU email before using surveys.');
  }
  const email = String(request.auth.token.email);
  return { uid, email, name: String(request.auth.token.name || email.split('@')[0]).slice(0, 100) };
}

export const surveyPortal = onCall({ region: 'us-central1', timeoutSeconds: 30 }, async request => {
  const member = surveyMember(request);
  return runSurveyAction(getDb(), member, request.data);
});
