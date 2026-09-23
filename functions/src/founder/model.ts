import type { Archetype, BigFiveTrait, InterestTag, SkillDomain, WorkingStyleAxis } from './taxonomy';

// ── LinkedIn ────────────────────────────────────────────────────────────────

export interface LinkedInRole {
  title: string;
  company: string;
  /** Free-form as printed in the export, e.g. "Jan 2023 - Present". */
  period: string;
  months: number;
  description: string;
}

export interface LinkedInEducation {
  school: string;
  degree: string;
  period: string;
}

/**
 * Parsed from the student's own "Save to PDF" profile export, or typed in by
 * hand. `source` records which, because a hand-typed record carries less weight
 * when the SOP is cross-checked against it.
 */
export interface LinkedInRecord {
  source: 'pdf' | 'manual' | 'oauth';
  profileUrl: string;
  headline: string;
  location: string;
  summary: string;
  roles: LinkedInRole[];
  education: LinkedInEducation[];
  skills: string[];
  /** Total months of work history, capped when periods overlap. */
  totalMonths: number;
  importedAt: string;
}

// ── Derived traits ──────────────────────────────────────────────────────────

/**
 * Everything downstream scores against this. Each value is normalised to 0–1 so
 * the scorer never has to know which question produced it.
 */
export interface FounderTraits {
  bigFive: Record<BigFiveTrait, number>;
  workingStyle: Record<WorkingStyleAxis, number>;
  /** Self-rating 0–1 per domain, lifted where the LinkedIn record corroborates it. */
  skills: Record<SkillDomain, number>;
  archetype: Archetype;
  interests: InterestTag[];
  commitment: {
    hoursPerWeek: number;
    runwayMonths: number;
    /** 0 = already full time, higher = further away. */
    fullTimeDistance: number;
    relocation: number;
  };
  risk: {
    equityStance: number;
    salaryNeed: number;
    failureTolerance: number;
  };
  lookingFor: 'has_idea' | 'find_idea' | 'join_idea' | 'exploring';
  /** Lowercased significant terms from story + LinkedIn, for the lexical pass. */
  terms: string[];
}

// ── SOP validation ──────────────────────────────────────────────────────────

export type SopVerdict = 'authentic' | 'embellished' | 'templated' | 'unverifiable';

export interface SopValidation {
  /** 0–1. Multiplies the weight given to self-reported signals in a match. */
  credibility: number;
  specificity: number;
  evidenceBacked: number;
  consistency: number;
  verdict: SopVerdict;
  notes: string[];
  model: string;
  validatedAt: string;
  /** False when JEV was unavailable; credibility then falls back to a neutral 0.5. */
  aiAvailable: boolean;
}

// ── Profile ─────────────────────────────────────────────────────────────────

export interface FounderProfileSummary {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  headline: string;
  archetype: Archetype;
  interests: InterestTag[];
  topSkills: SkillDomain[];
  lookingFor: FounderTraits['lookingFor'];
  onboardedAt: string;
}

export interface FounderProfile extends FounderProfileSummary {
  linkedin: LinkedInRecord | null;
  traits: FounderTraits;
  sop: { text: string; proudOf: string; wants: string; validation: SopValidation | null };
  visibility: 'open' | 'selective';
  /** Bumped whenever answers change, so cached matches can be invalidated. */
  version: number;
  isSelf: boolean;
}

export interface OnboardingState {
  status: 'not_started' | 'linkedin_done' | 'complete';
  questionnaireVersion: number;
  completedAt: string | null;
}

// ── Matching ────────────────────────────────────────────────────────────────

export type MatchBand = 'strong' | 'promising' | 'exploratory' | 'weak';

export interface MatchComponent {
  id: string;
  label: string;
  /** 0–1 before weighting. */
  score: number;
  weight: number;
  /** One line the student can actually act on. */
  detail: string;
}

export interface MatchJudgement {
  visionAlignment: number;
  communicationFit: number;
  executionCredibility: number;
  conflictRisk: number;
  recommendation: 'strong_match' | 'promising' | 'exploratory' | 'not_now';
  model: string;
  available: boolean;
}

export interface MatchReport {
  pairId: string;
  score: number;
  band: MatchBand;
  /** Narrower when JEV was unavailable or either SOP is weakly corroborated. */
  confidence: 'high' | 'medium' | 'low';
  components: MatchComponent[];
  strengths: string[];
  frictions: string[];
  openQuestions: string[];
  judgement: MatchJudgement;
  counterpart: FounderProfileSummary;
  computedAt: string;
}

// ── Feed ────────────────────────────────────────────────────────────────────

export type PostKind = 'post' | 'idea' | 'poll';

export interface PollOption { id: string; label: string }

export interface FounderPost {
  id: string;
  kind: PostKind;
  authorUid: string;
  authorName: string;
  authorHeadline: string;
  authorPhoto: string;
  anonymous: boolean;
  title: string;
  body: string;
  tags: InterestTag[];
  /** Present when kind === 'idea'. */
  idea: { problem: string; stage: string; lookingFor: SkillDomain[] } | null;
  /** Present when kind === 'poll'. */
  poll: { options: PollOption[]; counts: Record<string, number>; totalVotes: number; closesAt: string } | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  /** Viewer-specific, resolved per request. */
  likedByMe: boolean;
  myVote: string | null;
  isAuthor: boolean;
}

export interface FounderComment {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  anonymous: boolean;
  body: string;
  createdAt: string;
  isAuthor: boolean;
}

// ── Direct messages ─────────────────────────────────────────────────────────

export interface ThreadParticipant {
  uid: string;
  name: string;
  photo: string;
  headline: string;
}

export interface FounderThread {
  id: string;
  counterpart: ThreadParticipant;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderUid: string;
  unread: number;
}

export interface FounderMessage {
  id: string;
  fromUid: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

// ── Stored shapes (server only) ─────────────────────────────────────────────

export interface StoredFounderProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  headline: string;
  onboarding: OnboardingState;
  linkedin: LinkedInRecord | null;
  answers: Record<string, number | number[] | string>;
  traits: FounderTraits;
  sop: { text: string; proudOf: string; wants: string; validation: SopValidation | null };
  visibility: 'open' | 'selective';
  aiConsentAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMatch {
  pairId: string;
  uids: string[];
  score: number;
  band: MatchBand;
  confidence: MatchReport['confidence'];
  components: MatchComponent[];
  strengths: string[];
  frictions: string[];
  openQuestions: string[];
  judgement: MatchJudgement;
  /** Profile versions the score was computed from; a bump forces a recompute. */
  versions: Record<string, number>;
  computedAt: string;
}
