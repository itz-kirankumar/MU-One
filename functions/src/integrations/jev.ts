import type { NormalizedMailSignal } from '../utils/mailParsing';

export const JEV_ENDPOINT = 'https://api.experientiallabs.ai/v1/systemone';

/** Model slugs are interpolated into a request body, so they are whitelisted. */
export const JEV_MODEL_PATTERN = /^[a-zA-Z0-9._:-]{1,100}$/;

export type JevMailCategory = 'deadline' | 'action' | 'information' | 'spam';

export interface JevMailClassification {
  model: string;
  category: JevMailCategory;
  confidence: number;
  urgency: number;
}

interface JevResponse {
  model?: unknown;
  answers?: {
    category?: { choice?: unknown; confidence?: unknown };
    urgency?: { noul?: unknown };
  };
}

const CATEGORIES = new Set<JevMailCategory>(['deadline', 'action', 'information', 'spam']);

/** Clamps an untrusted model-supplied number into 0–1, defaulting to 0. */
export function probability(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

export function isJevMailClassification(value: unknown): value is JevMailClassification {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<JevMailClassification>;
  return typeof candidate.model === 'string' && CATEGORIES.has(candidate.category as JevMailCategory)
    && typeof candidate.confidence === 'number' && typeof candidate.urgency === 'number';
}

export function applyJevMailFallback(
  mail: NormalizedMailSignal,
  classification: JevMailClassification,
): NormalizedMailSignal {
  if (mail.isDeadlineSignal) return { ...mail, jevClassification: classification };
  const inferredDeadline = classification.category === 'deadline' && classification.confidence >= 0.7;
  return {
    ...mail,
    isDeadlineSignal: inferredDeadline,
    deadlineSource: inferredDeadline ? 'jev' : null,
    importance: classification.urgency >= 0.75 ? 'high' : classification.urgency >= 0.4 ? 'medium' : 'low',
    jevClassification: classification,
  };
}

export async function classifyMailWithJev(
  apiKey: string,
  mail: Pick<NormalizedMailSignal, 'sender' | 'subject' | 'snippet'>,
  model = 'jev-latest',
  fetcher: typeof fetch = fetch,
): Promise<JevMailClassification> {
  if (!apiKey.trim()) throw new Error('EXPLABS_API_KEY is not configured.');
  if (!JEV_MODEL_PATTERN.test(model)) throw new Error('Invalid JEV model slug.');
  const state = [
    `From: ${mail.sender.slice(0, 300)}`,
    `Subject: ${mail.subject.slice(0, 500)}`,
    `Snippet: ${mail.snippet.slice(0, 2500)}`,
  ].join('\n');
  const response = await fetcher(JEV_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      state,
      questions: {
        category: {
          type: 'choice',
          instructions: 'Classify the primary purpose of this student email',
          criteria: {
            deadline: 'A dated or time-sensitive deadline, submission, application, registration, or event closing',
            action: 'The recipient needs to act, but no clear deadline is present',
            information: 'An informational update with no required action',
            spam: 'Unwanted, irrelevant, or generic promotional content',
          },
        },
        urgency: { type: 'noul', instructions: 'This email is urgent or time-sensitive for the student' },
      },
    }),
  });
  let payload: JevResponse;
  try {
    payload = await response.json() as JevResponse;
  } catch {
    throw new Error(`JEV returned HTTP ${response.status} with an invalid response.`);
  }
  if (!response.ok) throw new Error(`JEV request failed with HTTP ${response.status}.`);
  const category = payload.answers?.category?.choice;
  if (typeof category !== 'string' || !CATEGORIES.has(category as JevMailCategory)) {
    throw new Error('JEV returned an invalid mail category.');
  }
  return {
    model: typeof payload.model === 'string' ? payload.model : model,
    category: category as JevMailCategory,
    confidence: probability(payload.answers?.category?.confidence),
    urgency: probability(payload.answers?.urgency?.noul),
  };
}
