/**
 * Pairwise founder compatibility.
 *
 * Every number here is computed in code from the trait vectors, so a student can
 * be shown exactly why they scored what they scored, and the same two profiles
 * always produce the same result. The LLM layer (`jevMatch.ts`) is added on top
 * of this, never in place of it.
 *
 * Two ideas are borrowed from Laya's retrieval design: structural and lexical
 * signals are scored separately and combined by rank rather than by raw value
 * (see `rankCandidates`), and a deterministic score is only ever *confirmed* by
 * a model, not replaced by one.
 */

import { SKILL_DOMAINS, SKILL_DOMAIN_LABELS, WORKING_STYLE_AXES } from './taxonomy';
import type { SkillDomain } from './taxonomy';
import type {
  FounderTraits, MatchBand, MatchComponent, MatchJudgement, SopValidation,
} from './model';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** Components built purely from self-rating, so SOP credibility can damp them. */
const SELF_REPORTED = new Set(['complementarity', 'personality', 'workingStyle']);

const WEIGHTS: Record<string, number> = {
  complementarity: 0.2,
  sharedDomain: 0.15,
  commitment: 0.18,
  workingStyle: 0.15,
  risk: 0.12,
  personality: 0.1,
  lexical: 0.1,
};

/** Share of the final score handed to the model when JEV answers. */
const JEV_WEIGHT = 0.3;

// ── Individual signals ──────────────────────────────────────────────────────

/**
 * Skills should differ. A pair is scored on how much ground they cover between
 * them and on how much of that ground only one of them holds — two excellent
 * backend engineers cover one domain twice and leave nine empty.
 *
 * Coverage is measured over the best six domains, not all ten: two people
 * cannot credibly own ten, and averaging over ten would compress every real
 * pair into the bottom third of the range.
 */
export function complementarity(a: Record<SkillDomain, number>, b: Record<SkillDomain, number>) {
  const perDomain = SKILL_DOMAINS.map((domain) => ({
    domain,
    covered: Math.max(a[domain], b[domain]),
    soleOwner: Math.abs(a[domain] - b[domain]),
  }));
  const top = [...perDomain].sort((x, y) => y.covered - x.covered).slice(0, 6);
  const coverage = mean(top.map((entry) => entry.covered));
  const specialisation = coverage > 0.05 ? clamp01(mean(top.map((entry) => entry.soleOwner)) / coverage) : 0;

  const gaps = SKILL_DOMAINS.filter((domain) => Math.max(a[domain], b[domain]) < 0.3);
  const shared = top.filter((entry) => Math.min(a[entry.domain], b[entry.domain]) > 0.6).map((e) => e.domain);

  return {
    score: clamp01(0.6 * coverage + 0.4 * specialisation),
    coverage,
    specialisation,
    gaps,
    overlapping: shared,
  };
}

/**
 * Interests should match, which is the opposite of skills. Overlap coefficient
 * dominates because picking one shared space out of five each is a real signal,
 * and Jaccard would score that at 0.11.
 */
export function sharedDomain(a: string[], b: string[]) {
  if (!a.length || !b.length) return { score: 0.3, shared: [] as string[] };
  const setB = new Set(b);
  const shared = a.filter((tag) => setB.has(tag));
  const union = new Set([...a, ...b]).size;
  const overlapCoefficient = shared.length / Math.min(a.length, b.length);
  const jaccard = shared.length / union;
  return { score: clamp01(0.6 * overlapCoefficient + 0.4 * jaccard), shared };
}

/**
 * Per-axis, and the direction depends on the axis. Differing on pace means one
 * founder is always waiting for the other; differing on process versus
 * improvisation is how a team gets both shipping speed and a working payroll.
 */
export function workingStyleFit(a: FounderTraits['workingStyle'], b: FounderTraits['workingStyle']) {
  const axes = WORKING_STYLE_AXES.map((axis) => {
    const distance = Math.abs(a[axis.id] - b[axis.id]);
    // `similar` decays linearly with distance. `complement` peaks at a clear but
    // not total difference (0.6) and never falls below 0.35, because two people
    // who happen to work the same way are workable, just less resilient.
    const score = axis.mode === 'similar'
      ? 1 - distance
      : clamp01(0.35 + 0.65 * (1 - Math.abs(distance - 0.6) / 0.6));
    return { id: axis.id, mode: axis.mode, distance, score };
  });
  const clashes = axes.filter((axis) => axis.mode === 'similar' && axis.distance > 0.5);
  return { score: clamp01(mean(axes.map((axis) => axis.score))), axes, clashes };
}

