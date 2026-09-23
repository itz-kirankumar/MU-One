/**
 * Every value that crosses the callable boundary is checked here before it
 * reaches `service.ts`. Nothing downstream re-checks, so nothing here may be
 * skipped.
 *
 * The questionnaire is validated against `FOUNDER_QUESTIONS` rather than against
 * a hand-written schema: the taxonomy is the single definition of what a valid
 * answer set looks like, and a question added there is enforced here for free.
 */

import { HttpsError } from 'firebase-functions/v2/https';
import {
  FOUNDER_QUESTIONS, INTEREST_TAGS, QUESTION_BY_ID, SKILL_DOMAINS,
} from './taxonomy';
import type { FounderQuestion, InterestTag, SkillDomain } from './taxonomy';
import { LinkedInParseError, parseLinkedInExport } from './linkedin';
import type { AnswerMap } from './traits';
import type { LinkedInRecord, PostKind } from './model';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('invalid-argument', 'Invalid Founder Connect request.');
  }
  return value as Record<string, unknown>;
}

export function text(value: unknown, label: string, max: number, min = 1): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed.length < min || trimmed.length > max) {
    throw new HttpsError('invalid-argument', `${label} must contain ${min}–${max} characters.`);
  }
  return trimmed;
}

export function optionalText(value: unknown, label: string, max: number): string {
  if (value === undefined || value === null || value === '') return '';
  return text(value, label, max);
}

export function documentId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{10,80}$/.test(value)) {
    throw new HttpsError('invalid-argument', 'Invalid identifier.');
  }
  return value;
}

/** Firebase Auth uids are opaque; this only guards shape, never authorisation. */
export function uid(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(value)) {
    throw new HttpsError('invalid-argument', 'Invalid user identifier.');
  }
  return value;
}

export function email(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[^\s@]{1,64}@[^\s@]{3,190}\.[a-z]{2,24}$/.test(raw)) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }
  return raw;
}

export function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new HttpsError('invalid-argument', `${label} must be true or false.`);
  return value;
}

export function cursor(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return documentId(value);
}

// ── Questionnaire ───────────────────────────────────────────────────────────

function integerInRange(value: unknown, question: FounderQuestion, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new HttpsError('invalid-argument', `Answer "${question.title}" using one of the offered options.`);
  }
  return value;
}

function validateOne(question: FounderQuestion, raw: unknown): number | number[] | string | undefined {
  const missing = raw === undefined || raw === null || raw === ''
    || (Array.isArray(raw) && raw.length === 0);

  if (missing) {
    if (question.required) throw new HttpsError('invalid-argument', `Please answer: ${question.title}`);
    return question.kind === 'text' ? '' : undefined;
  }

  switch (question.kind) {
    case 'likert':
    case 'scale':
      return integerInRange(raw, question, question.min ?? 0, question.max ?? 6);
    case 'single':
      return integerInRange(raw, question, 0, (question.options?.length ?? 1) - 1);
    case 'multi': {
      if (!Array.isArray(raw)) {
        throw new HttpsError('invalid-argument', `Choose options for: ${question.title}`);
      }
      const limit = (question.options?.length ?? INTEREST_TAGS.length) - 1;
      const chosen = raw.map((entry) => integerInRange(entry, question, 0, limit));
      const unique = [...new Set(chosen)];
      if (unique.length !== chosen.length) {
        throw new HttpsError('invalid-argument', `Duplicate selections for: ${question.title}`);
      }
      if (unique.length > 5) {
        throw new HttpsError('invalid-argument', 'Pick at most 5 spaces you want to build in.');
      }
      return unique;
    }
    case 'text': {
      const value = text(raw, question.title, question.maxChars ?? 2000, question.minChars ?? 1);
      return value;
    }
    default:
      throw new HttpsError('invalid-argument', 'Unknown question type.');
  }
}

/**
 * Accepts the answer map only if every required question in the current
 * taxonomy has a usable answer. Unknown keys are dropped rather than rejected,
 * so a client running one version behind cannot be locked out by a stale field.
 */
