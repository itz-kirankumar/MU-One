import {
  ARCHETYPES, ARCHETYPE_DOMAINS, BIG_FIVE_TRAITS, FOUNDER_QUESTIONS, INTEREST_TAGS,
  SKILL_DOMAINS, SKILL_KEYWORDS, WORKING_STYLE_AXES,
} from './taxonomy';
import type { Archetype, BigFiveTrait, InterestTag, SkillDomain, WorkingStyleAxis } from './taxonomy';
import type { FounderTraits, LinkedInRecord } from './model';

export type AnswerMap = Record<string, number | number[] | string>;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const num = (answers: AnswerMap, id: string, fallback = 0): number => {
  const value = answers[id];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const str = (answers: AnswerMap, id: string): string => {
  const value = answers[id];
  return typeof value === 'string' ? value : '';
};

// Ordinal answers become the quantity they stand for, not their index. "10–20
// hours" and "50+ hours" are four index steps apart but eleven hours-per-week
// apart at the bottom and thirteen at the top; scoring on the index would treat
// those gaps as equal.
const HOURS = [5, 15, 27, 42, 55];
const RUNWAY_MONTHS = [0, 3, 4.5, 9, 15];
const FULL_TIME_DISTANCE = [0, 0.25, 0.5, 0.8, 1];
const RELOCATION = [0, 0.33, 0.67, 1];
/** 0 = equity must be split evenly, 1 = equity should track contribution. */
const EQUITY_STANCE = [0, 0.3, 0.65, 0.9, 0.5];
const SALARY_NEED = [0, 0.33, 0.67, 1];
const LOOKING_FOR: FounderTraits['lookingFor'][] = ['has_idea', 'find_idea', 'join_idea', 'exploring'];

const pick = <T>(table: T[], index: number, fallback: T): T =>
  (Number.isInteger(index) && index >= 0 && index < table.length ? table[index] : fallback);

// ── Text ────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'has', 'had', 'was', 'were', 'are',
  'but', 'not', 'you', 'your', 'our', 'their', 'they', 'them', 'his', 'her', 'its', 'been', 'being',
  'would', 'could', 'should', 'will', 'can', 'may', 'about', 'into', 'over', 'than', 'then', 'when',
  'what', 'which', 'who', 'how', 'why', 'all', 'any', 'each', 'more', 'most', 'other', 'some', 'such',
  'only', 'own', 'same', 'very', 'just', 'also', 'get', 'got', 'one', 'two', 'out', 'use', 'used',
  'using', 'work', 'working', 'worked', 'want', 'wanted', 'like', 'make', 'made', 'really', 'lot',
  'things', 'thing', 'people', 'time', 'year', 'years', 'month', 'months', 'day', 'days', 'new',
]);

/** Lowercased alphanumeric terms of 3+ characters, stopwords removed. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]+/g, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/^[.]+|[.]+$/g, ''))
    .filter((token) => token.length >= 3 && token.length <= 30 && !STOPWORDS.has(token) && !/^\d+$/.test(token));
}

// ── LinkedIn corroboration ──────────────────────────────────────────────────

/**
 * How strongly the imported LinkedIn record backs each skill domain, 0–1.
 *
 * Titles count for more than descriptions: anyone can mention Python in a bullet
 * point, but "Backend Engineer" in a job title is a claim someone else signed
 * off on. Months in role scale the weight so a five-year stint outranks a
 * six-week internship.
 */
export function skillEvidence(record: LinkedInRecord | null): Record<SkillDomain, number> {
  const evidence = Object.fromEntries(SKILL_DOMAINS.map((d) => [d, 0])) as Record<SkillDomain, number>;
  if (!record) return evidence;

  const listed = record.skills.join(' ').toLowerCase();
  const headline = `${record.headline} ${record.summary}`.toLowerCase();

  for (const domain of SKILL_DOMAINS) {
    let weight = 0;
    for (const keyword of SKILL_KEYWORDS[domain]) {
      if (listed.includes(keyword)) weight += 0.6;
      if (headline.includes(keyword)) weight += 1.2;
      for (const role of record.roles) {
        const title = role.title.toLowerCase();
        const body = role.description.toLowerCase();
        // A short role still proves the skill; a long one proves depth. Cap the
        // multiplier at 2 so one decade-long job cannot saturate every domain.
        const tenure = 1 + Math.min(1, role.months / 36);
        if (title.includes(keyword)) weight += 1.5 * tenure;
        else if (body.includes(keyword)) weight += 0.4 * tenure;
      }
    }
    // 6 points of raw keyword weight is treated as full corroboration.
    evidence[domain] = clamp01(weight / 6);
  }
  return evidence;
}

// ── Derivation ──────────────────────────────────────────────────────────────