/**
 * The single most common reason a student founding team dies: one person is
 * full time and broke, the other has a job offer they intend to take.
 */
export function commitmentFit(a: FounderTraits['commitment'], b: FounderTraits['commitment']) {
  const hoursGap = Math.abs(a.hoursPerWeek - b.hoursPerWeek);
  const hoursFloor = Math.min(a.hoursPerWeek, b.hoursPerWeek);
  const hours = 0.6 * (1 - clamp01(hoursGap / 30)) + 0.4 * clamp01(hoursFloor / 35);

  // A pair's runway is the shorter of the two, not the average.
  const runwayFloor = Math.min(a.runwayMonths, b.runwayMonths);
  const runway = 0.7 * clamp01(runwayFloor / 9)
    + 0.3 * (1 - clamp01(Math.abs(a.runwayMonths - b.runwayMonths) / 12));

  const fullTime = 1 - Math.abs(a.fullTimeDistance - b.fullTimeDistance);
  const relocation = 1 - Math.abs(a.relocation - b.relocation);
  const aligned = 0.4 * hours + 0.25 * runway + 0.25 * fullTime + 0.1 * relocation;

  // Hours cap the result rather than only being averaged into it. Agreeing on
  // runway, location and a full-time date does not make a 5-hour founder and a
  // 45-hour founder a workable pair, and a weighted sum would say it does.
  const ceiling = 0.35 + 0.65 * hours;

  return {
    score: clamp01(Math.min(aligned, ceiling)),
    hoursGap, hoursFloor, runwayFloor,
    fullTimeGap: Math.abs(a.fullTimeDistance - b.fullTimeDistance),
  };
}

export function riskFit(a: FounderTraits['risk'], b: FounderTraits['risk']) {
  const equityGap = Math.abs(a.equityStance - b.equityStance);
  const equity = 1 - equityGap;
  // Aligned salary expectations matter, but two founders who both need a market
  // salary are a funding problem regardless of how well they agree.
  const salary = 0.6 * (1 - Math.abs(a.salaryNeed - b.salaryNeed))
    + 0.4 * (1 - Math.max(a.salaryNeed, b.salaryNeed));
  const failure = 0.5 * mean([a.failureTolerance, b.failureTolerance])
    + 0.5 * (1 - Math.abs(a.failureTolerance - b.failureTolerance));
  return { score: clamp01(0.4 * equity + 0.3 * salary + 0.3 * failure), equityGap };
}

/**
 * Big Five, aggregated non-linearly. Averaging would let one founder's strength
 * paper over the other's absence of it, which is exactly backwards for traits
 * like conscientiousness where the team performs at the level of the weaker one.
 */
export function personalityFit(a: FounderTraits['bigFive'], b: FounderTraits['bigFive']) {
  const both = (trait: keyof FounderTraits['bigFive']) => [a[trait], b[trait]];
  const floorWeighted = (trait: keyof FounderTraits['bigFive'], floorShare: number) => {
    const [x, y] = both(trait);
    return floorShare * Math.min(x, y) + (1 - floorShare) * mean([x, y]);
  };

  const conscientiousness = floorWeighted('conscientiousness', 0.7);
  const emotionalStability = floorWeighted('emotionalStability', 0.65);
  // One founder able to defuse an argument is enough, so this one takes the max.
  const agreeableness = 0.6 * Math.max(a.agreeableness, b.agreeableness)
    + 0.4 * mean(both('agreeableness'));
  const openness = 0.5 * mean(both('openness')) + 0.5 * (1 - Math.abs(a.openness - b.openness));
  const extraversion = 0.6 * Math.max(a.extraversion, b.extraversion)
    + 0.4 * (1 - 0.5 * Math.abs(a.extraversion - b.extraversion));

  const score = 0.3 * conscientiousness + 0.2 * emotionalStability + 0.2 * agreeableness
    + 0.15 * openness + 0.15 * extraversion;
  return { score: clamp01(score), conscientiousness, emotionalStability, agreeableness };
}

