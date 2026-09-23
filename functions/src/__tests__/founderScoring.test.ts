import {
  bandFor, buildIdf, commitmentFit, complementarity, judgementScore,
  lexicalSimilarity, personalityFit, rankCandidates, riskFit, scorePair, sharedDomain, workingStyleFit,
} from '../founder/scoring';
import { SKILL_DOMAINS, WORKING_STYLE_AXES } from '../founder/taxonomy';
import type { SkillDomain } from '../founder/taxonomy';
import type { FounderTraits, MatchJudgement, SopValidation } from '../founder/model';

const skills = (overrides: Partial<Record<SkillDomain, number>> = {}): Record<SkillDomain, number> =>
  Object.fromEntries(SKILL_DOMAINS.map((domain) => [domain, overrides[domain] ?? 0])) as Record<SkillDomain, number>;

const style = (value = 0.5) =>
  Object.fromEntries(WORKING_STYLE_AXES.map((axis) => [axis.id, value])) as FounderTraits['workingStyle'];

const traits = (overrides: Partial<FounderTraits> = {}): FounderTraits => ({
  bigFive: {
    openness: 0.6, conscientiousness: 0.6, extraversion: 0.5, agreeableness: 0.6, emotionalStability: 0.6,
  },
  workingStyle: style(),
  skills: skills(),
  archetype: 'builder',
  interests: ['fintech'],
  commitment: { hoursPerWeek: 30, runwayMonths: 9, fullTimeDistance: 0.25, relocation: 0.5 },
  risk: { equityStance: 0.5, salaryNeed: 0.33, failureTolerance: 0.6 },
  lookingFor: 'find_idea',
  terms: ['payments', 'ledger', 'upi'],
  ...overrides,
});

const judgement = (overrides: Partial<MatchJudgement> = {}): MatchJudgement => ({
  visionAlignment: 0.8,
  communicationFit: 0.8,
  executionCredibility: 0.8,
  conflictRisk: 0.2,
  recommendation: 'strong_match',
  model: 'jev-test',
  available: true,
  ...overrides,
});

const sop = (credibility: number): SopValidation => ({
  credibility,
  specificity: credibility,
  evidenceBacked: credibility,
  consistency: credibility,
  verdict: 'authentic',
  notes: [],
  model: 'jev-test',
  validatedAt: '2026-09-01T00:00:00.000Z',
  aiAvailable: true,
});

describe('complementarity', () => {
  test('rewards a split of domains over the same two strengths', () => {
    const split = complementarity(
      skills({ engineering: 0.9, data_ai: 0.85, product: 0.6 }),
      skills({ sales_bd: 0.9, growth_marketing: 0.85, finance: 0.6 }),
    );
    const identical = complementarity(
      skills({ engineering: 0.9, data_ai: 0.85, product: 0.6 }),
      skills({ engineering: 0.9, data_ai: 0.85, product: 0.6 }),
    );
    expect(split.score).toBeGreaterThan(identical.score);
    expect(split.overlapping).toHaveLength(0);
    expect(identical.overlapping).toContain('engineering');
  });

  test('two people who cover nothing score near zero and surface the gaps', () => {
    const empty = complementarity(skills(), skills());
    expect(empty.score).toBeLessThan(0.2);
    expect(empty.gaps.length).toBeGreaterThanOrEqual(5);
  });
});

describe('sharedDomain', () => {
  test('identical interests beat partial overlap, which beats none', () => {
    const same = sharedDomain(['fintech', 'saas_b2b'], ['fintech', 'saas_b2b']).score;
    const partial = sharedDomain(['fintech', 'saas_b2b'], ['fintech', 'climate']).score;
    const none = sharedDomain(['fintech'], ['climate']).score;
    expect(same).toBeGreaterThan(partial);
    expect(partial).toBeGreaterThan(none);
  });

  test('an empty list is neutral rather than a penalty', () => {
    expect(sharedDomain([], ['fintech'])).toEqual({ score: 0.3, shared: [] });
  });
});