export function validateAnswers(input: unknown): AnswerMap {
  const data = object(input);
  const answers: AnswerMap = {};

  for (const question of FOUNDER_QUESTIONS) {
    const value = validateOne(question, data[question.id]);
    if (value !== undefined) answers[question.id] = value;
  }

  const unknown = Object.keys(data).filter((key) => !QUESTION_BY_ID.has(key));
  if (unknown.length > 40) {
    throw new HttpsError('invalid-argument', 'Too many fields in the submission.');
  }
  return answers;
}

/** Self-ratings keyed by label, for the SOP consistency check. */
export function selfRatedSkills(answers: AnswerMap): Record<SkillDomain, number> {
  const result = {} as Record<SkillDomain, number>;
  for (const domain of SKILL_DOMAINS) {
    const value = answers[`s_${domain}`];
    result[domain] = typeof value === 'number' ? value : 0;
  }
  return result;
}

// ── LinkedIn ────────────────────────────────────────────────────────────────

const MAX_EXPORT_CHARS = 120_000;

function role(raw: unknown) {
  const data = object(raw);
  const months = Number(data.months);
  return {
    title: text(data.title, 'Role title', 200),
    company: optionalText(data.company, 'Company', 200),
    period: optionalText(data.period, 'Period', 80),
    months: Number.isFinite(months) ? Math.max(0, Math.min(600, Math.round(months))) : 0,
    description: optionalText(data.description, 'Role description', 2000),
  };
}

/**
 * Two entry paths converge here. `pdf` carries the raw extracted text and is
 * parsed server-side so the parser is testable. A PDF or manual entry is
 * student-provided evidence, not independently verified LinkedIn data;
 * `source` records which input path was used.
 */
export function validateLinkedIn(input: unknown): LinkedInRecord {
  const data = object(input);
  const source = data.source;
  const importedAt = new Date().toISOString();

  if (source === 'pdf') {
    const raw = text(data.extractedText, 'Extracted profile text', MAX_EXPORT_CHARS, 80);
    try {
      const parsed = parseLinkedInExport(raw);
      if (!parsed.roles.length && !parsed.summary && !parsed.education.length) {
        throw new LinkedInParseError('We could not find any experience, summary or education in that export.');
      }
      return {
        source: 'pdf',
        profileUrl: parsed.profileUrl,
        headline: parsed.headline,
        location: parsed.location,
        summary: parsed.summary,
        roles: parsed.roles,
        education: parsed.education,
        skills: parsed.skills,
        totalMonths: parsed.totalMonths,
        importedAt,
      };
    } catch (error) {
      if (error instanceof LinkedInParseError) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'We could not read that LinkedIn export.');
    }
  }

  if (source !== 'manual') {
    throw new HttpsError('invalid-argument', 'Import your LinkedIn profile as a PDF export, or enter it by hand.');
  }

  const roles = Array.isArray(data.roles) ? data.roles.slice(0, 25).map(role) : [];
  const education = Array.isArray(data.education)
    ? data.education.slice(0, 10).map((raw) => {
      const entry = object(raw);
      return {
        school: text(entry.school, 'School', 200),
        degree: optionalText(entry.degree, 'Degree', 200),
        period: optionalText(entry.period, 'Period', 80),
      };
    })
    : [];
  const skills = Array.isArray(data.skills)
    ? [...new Set(data.skills.slice(0, 60).map((entry) => text(entry, 'Skill', 60)))]
    : [];

  const profileUrl = optionalText(data.profileUrl, 'LinkedIn URL', 300);
  if (profileUrl && !/^https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?$/i.test(profileUrl)) {
    throw new HttpsError('invalid-argument', 'Enter a LinkedIn profile URL like https://www.linkedin.com/in/your-name.');
  }

  return {
    source: 'manual',
    profileUrl,
    headline: text(data.headline, 'Headline', 300),
    location: optionalText(data.location, 'Location', 150),
    summary: optionalText(data.summary, 'Summary', 4000),
    roles,
    education,
    skills,
    totalMonths: roles.reduce((sum, entry) => sum + entry.months, 0),
    importedAt,
  };
}

