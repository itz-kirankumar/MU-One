import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export type Question = {
  id: string; section: string; kind: 'likert' | 'scale' | 'single' | 'multi' | 'text';
  title: string; help?: string; options?: string[]; min?: number; max?: number;
  minLabel?: string; maxLabel?: string; minChars?: number; maxChars?: number; required: boolean;
};
export type FounderSummary = {
  uid: string; email: string; displayName: string; headline: string; photoURL: string;
  archetype: string; interests: string[]; topSkills: string[]; lookingFor: string; onboardedAt: string;
};
export type FounderProfile = FounderSummary & {
  visibility: 'open' | 'selective'; version: number;
  linkedin: { source: string; headline: string; summary: string; roles: Array<{ title: string; company: string }>; skills: string[] } | null;
  sop: { text: string; proudOf: string; validation: { credibility: number; verdict: string; aiAvailable: boolean } | null };
};
export type Bootstrap = {
  onboarding: { status: 'not_started' | 'linkedin_done' | 'complete' };
  profile: FounderProfile | null;
  linkedinConnection: { name: string; email: string; picture: string; linkedAt: string } | null;
  linkedinSignInReady: boolean;
  questionnaire: { questions: Question[]; sectionOrder: string[]; sectionLabels: Record<string, string> };
  labels: { skills: Record<string, string>; interests: Record<string, string>; archetypes: Record<string, string> };
  vocab: { interests: string[]; skills: string[] };
};
export type MatchReport = {
  score: number; band: string; confidence: string; counterpart: FounderSummary;
  components: Array<{ id: string; label: string; score: number; weight: number; detail: string }>;
  strengths: string[]; frictions: string[]; openQuestions: string[];
  judgement: { available: boolean; recommendation: string };
};
export type FounderPost = {
  id: string; kind: 'post' | 'idea' | 'poll'; authorUid: string; authorName: string;
  authorHeadline: string; anonymous: boolean; title: string; body: string; tags: string[];
  idea: { problem: string; stage: string; lookingFor: string[] } | null;
  poll: { options: Array<{ id: string; label: string }>; counts: Record<string, number>; totalVotes: number; closesAt: string } | null;
  likeCount: number; commentCount: number; createdAt: string; likedByMe: boolean; myVote: string | null; isAuthor: boolean;
};
export type FounderComment = { id: string; authorName: string; body: string; createdAt: string; anonymous: boolean; isAuthor: boolean };
export type FounderThread = { id: string; counterpart: { uid: string; name: string; headline: string }; lastMessage: string; lastMessageAt: string; unread: number };
export type FounderMessage = { id: string; fromUid: string; body: string; createdAt: string; mine: boolean };

async function call<T>(data: Record<string, unknown>): Promise<T> {
  const fn = httpsCallable<Record<string, unknown>, T>(functions, 'founderPortal', { timeout: 120_000 });
  return (await fn(data)).data;
}
export const founderApi = {
  bootstrap: () => call<Bootstrap>({ action: 'bootstrap' }),
  connectionStatus: () => call<{ linkedinConnection: { name: string; linkedAt: string } | null }>({ action: 'connectionStatus' }),
  importLinkedIn: (record: Record<string, unknown>) => call<{ record: FounderProfile['linkedin'] }>({ action: 'importLinkedIn', record }),
  submit: (answers: Record<string, number | number[] | string>, aiConsent: boolean) => call<{ profile: FounderProfile }>({ action: 'submitQuestionnaire', answers, aiConsent }),
  setVisibility: (visibility: 'open' | 'selective') => call<{ visibility: string }>({ action: 'setVisibility', visibility }),
  authUrl: async () => (await httpsCallable<void, { authUrl: string }>(functions, 'getLinkedInAuthUrl')()).data.authUrl,
  lookup: (email: string) => call<{ found: boolean; onboarded: boolean; invited?: string; counterpart?: FounderSummary }>({ action: 'lookup', email }),
  match: (uid: string) => call<{ report: MatchReport }>({ action: 'match', uid }),
  suggestions: () => call<{ suggestions: Array<{ counterpart: FounderSummary; structural: number; lexical: number }> }>({ action: 'suggestions' }),
  posts: (filter: { kind?: string; mine?: boolean; cursor?: string | null }) => call<{ posts: FounderPost[]; nextCursor: string | null }>({ action: 'listPosts', ...filter }),
  createPost: (draft: Record<string, unknown>) => call<{ id: string }>({ action: 'createPost', draft, requestId: crypto.randomUUID().replaceAll('-', '') }),
  like: (postId: string) => call<{ liked: boolean; likeCount: number }>({ action: 'toggleLike', postId }),
  vote: (postId: string, optionId: string) => call<{ counts: Record<string, number>; totalVotes: number }>({ action: 'vote', postId, optionId }),
  comments: (postId: string, cursor?: string | null) => call<{ comments: FounderComment[]; nextCursor: string | null }>({ action: 'listComments', postId, cursor }),
  comment: (postId: string, body: string, anonymous: boolean) => call<{ id: string }>({ action: 'comment', postId, body, anonymous }),
  deletePost: (postId: string) => call<{ deleted: boolean }>({ action: 'deletePost', postId }),
  threads: () => call<{ threads: FounderThread[] }>({ action: 'listThreads' }),
  messages: (threadId: string) => call<{ messages: FounderMessage[]; nextCursor: string | null }>({ action: 'listMessages', threadId }),
  send: (toUid: string, body: string) => call<{ id: string; threadId: string }>({ action: 'sendMessage', toUid, body }),
  read: (threadId: string) => call<{ read: boolean }>({ action: 'markThreadRead', threadId }),
};

export function founderError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : 'Please try again.';
  if (code.includes('unavailable')) return 'Founder Connect is temporarily unavailable. Please try again.';
  if (code.includes('unauthenticated')) return 'Please sign in again.';
  return message.replace(/^functions\/[^:]+:\s*/, '');
}

export async function extractLinkedInPdf(file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 12_000_000 || file.size === 0) {
    throw new Error('Choose a LinkedIn profile PDF smaller than 12 MB.');
  }
  const pdfjs = await import('pdfjs-dist');
  const { PDF_WORKER_SRC } = await import('./pdfWorkerSrc');
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  try {
    if (pdf.numPages > 30) throw new Error('The profile PDF is too long. Export your LinkedIn profile only.');
    const pages: string[] = [];
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      let pageText = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        pageText += item.str + (item.hasEOL ? '\n' : ' ');
      }
      pages.push(pageText);
    }
    const text = pages.join('\n').slice(0, 120_000);
    if (text.trim().length < 80) throw new Error('No usable text was found. Export the text-based profile PDF from LinkedIn.');
    return text;
  } finally { await pdf.destroy(); }
}