describe('workingStyleFit', () => {
  const axisScore = (result: ReturnType<typeof workingStyleFit>, id: string) =>
    result.axes.find((axis) => axis.id === id)!.score;

  test('similar axes reward sameness and complement axes reward difference', () => {
    const similarAxis = WORKING_STYLE_AXES.find((axis) => axis.mode === 'similar')!.id;
    const complementAxis = WORKING_STYLE_AXES.find((axis) => axis.mode === 'complement')!.id;

    expect(axisScore(workingStyleFit(style(0.9), style(0.9)), similarAxis)).toBeGreaterThan(0.9);

    const apart = workingStyleFit({ ...style(0.5), [complementAxis]: 0.1 }, { ...style(0.5), [complementAxis]: 0.7 });
    const together = workingStyleFit({ ...style(0.5), [complementAxis]: 0.5 }, { ...style(0.5), [complementAxis]: 0.5 });
    expect(axisScore(apart, complementAxis)).toBeGreaterThan(axisScore(together, complementAxis));
  });

  test('a wide gap on a similarity axis is reported as a clash', () => {
    const similarAxis = WORKING_STYLE_AXES.find((axis) => axis.mode === 'similar')!.id;
    const result = workingStyleFit({ ...style(0.5), [similarAxis]: 0 }, { ...style(0.5), [similarAxis]: 1 });
    expect(result.clashes.map((clash) => clash.id)).toContain(similarAxis);
    // A complement axis at the same distance is not a clash; it is the point.
    const complementAxis = WORKING_STYLE_AXES.find((axis) => axis.mode === 'complement')!.id;
    expect(result.clashes.map((clash) => clash.id)).not.toContain(complementAxis);
  });
});

describe('commitmentFit', () => {
  const base = { hoursPerWeek: 42, runwayMonths: 9, fullTimeDistance: 0, relocation: 1 };

  test('an hours gap is penalised hard', () => {
    const matched = commitmentFit(base, base).score;
    const mismatched = commitmentFit(base, { ...base, hoursPerWeek: 5 }).score;
    expect(matched).toBeGreaterThan(0.8);
    expect(mismatched).toBeLessThan(0.55);
    expect(commitmentFit(base, { ...base, hoursPerWeek: 5 }).hoursGap).toBe(37);
  });

  test('runway is judged by the shorter of the two, not the average', () => {
    const lopsided = commitmentFit({ ...base, runwayMonths: 24 }, { ...base, runwayMonths: 0 });
    const even = commitmentFit({ ...base, runwayMonths: 12 }, { ...base, runwayMonths: 12 });
    expect(lopsided.runwayFloor).toBe(0);
    expect(lopsided.score).toBeLessThan(even.score);
  });

  test('two people who can only give a few hours score low even when they agree', () => {
    const agreed = commitmentFit({ ...base, hoursPerWeek: 5 }, { ...base, hoursPerWeek: 5 });
    expect(agreed.hoursGap).toBe(0);
    expect(agreed.score).toBeLessThan(commitmentFit(base, base).score);
  });
});

