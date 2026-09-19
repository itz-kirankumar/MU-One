import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { Survey, SurveyAnswer, SurveyDraft, SurveyPage, SurveyResults } from '@/types/surveys';

async function call<T>(request: Record<string, unknown>): Promise<T> {
  const response = await httpsCallable<Record<string, unknown>, T>(functions, 'surveyPortal')(request);
  return response.data;
}

export const surveyApi = {
  list: (mine = false, cursor: string | null = null) => call<SurveyPage>({ action: 'list', mine, cursor }),
  create: (draft: SurveyDraft, requestId: string) => call<{ id: string }>({ action: 'create', draft, requestId }),
  detail: (surveyId: string) => call<Survey>({ action: 'detail', surveyId }),
  respond: (surveyId: string, answers: SurveyAnswer[], consent = false) => call<{ submitted: boolean }>({ action: 'respond', surveyId, answers, consent }),
  results: (surveyId: string, cursor: string | null = null) => call<SurveyResults>({ action: 'results', surveyId, cursor }),
  close: (surveyId: string) => call<{ closed: boolean }>({ action: 'close', surveyId }),
};

export function surveyError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code.includes('unavailable') || code.includes('internal')) return 'Surveys are temporarily unavailable. Please try again.';
  if (code.includes('unauthenticated')) return 'Your session has expired. Please sign in again.';
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