/**
 * Cosine over term sets, IDF-weighted when a corpus is available.
 *
 * Rare shared terms carry the signal: two students both writing "supply chain
 * financing for tier-2 dealers" have found each other, two both writing
 * "passionate about startups" have not. Without a corpus every term weighs 1,
 * which degrades to plain set cosine rather than failing.
 */
export function lexicalSimilarity(a: string[], b: string[], idf?: Map<string, number>): number {
  if (!a.length || !b.length) return 0;
  const weight = (term: string) => idf?.get(term) ?? 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let dot = 0;
  for (const term of setA) if (setB.has(term)) dot += weight(term) ** 2;
  const normA = Math.sqrt([...setA].reduce((sum, term) => sum + weight(term) ** 2, 0));
  const normB = Math.sqrt([...setB].reduce((sum, term) => sum + weight(term) ** 2, 0));
  if (!normA || !normB) return 0;
  // Short profiles produce a handful of terms and can hit a spuriously high
  // cosine, so the raw value is stretched: 0.4 cosine is already a strong match.
  return clamp01((dot / (normA * normB)) / 0.4);
}

/** Inverse document frequency across a candidate pool, for `rankCandidates`. */
export function buildIdf(documents: string[][]): Map<string, number> {
  const frequency = new Map<string, number>();
  for (const document of documents) {
    for (const term of new Set(document)) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  }
  const total = documents.length || 1;
  const idf = new Map<string, number>();
  for (const [term, count] of frequency) idf.set(term, Math.log(1 + total / count));
  return idf;
}

// ── Composition ─────────────────────────────────────────────────────────────

export interface RawSignals {
  complementarity: ReturnType<typeof complementarity>;
  sharedDomain: ReturnType<typeof sharedDomain>;
  workingStyle: ReturnType<typeof workingStyleFit>;
  commitment: ReturnType<typeof commitmentFit>;
  risk: ReturnType<typeof riskFit>;
  personality: ReturnType<typeof personalityFit>;
  lexical: number;
}

export function computeSignals(a: FounderTraits, b: FounderTraits, idf?: Map<string, number>): RawSignals {
  return {
    complementarity: complementarity(a.skills, b.skills),
    sharedDomain: sharedDomain(a.interests, b.interests),
    workingStyle: workingStyleFit(a.workingStyle, b.workingStyle),
    commitment: commitmentFit(a.commitment, b.commitment),
    risk: riskFit(a.risk, b.risk),
    personality: personalityFit(a.bigFive, b.bigFive),
    lexical: lexicalSimilarity(a.terms, b.terms, idf),
  };
}

const percent = (value: number) => Math.round(value * 100);
const domainList = (domains: SkillDomain[]) => domains.map((d) => SKILL_DOMAIN_LABELS[d]).join(', ');