describe('riskFit and personalityFit', () => {
  test('a wide equity gap is reported and lowers the score', () => {
    const near = riskFit(
      { equityStance: 0.5, salaryNeed: 0.3, failureTolerance: 0.6 },
      { equityStance: 0.55, salaryNeed: 0.3, failureTolerance: 0.6 },
    );
    const far = riskFit(
      { equityStance: 0, salaryNeed: 0.3, failureTolerance: 0.6 },
      { equityStance: 0.9, salaryNeed: 0.3, failureTolerance: 0.6 },
    );
    expect(far.equityGap).toBeCloseTo(0.9);
    expect(far.score).toBeLessThan(near.score);
  });

  test('one conscientious founder cannot carry an unconscientious one', () => {
    const balanced = personalityFit(
      { openness: 0.6, conscientiousness: 0.8, extraversion: 0.5, agreeableness: 0.6, emotionalStability: 0.7 },
      { openness: 0.6, conscientiousness: 0.8, extraversion: 0.5, agreeableness: 0.6, emotionalStability: 0.7 },
    );
    const lopsided = personalityFit(
      { openness: 0.6, conscientiousness: 1, extraversion: 0.5, agreeableness: 0.6, emotionalStability: 0.7 },
      { openness: 0.6, conscientiousness: 0.1, extraversion: 0.5, agreeableness: 0.6, emotionalStability: 0.7 },
    );
    expect(lopsided.score).toBeLessThan(balanced.score);
  });

  test('two people who both come apart under pressure score worse than one who does', () => {
    const one = personalityFit(
      { openness: 0.6, conscientiousness: 0.7, extraversion: 0.5, agreeableness: 0.6, emotionalStability: 0.9 },
      { openness: 0.6, conscientiousness: 0.7, extraversion: 0.5, agreeableness: 0.6, emotionalStability: 0.1 },
    );
    const both = personalityFit(
      { openness: 0.6, conscientiousness: 0.7, extraversion: 0.5, agreeableness: 0.6, emotionalStability: 0.1 },
      { openness: 0.6, conscientiousness: 0.7, extraversion: 0.5, agreeableness: 0.6, emotionalStability: 0.1 },
    );
    expect(both.score).toBeLessThan(one.score);
  });
});

describe('lexical', () => {
  test('rare shared terms count for more than common ones', () => {
    const idf = buildIdf([
      ['payments', 'india'], ['lending', 'india'], ['india', 'health'], ['india', 'climate'],
    ]);
    const rare = lexicalSimilarity(['payments', 'india'], ['payments', 'india'], idf);
    const common = lexicalSimilarity(['health', 'india'], ['climate', 'india'], idf);
    expect(rare).toBeGreaterThan(common);
  });

  test('disjoint vocabularies score zero', () => {
    expect(lexicalSimilarity(['a'], ['b'])).toBe(0);
    expect(lexicalSimilarity([], ['b'])).toBe(0);
  });
});