// ── Feed ────────────────────────────────────────────────────────────────────

const POST_KINDS: PostKind[] = ['post', 'idea', 'poll'];
const IDEA_STAGES = ['just_an_idea', 'validating', 'building', 'launched'];

export interface PostDraft {
  kind: PostKind;
  title: string;
  body: string;
  tags: InterestTag[];
  anonymous: boolean;
  idea: { problem: string; stage: string; lookingFor: SkillDomain[] } | null;
  poll: { options: string[]; durationDays: number } | null;
}

export function validatePostDraft(input: unknown): PostDraft {
  const data = object(input);
  if (typeof data.kind !== 'string' || !POST_KINDS.includes(data.kind as PostKind)) {
    throw new HttpsError('invalid-argument', 'Choose whether this is a post, an idea or a poll.');
  }
  const kind = data.kind as PostKind;

  const tagIndexes = Array.isArray(data.tags) ? data.tags : [];
  if (tagIndexes.length > 5) throw new HttpsError('invalid-argument', 'Tag a post with at most 5 spaces.');
  const tags = [...new Set(tagIndexes.map((entry) => {
    if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0 || entry >= INTEREST_TAGS.length) {
      throw new HttpsError('invalid-argument', 'Unknown tag.');
    }
    return INTEREST_TAGS[entry];
  }))];

  const draft: PostDraft = {
    kind,
    title: text(data.title, 'Title', 160, 4),
    // A poll's question lives in the title, so its body may be empty.
    body: kind === 'poll' ? optionalText(data.body, 'Body', 4000) : text(data.body, 'Body', 4000, 10),
    tags,
    anonymous: boolean(data.anonymous, 'Anonymous'),
    idea: null,
    poll: null,
  };

  if (kind === 'idea') {
    const idea = object(data.idea);
    if (typeof idea.stage !== 'string' || !IDEA_STAGES.includes(idea.stage)) {
      throw new HttpsError('invalid-argument', 'Pick the stage this idea is at.');
    }
    const wanted = Array.isArray(idea.lookingFor) ? idea.lookingFor : [];
    if (wanted.length > 4) throw new HttpsError('invalid-argument', 'List at most 4 domains you need.');
    draft.idea = {
      problem: text(idea.problem, 'Problem', 600, 20),
      stage: idea.stage,
      lookingFor: [...new Set(wanted.map((entry) => {
        if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0 || entry >= SKILL_DOMAINS.length) {
          throw new HttpsError('invalid-argument', 'Unknown domain.');
        }
        return SKILL_DOMAINS[entry];
      }))],
    };
  }

  if (kind === 'poll') {
    const poll = object(data.poll);
    if (!Array.isArray(poll.options) || poll.options.length < 2 || poll.options.length > 6) {
      throw new HttpsError('invalid-argument', 'A poll needs 2–6 options.');
    }
    const options = poll.options.map((option) => text(option, 'Poll option', 120, 1));
    if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
      throw new HttpsError('invalid-argument', 'Poll options must be different.');
    }
    const days = Number(poll.durationDays);
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      throw new HttpsError('invalid-argument', 'Polls run for 1–30 days.');
    }
    draft.poll = { options, durationDays: days };
  }

  return draft;
}

export function validateComment(input: unknown): { postId: string; body: string; anonymous: boolean } {
  const data = object(input);
  return {
    postId: documentId(data.postId),
    body: text(data.body, 'Comment', 2000, 2),
    anonymous: boolean(data.anonymous, 'Anonymous'),
  };
}

/** Poll option ids are generated server-side as `o1`…`o6`. */
export function pollOptionId(value: unknown): string {
  if (typeof value !== 'string' || !/^o[1-6]$/.test(value)) {
    throw new HttpsError('invalid-argument', 'Choose one of the poll options.');
  }
  return value;
}