function describe(signals: RawSignals, a: FounderTraits, b: FounderTraits): MatchComponent[] {
  const { complementarity: comp, sharedDomain: domain, workingStyle: style, commitment, risk, personality } = signals;

  const clashNames = style.clashes.map((clash) => clash.id).join(' and ');
  const hoursDetail = commitment.hoursGap >= 20
    ? `${Math.round(commitment.hoursGap)} hours a week apart in what you can give`
    : `both in the ${Math.round(commitment.hoursFloor)}+ hours a week range, with ${Math.round(commitment.runwayFloor)} months of shared runway`;

  return [
    {
      id: 'complementarity',
      label: 'Skill complementarity',
      score: comp.score,
      weight: WEIGHTS.complementarity,
      detail: comp.overlapping.length
        ? `You both lead on ${domainList(comp.overlapping)}, so that strength is doubled up. Uncovered: ${domainList(comp.gaps.slice(0, 3)) || 'nothing major'}.`
        : `Between you the pair covers ${percent(comp.coverage)}% of what a founding team needs, and ${percent(comp.specialisation)}% of it is owned by only one of you. Uncovered: ${domainList(comp.gaps.slice(0, 3)) || 'nothing major'}.`,
    },
    {
      id: 'sharedDomain',
      label: 'Shared problem space',
      score: domain.score,
      weight: WEIGHTS.sharedDomain,
      detail: domain.shared.length
        ? `You both want to build in ${domain.shared.join(', ')}.`
        : 'You picked no overlapping spaces. One of you would be building in the other\'s second choice.',
    },
    {
      id: 'commitment',
      label: 'Commitment alignment',
      score: commitment.score,
      weight: WEIGHTS.commitment,
      detail: `${hoursDetail}.${commitment.fullTimeGap > 0.4 ? ' You also plan to go full time at different points.' : ''}`,
    },
    {
      id: 'workingStyle',
      label: 'Working style',
      score: style.score,
      weight: WEIGHTS.workingStyle,
      detail: style.clashes.length
        ? `You work differently on ${clashNames}, which is the kind of difference that shows up every day rather than balancing out.`
        : 'No daily-friction gaps on pace, conflict or communication.',
    },
    {
      id: 'risk',
      label: 'Risk & equity',
      score: risk.score,
      weight: WEIGHTS.risk,
      detail: risk.equityGap > 0.35
        ? 'You hold different views on how equity should be split. Settle that before you write any code.'
        : 'Aligned on equity, pay expectations and what failure would cost you.',
    },
    {
      id: 'personality',
      label: 'Personality fit',
      score: personality.score,
      weight: WEIGHTS.personality,
      detail: personality.conscientiousness < 0.45
        ? 'Neither of you scores high on follow-through. This pair will need external structure.'
        : personality.emotionalStability < 0.4
          ? 'Both of you run hot under pressure. Agree in advance how you break a deadlock.'
          : 'Complementary temperaments with enough follow-through and enough give to resolve a disagreement.',
    },
    {
      id: 'lexical',
      label: 'Story resonance',
      score: signals.lexical,
      weight: WEIGHTS.lexical,
      detail: signals.lexical > 0.5
        ? 'Your statements of purpose and work histories describe recognisably the same territory.'
        : 'Your written stories have little vocabulary in common — you are describing different problems.',
    },
  ].map((component) => ({
    ...component,
    detail: component.id === 'complementarity' && a.archetype === b.archetype
      ? `${component.detail} You are both ${a.archetype.replace('_', ' ')}s.`
      : component.detail,
  }));
}

export interface PairScoreInput {
  a: FounderTraits;
  b: FounderTraits;
  sopA: SopValidation | null;
  sopB: SopValidation | null;
  judgement: MatchJudgement;
  idf?: Map<string, number>;
}

export interface PairScore {
  score: number;
  band: MatchBand;
  confidence: 'high' | 'medium' | 'low';
  components: MatchComponent[];
  strengths: string[];
  frictions: string[];
  openQuestions: string[];
}

export function bandFor(score: number): MatchBand {
  if (score >= 78) return 'strong';
  if (score >= 62) return 'promising';
  if (score >= 45) return 'exploratory';
  return 'weak';
}

/** Collapses JEV's four ratings into one 0–1 figure. */
export function judgementScore(judgement: MatchJudgement): number {
  return clamp01(
    0.35 * judgement.visionAlignment
    + 0.25 * judgement.communicationFit
    + 0.25 * judgement.executionCredibility
    + 0.15 * (1 - judgement.conflictRisk),
  );
}

