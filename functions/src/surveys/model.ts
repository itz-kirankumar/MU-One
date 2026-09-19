export interface SurveyQuestion {
  id: string;
  title: string;
  type: 'text' | 'choice' | 'rating';
  required: boolean;
  options: string[];
}

export interface SurveyDraft {
  title: string;
  description: string;
  anonymousAuthor: boolean;
  anonymousResponses: boolean;
  durationDays: number;
  questions: SurveyQuestion[];
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  anonymousAuthor: boolean;
  anonymousResponses: boolean;
  authorName: string;
  questions: SurveyQuestion[];
  createdAt: string;
  closesAt: string;
  status: 'open' | 'closed';
  responseCount: number;
  isOwner: boolean;
  hasResponded: boolean;
}

export interface SurveyAnswer { questionId: string; value: string | number | null }
export interface SurveyResponse {
  id: string;
  answers: SurveyAnswer[];
  respondent: { name: string; email: string } | null;
}
export interface SurveyPage { surveys: Survey[]; nextCursor: string | null }
export interface SurveyResults {
  survey: Survey;
  counts: Record<string, Record<string, number>>;
  answeredCounts: Record<string, number>;
  responses: SurveyResponse[];
  nextCursor: string | null;
}