describe('scorePair', () => {
  const complementary = {
    a: traits({ skills: skills({ engineering: 0.9, data_ai: 0.8, product: 0.7 }) }),
    b: traits({ skills: skills({ sales_bd: 0.9, growth_marketing: 0.8, finance: 0.7 }), archetype: 'hustler' }),
  };

  test('weights sum to one, so a perfect pair can reach 100', () => {
    const { components } = scorePair({ ...complementary, sopA: sop(1), sopB: sop(1), judgement: judgement() });
    expect(components.reduce((sum, component) => sum + component.weight, 0)).toBeCloseTo(1);
  });

  test('a weak statement of purpose pulls self-reported components toward neutral', () => {
    const credible = scorePair({ ...complementary, sopA: sop(1), sopB: sop(1), judgement: judgement() });
    const doubtful = scorePair({ ...complementary, sopA: sop(1), sopB: sop(0), judgement: judgement() });
    expect(doubtful.score).toBeLessThan(credible.score);

    const shrunk = doubtful.components.find((component) => component.id === 'complementarity')!;
    const full = credible.components.find((component) => component.id === 'complementarity')!;
    expect(Math.abs(shrunk.score - 0.5)).toBeLessThan(Math.abs(full.score - 0.5));
    expect(doubtful.confidence).toBe('low');
  });

  test('a component the student did not self-report is left alone', () => {
    const credible = scorePair({ ...complementary, sopA: sop(1), sopB: sop(1), judgement: judgement() });
    const doubtful = scorePair({ ...complementary, sopA: sop(0), sopB: sop(0), judgement: judgement() });
    const id = 'commitment';
    expect(doubtful.components.find((c) => c.id === id)!.score)
      .toBeCloseTo(credible.components.find((c) => c.id === id)!.score);
  });

  test('an unavailable judgement lowers confidence and says so, without inventing a number', () => {
    const withJev = scorePair({ ...complementary, sopA: sop(1), sopB: sop(1), judgement: judgement() });
    const without = scorePair({
      ...complementary,
      sopA: sop(1),
      sopB: sop(1),
      judgement: judgement({ available: false, visionAlignment: 0, communicationFit: 0, executionCredibility: 0, conflictRisk: 0 }),
    });
    expect(without.confidence).toBe('low');
    expect(without.openQuestions.join(' ')).toMatch(/qualitative review could not run/i);
    // The deterministic half stands alone rather than being blended with zeros.
    expect(without.score).toBeGreaterThan(0);
    expect(without.score).not.toBe(withJev.score);
  });

  test('raises the questions a pair actually has to settle', () => {
    const result = scorePair({
      a: traits({ commitment: { hoursPerWeek: 45, runwayMonths: 12, fullTimeDistance: 0, relocation: 1 }, risk: { equityStance: 0, salaryNeed: 0, failureTolerance: 0.7 }, lookingFor: 'has_idea' }),
      b: traits({ commitment: { hoursPerWeek: 10, runwayMonths: 2, fullTimeDistance: 1, relocation: 0 }, risk: { equityStance: 0.9, salaryNeed: 1, failureTolerance: 0.2 }, lookingFor: 'has_idea' }),
      sopA: sop(0.8),
      sopB: sop(0.8),
      judgement: judgement(),
    });
    const text = result.openQuestions.join(' ');
    expect(text).toMatch(/hours set the pace/i);
    expect(text).toMatch(/equity split/i);
    expect(text).toMatch(/own idea/i);
    expect(result.frictions.length).toBeGreaterThan(0);
  });

  test('bands are ordered and cover the whole range', () => {
    expect([bandFor(100), bandFor(70), bandFor(50), bandFor(10)])
      .toEqual(['strong', 'promising', 'exploratory', 'weak']);
  });

  test('high conflict risk drags the judgement contribution down', () => {
    expect(judgementScore(judgement({ conflictRisk: 1 })))
      .toBeLessThan(judgementScore(judgement({ conflictRisk: 0 })));
  });
});

describe('rankCandidates', () => {
  test('fuses the two orderings rather than letting one lexical spike win', () => {
    const viewer = traits({
      skills: skills({ engineering: 0.9, data_ai: 0.8 }),
      terms: ['payments', 'ledger', 'upi', 'settlement'],
    });
    const candidates = [
      // Structurally the right co-founder: covers what the viewer does not.
      { uid: 'complement', traits: traits({ skills: skills({ sales_bd: 0.9, growth_marketing: 0.85, finance: 0.7 }), terms: ['distribution', 'retail'] }) },
      // Same words, same skills — nothing to add.
      { uid: 'echo', traits: traits({ skills: skills({ engineering: 0.9, data_ai: 0.8 }), terms: ['payments', 'ledger', 'upi', 'settlement'] }) },
      { uid: 'unrelated', traits: traits({ skills: skills({ design: 0.2 }), terms: ['poetry'] }) },
    ];

    const ranked = rankCandidates(viewer, candidates);
    expect(ranked).toHaveLength(3);
    expect(ranked[ranked.length - 1].uid).toBe('unrelated');
    // The complementary candidate leads on structure; the echo leads on words.
    const byUid = new Map(ranked.map((entry) => [entry.uid, entry]));
    expect(byUid.get('complement')!.structural).toBeGreaterThan(byUid.get('echo')!.structural);
    expect(byUid.get('echo')!.lexical).toBeGreaterThan(byUid.get('complement')!.lexical);
    // Fusion is by rank, so neither ordering can run away with the result.
    expect(ranked.map((entry) => entry.fused)).toEqual([...ranked.map((e) => e.fused)].sort((x, y) => y - x));
  });

  test('an empty pool ranks to an empty list', () => {
    expect(rankCandidates(traits(), [])).toEqual([]);
  });
});