function bigFive(answers: AnswerMap): Record<BigFiveTrait, number> {
  const result = {} as Record<BigFiveTrait, number>;
  for (const trait of BIG_FIVE_TRAITS) {
    const items = FOUNDER_QUESTIONS.filter((q) => q.section === 'personality' && q.target === trait);
    // Reverse-keyed items are flipped onto the same 1–7 direction before averaging,
    // so agreeing with everything lands at the midpoint rather than the top.
    const total = items.reduce((sum, item) => {
      const raw = num(answers, item.id, 4);
      return sum + (item.reverse ? 8 - raw : raw);
    }, 0);
    const mean = items.length ? total / items.length : 4;
    result[trait] = clamp01((mean - 1) / 6);
  }
  return result;
}

function workingStyle(answers: AnswerMap): Record<WorkingStyleAxis, number> {
  const result = {} as Record<WorkingStyleAxis, number>;
  for (const axis of WORKING_STYLE_AXES) result[axis.id] = clamp01(num(answers, `w_${axis.id}`, 3) / 6);
  return result;
}

function selfSkills(answers: AnswerMap): Record<SkillDomain, number> {
  const result = {} as Record<SkillDomain, number>;
  for (const domain of SKILL_DOMAINS) result[domain] = clamp01(num(answers, `s_${domain}`, 0) / 4);
  return result;
}

function interests(answers: AnswerMap): InterestTag[] {
  const raw = answers.i_tags;
  if (!Array.isArray(raw)) return [];
  const tags = raw
    .filter((index): index is number => Number.isInteger(index) && index >= 0 && index < INTEREST_TAGS.length)
    .map((index) => INTEREST_TAGS[index]);
  return [...new Set(tags)].slice(0, 5);
}

/** The domain group a founder scores highest in becomes their archetype. */
export function archetypeFor(skills: Record<SkillDomain, number>): Archetype {
  let best: Archetype = 'domain_expert';
  let bestScore = -1;
  for (const archetype of ARCHETYPES) {
    const domains = ARCHETYPE_DOMAINS[archetype];
    const score = domains.reduce((sum, domain) => sum + skills[domain], 0) / domains.length;
    if (score > bestScore) {
      bestScore = score;
      best = archetype;
    }
  }
  return best;
}

export function deriveTraits(answers: AnswerMap, record: LinkedInRecord | null): FounderTraits {
  const self = selfSkills(answers);
  const evidence = skillEvidence(record);

  // Corroboration lifts a self-rating toward certainty but never lowers it —
  // an absent LinkedIn record is missing evidence, not counter-evidence. The
  // penalty for an unsupported claim is applied once, through SOP credibility,
  // rather than silently here where the student could not see it.
  const skills = {} as Record<SkillDomain, number>;
  for (const domain of SKILL_DOMAINS) {
    skills[domain] = clamp01(self[domain] + 0.25 * evidence[domain] * (1 - self[domain]));
  }

  const storyText = [str(answers, 'st_sop'), str(answers, 'st_proud'), str(answers, 'st_looking')].join(' ');
  const recordText = record
    ? [record.headline, record.summary, record.skills.join(' '),
      record.roles.map((role) => `${role.title} ${role.company} ${role.description}`).join(' ')].join(' ')
    : '';

  return {
    bigFive: bigFive(answers),
    workingStyle: workingStyle(answers),
    skills,
    archetype: archetypeFor(skills),
    interests: interests(answers),
    commitment: {
      hoursPerWeek: pick(HOURS, num(answers, 'c_hours', 1), 15),
      runwayMonths: pick(RUNWAY_MONTHS, num(answers, 'c_runway', 1), 3),
      fullTimeDistance: pick(FULL_TIME_DISTANCE, num(answers, 'c_fulltime', 2), 0.5),
      relocation: pick(RELOCATION, num(answers, 'c_relocate', 1), 0.33),
    },
    risk: {
      equityStance: pick(EQUITY_STANCE, num(answers, 'r_equity', 1), 0.3),
      salaryNeed: pick(SALARY_NEED, num(answers, 'r_salary', 1), 0.33),
      failureTolerance: clamp01(num(answers, 'r_failure', 3) / 6),
    },
    lookingFor: pick(LOOKING_FOR, num(answers, 'r_stage', 3), 'exploring'),
    terms: [...new Set(tokenize(`${storyText} ${recordText}`))].slice(0, 400),
  };
}

/** Domains a founder could lead, strongest first. Used for profile summaries. */
export function topSkills(skills: Record<SkillDomain, number>, limit = 3): SkillDomain[] {
  return [...SKILL_DOMAINS]
    .filter((domain) => skills[domain] > 0)
    .sort((a, b) => skills[b] - skills[a])
    .slice(0, limit);
}