export function scorePair(input: PairScoreInput): PairScore {
  const { a, b, sopA, sopB, judgement, idf } = input;
  const signals = computeSignals(a, b, idf);
  const components = describe(signals, a, b);

  // A pair is only as credible as the less corroborated of its two stories.
  const credibility = Math.min(sopA?.credibility ?? 0.5, sopB?.credibility ?? 0.5);

  // Self-rated components are pulled toward neutral when the SOP did not hold
  // up against the LinkedIn record. At full credibility nothing moves; at zero,
  // a self-reported score keeps only 60% of its distance from the midpoint.
  const shrink = 0.6 + 0.4 * credibility;
  const adjusted = components.map((component) => ({
    ...component,
    score: SELF_REPORTED.has(component.id)
      ? clamp01(0.5 + (component.score - 0.5) * shrink)
      : component.score,
  }));

  const deterministic = adjusted.reduce((sum, component) => sum + component.score * component.weight, 0);
  const blended = judgement.available
    ? deterministic * (1 - JEV_WEIGHT) + judgementScore(judgement) * JEV_WEIGHT
    : deterministic;
  const score = Math.round(clamp01(blended) * 100);

  const strengths = adjusted.filter((component) => component.score >= 0.72)
    .sort((x, y) => y.score - x.score).map((component) => component.detail);
  const frictions = adjusted.filter((component) => component.score < 0.45)
    .sort((x, y) => x.score - y.score).map((component) => component.detail);

  const openQuestions: string[] = [];
  if (signals.commitment.hoursGap >= 20) {
    openQuestions.push('Whose hours set the pace, and what happens to equity if that gap persists past month six?');
  }
  if (signals.risk.equityGap > 0.35) {
    openQuestions.push('Write down the equity split and the vesting schedule before either of you does more work.');
  }
  if (a.lookingFor === 'join_idea' && b.lookingFor === 'join_idea') {
    openQuestions.push('You are both looking to join someone else\'s idea. Who is bringing the thesis?');
  }
  if (a.lookingFor === 'has_idea' && b.lookingFor === 'has_idea') {
    openQuestions.push('You each arrived with your own idea. Decide which one you are testing first.');
  }
  if (signals.complementarity.gaps.length >= 5) {
    openQuestions.push(`Neither of you covers ${domainList(signals.complementarity.gaps.slice(0, 3))}. Who is the third hire?`);
  }
  if (!judgement.available) {
    openQuestions.push('The qualitative review could not run this time. Re-run the match later for the full picture.');
  }

  const hasRecordBacking = credibility >= 0.7;
  const confidence = judgement.available && hasRecordBacking
    ? 'high'
    : !judgement.available || credibility < 0.4 ? 'low' : 'medium';

  return { score, band: bandFor(score), confidence, components: adjusted, strengths, frictions, openQuestions };
}

// ── Discovery ranking ───────────────────────────────────────────────────────

export interface Candidate { uid: string; traits: FounderTraits }

/**
 * Ranks candidates for one founder by fusing two independent orderings — the
 * structural signals and the lexical one — with Reciprocal Rank Fusion, the
 * merge Laya uses to combine vector and BM25 retrieval.
 *
 * RRF is used instead of averaging the two scores because they are not on a
 * comparable scale: structural fit clusters tightly around 0.5 while lexical
 * cosine is sparse and spiky. Averaging lets one lucky rare-term overlap
 * outrank a genuinely complementary pair; fusing ranks cannot.
 */
export function rankCandidates(
  viewer: FounderTraits,
  candidates: Candidate[],
  k = 60,
): Array<{ uid: string; fused: number; structural: number; lexical: number }> {
  if (!candidates.length) return [];
  const idf = buildIdf([viewer.terms, ...candidates.map((candidate) => candidate.traits.terms)]);

  const scored = candidates.map((candidate) => {
    const signals = computeSignals(viewer, candidate.traits, idf);
    const structural =
      (signals.complementarity.score * WEIGHTS.complementarity
        + signals.sharedDomain.score * WEIGHTS.sharedDomain
        + signals.commitment.score * WEIGHTS.commitment
        + signals.workingStyle.score * WEIGHTS.workingStyle
        + signals.risk.score * WEIGHTS.risk
        + signals.personality.score * WEIGHTS.personality)
      / (1 - WEIGHTS.lexical);
    return { uid: candidate.uid, structural, lexical: signals.lexical };
  });

  const rankIndex = (key: 'structural' | 'lexical') => {
    const order = [...scored].sort((x, y) => y[key] - x[key]);
    return new Map(order.map((entry, index) => [entry.uid, index + 1]));
  };
  const structuralRanks = rankIndex('structural');
  const lexicalRanks = rankIndex('lexical');

  return scored
    .map((entry) => ({
      ...entry,
      fused: 1 / (k + (structuralRanks.get(entry.uid) ?? candidates.length))
        + 1 / (k + (lexicalRanks.get(entry.uid) ?? candidates.length)),
    }))
    .sort((x, y) => y.fused - x.fused);
}
