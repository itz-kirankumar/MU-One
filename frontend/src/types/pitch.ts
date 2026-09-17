export interface PitchInput {
  mode: 'venture' | 'case';
  competition: string;
  industry: string;
  idea: string;
  brief: string;
  rubric: string;
  round: string;
  slideLimit: number;
  deadline: string;
}

export interface PitchMailContext {
  messageId: string;
  subject: string;
  body: string;
  deadline?: string;
  gmailUrl?: string;
}

export interface PitchSource {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  retrievedAt: string;
}

export interface PitchResult {
  summary: string;
  recommendation: string;
  slides: Array<{
    number: number;
    title: string;
    keyMessage: string;
    bullets: string[];
    judgeQuestion: string;
    sourceIds: string[];
  }>;
  critiques: Array<{
    id: string;
    title: string;
    issue: string;
    evidenceNeeded: string;
    actionTitle: string;
  }>;
  assumptions: Array<{
    claim: string;
    kind: 'assumption' | 'estimate' | 'sourced';
    sourceIds: string[];
    calculation: string;
  }>;
  requirements: Array<{
    criterion: string;
    coverage: 'covered' | 'partial' | 'missing';
    feedback: string;
  }>;
  sources: PitchSource[];
  researchStatus: 'complete' | 'partial' | 'unavailable';
  researchNote: string;
  generatedAt: string;
}

export interface PitchDraft {
  id: string;
  input: PitchInput;
  sourceMail?: PitchMailContext;
  result?: PitchResult;
  analyzedInput?: PitchInput;
  taskIds: string[];
  bookedSlots: Array<{ startIso: string; endIso: string; title: string }>;
  updatedAt: string;
}

export const EMPTY_PITCH_INPUT: PitchInput = {
  mode: 'venture', competition: '', industry: '', idea: '', brief: '',
  rubric: '', round: '', slideLimit: 5, deadline: '',
};
