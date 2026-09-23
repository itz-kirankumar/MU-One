/**
 * Canonical vocabularies and the onboarding questionnaire.
 *
 * Everything a founder tells us is reduced onto these fixed axes before it is
 * scored. Free text never reaches the scoring maths — two students who write
 * "I build backends" and "distributed systems engineer" must land on the same
 * skill domain or the complementarity score is noise.
 */

/** The ten domains a founding team has to cover between them. */
export const SKILL_DOMAINS = [
  'engineering',
  'product',
  'design',
  'data_ai',
  'growth_marketing',
  'sales_bd',
  'finance',
  'operations',
  'legal_regulatory',
  'domain_research',
] as const;

export type SkillDomain = (typeof SKILL_DOMAINS)[number];

export const SKILL_DOMAIN_LABELS: Record<SkillDomain, string> = {
  engineering: 'Engineering',
  product: 'Product',
  design: 'Design',
  data_ai: 'Data & AI',
  growth_marketing: 'Growth & Marketing',
  sales_bd: 'Sales & BD',
  finance: 'Finance',
  operations: 'Operations',
  legal_regulatory: 'Legal & Regulatory',
  domain_research: 'Domain research',
};

/**
 * Keyword index used to map a LinkedIn headline, job title or skill string onto
 * a domain. Longest match wins, so "product designer" resolves to design rather
 * than product.
 */
export const SKILL_KEYWORDS: Record<SkillDomain, string[]> = {
  engineering: ['software engineer', 'backend', 'front end', 'frontend', 'full stack', 'fullstack', 'developer',
    'devops', 'sre', 'android', 'ios', 'mobile engineer', 'platform engineer', 'infrastructure', 'embedded',
    'java', 'python', 'golang', 'rust', 'react', 'node', 'kubernetes', 'aws', 'programming'],
  product: ['product manager', 'product management', 'associate product', 'apm', 'product owner', 'roadmap',
    'user research', 'product strategy', 'requirements', 'jira', 'scrum'],
  design: ['product designer', 'ux', 'ui designer', 'user experience', 'user interface', 'visual design',
    'graphic design', 'figma', 'branding', 'design system', 'illustrator', 'interaction design'],
  data_ai: ['data scientist', 'data science', 'machine learning', 'deep learning', 'artificial intelligence',
    'nlp', 'computer vision', 'data analyst', 'analytics', 'statistics', 'tensorflow', 'pytorch', 'llm',
    'data engineer', 'sql', 'tableau', 'power bi'],
  growth_marketing: ['growth', 'marketing', 'performance marketing', 'seo', 'sem', 'content marketing',
    'social media', 'brand manager', 'campaign', 'demand generation', 'crm', 'community manager', 'copywriting'],
  sales_bd: ['sales', 'business development', 'account executive', 'partnerships', 'client servicing',
    'key account', 'inside sales', 'revenue', 'quota', 'lead generation', 'customer success'],
  finance: ['finance', 'investment banking', 'equity research', 'venture capital', 'private equity',
    'financial analyst', 'accounting', 'audit', 'valuation', 'fp&a', 'treasury', 'chartered accountant', 'cfa'],
  operations: ['operations', 'supply chain', 'logistics', 'procurement', 'manufacturing', 'process improvement',
    'six sigma', 'program manager', 'project manager', 'chief of staff', 'vendor management'],
  legal_regulatory: ['legal', 'lawyer', 'advocate', 'compliance', 'regulatory', 'contract', 'policy',
    'intellectual property', 'company secretary', 'governance'],
  domain_research: ['research', 'consultant', 'consulting', 'strategy', 'market research', 'phd', 'scientist',
    'academic', 'thesis', 'publication', 'healthcare', 'clinical', 'teaching', 'professor'],
};

/** Industries a founder can pick as an interest. Overlap here is a good sign. */
export const INTEREST_TAGS = [
  'fintech', 'healthtech', 'edtech', 'ecommerce', 'saas_b2b', 'consumer_social', 'deeptech_ai',
  'climate', 'agritech', 'logistics', 'gaming_media', 'd2c_brands', 'spacetech', 'biotech',
  'web3', 'hardware_robotics', 'proptech', 'traveltech', 'foodtech', 'hrtech',
] as const;

export type InterestTag = (typeof INTEREST_TAGS)[number];

export const INTEREST_LABELS: Record<InterestTag, string> = {
  fintech: 'Fintech', healthtech: 'Healthtech', edtech: 'Edtech', ecommerce: 'E-commerce',
  saas_b2b: 'B2B SaaS', consumer_social: 'Consumer & Social', deeptech_ai: 'Deeptech & AI',
  climate: 'Climate', agritech: 'Agritech', logistics: 'Logistics & Mobility',
  gaming_media: 'Gaming & Media', d2c_brands: 'D2C Brands', spacetech: 'Spacetech',
  biotech: 'Biotech', web3: 'Web3', hardware_robotics: 'Hardware & Robotics',
  proptech: 'Proptech', traveltech: 'Traveltech', foodtech: 'Foodtech', hrtech: 'HR Tech',
};

/** The role a founder naturally plays. Derived, never self-selected. */
export const ARCHETYPES = ['builder', 'hustler', 'designer', 'operator', 'domain_expert'] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  builder: 'Builder', hustler: 'Hustler', designer: 'Designer',
  operator: 'Operator', domain_expert: 'Domain expert',
};

/** Which domains push a profile toward each archetype. */
export const ARCHETYPE_DOMAINS: Record<Archetype, SkillDomain[]> = {
  builder: ['engineering', 'data_ai'],
  hustler: ['sales_bd', 'growth_marketing'],
  designer: ['design', 'product'],
  operator: ['operations', 'finance', 'legal_regulatory'],
  domain_expert: ['domain_research'],
};

// ── Working style ───────────────────────────────────────────────────────────

/**
 * Six axes, each 0–1. Some reward similarity in a pairing and some reward
 * difference, which is why `mode` is carried here rather than hardcoded in the
 * scorer.
 *
 * `similar`: friction if the two founders differ (they will fight about it daily).
 * `complement`: a team is stronger when one leans each way.
 */
export const WORKING_STYLE_AXES = [
  { id: 'structure', mode: 'complement', low: 'Improvises', high: 'Runs on process' },
  { id: 'pace', mode: 'similar', low: 'Deliberate', high: 'Ships fast' },
  { id: 'autonomy', mode: 'complement', low: 'Works together', high: 'Works alone' },
  { id: 'conflict', mode: 'similar', low: 'Avoids conflict', high: 'Confronts directly' },
  { id: 'communication', mode: 'similar', low: 'Async & written', high: 'Live & verbal' },
  { id: 'decision', mode: 'complement', low: 'Trusts instinct', high: 'Waits for data' },
] as const;

export type WorkingStyleAxis = (typeof WORKING_STYLE_AXES)[number]['id'];

export const BIG_FIVE_TRAITS = [
  'openness', 'conscientiousness', 'extraversion', 'agreeableness', 'emotionalStability',
] as const;
export type BigFiveTrait = (typeof BIG_FIVE_TRAITS)[number];

// ── Questionnaire ───────────────────────────────────────────────────────────

export type QuestionKind = 'likert' | 'single' | 'multi' | 'scale' | 'text';

export interface FounderQuestion {
  id: string;
  section: 'personality' | 'working_style' | 'skills' | 'interests' | 'commitment' | 'risk' | 'story';
  kind: QuestionKind;
  title: string;
  help?: string;
  /** Options for single/multi. Index is the stored value. */
  options?: string[];
  /** For likert/scale: inclusive bounds of the stored integer. */
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  /** Likert items that load negatively onto their trait. */
  reverse?: boolean;
  /** Which trait/axis/domain this item feeds. */
  target?: string;
  maxChars?: number;
  minChars?: number;
  required: boolean;
}

const likert = (
  id: string, title: string, target: BigFiveTrait, reverse: boolean,
): FounderQuestion => ({
  id, section: 'personality', kind: 'likert', title, target, reverse, required: true,
  min: 1, max: 7, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree',
});

/**
 * Personality uses the Ten-Item Personality Inventory shape: two items per
 * trait, one of them reverse-keyed, so a student cannot game a trait by
 * agreeing with everything.
 */
const PERSONALITY: FounderQuestion[] = [
  likert('p1', 'I see myself as open to new experiences and complex ideas.', 'openness', false),
  likert('p2', 'I see myself as conventional, and not very creative.', 'openness', true),
  likert('p3', 'I see myself as dependable and self-disciplined.', 'conscientiousness', false),
  likert('p4', 'I see myself as disorganised, and careless.', 'conscientiousness', true),
  likert('p5', 'I see myself as extraverted and enthusiastic.', 'extraversion', false),
  likert('p6', 'I see myself as reserved, and quiet.', 'extraversion', true),
  likert('p7', 'I see myself as sympathetic and warm.', 'agreeableness', false),
  likert('p8', 'I see myself as critical, and quarrelsome.', 'agreeableness', true),
  likert('p9', 'I see myself as calm, and emotionally stable.', 'emotionalStability', false),
  likert('p10', 'I see myself as anxious, and easily upset.', 'emotionalStability', true),
];

const WORKING_STYLE: FounderQuestion[] = WORKING_STYLE_AXES.map((axis) => ({
  id: `w_${axis.id}`,
  section: 'working_style' as const,
  kind: 'scale' as const,
  title: `Where do you sit: ${axis.low} vs ${axis.high}?`,
  target: axis.id,
  min: 0, max: 6, minLabel: axis.low, maxLabel: axis.high,
  required: true,
}));

const SKILLS: FounderQuestion[] = SKILL_DOMAINS.map((domain) => ({
  id: `s_${domain}`,
  section: 'skills' as const,
  kind: 'scale' as const,
  title: SKILL_DOMAIN_LABELS[domain],
  help: 'Rate what you could own end to end today, not what you have read about.',
  target: domain,
  min: 0, max: 4, minLabel: 'None', maxLabel: 'Could lead it',
  required: true,
}));

const REST: FounderQuestion[] = [
  {
    id: 'i_tags', section: 'interests', kind: 'multi', required: true,
    title: 'Which spaces do you actually want to build in?',
    help: 'Pick up to 5. Shared interest here matters more than shared skills.',
    options: INTEREST_TAGS.map((tag) => INTEREST_LABELS[tag]),
  },
  {
    id: 'c_hours', section: 'commitment', kind: 'single', required: true,
    title: 'Realistically, how many hours a week can you give this?',
    options: ['Under 10', '10–20', '20–35', '35–50', '50+'],
  },
  {
    id: 'c_runway', section: 'commitment', kind: 'single', required: true,
    title: 'How long could you go without a salary?',
    options: ['No runway', 'Up to 3 months', '3–6 months', '6–12 months', 'Over 12 months'],
  },
  {
    id: 'c_fulltime', section: 'commitment', kind: 'single', required: true,
    title: 'When could you go full time?',
    options: ['Already am', 'Right after graduation', 'Within a year of graduating', 'Only once it is funded', 'Unsure'],
  },
  {
    id: 'c_relocate', section: 'commitment', kind: 'single', required: true,
    title: 'Would you relocate for the right co-founder?',
    options: ['No', 'Within my city', 'Anywhere in India', 'Anywhere in the world'],
  },
  {
    id: 'r_equity', section: 'risk', kind: 'single', required: true,
    title: 'How should equity be split between co-founders?',
    options: ['Strictly equal, always', 'Roughly equal, adjusted for contribution',
      'Weighted by who joined first', 'Weighted by whose idea it is', 'Negotiated case by case'],
  },
  {
    id: 'r_salary', section: 'risk', kind: 'single', required: true,
    title: 'What do you need to be paid in year one?',
    options: ['Nothing', 'Bare living costs', 'Modest salary', 'Market salary'],
  },
  {
    id: 'r_failure', section: 'risk', kind: 'scale', required: true,
    title: 'If this fails in 18 months, how would you feel about having tried?',
    min: 0, max: 6, minLabel: 'It would set me back badly', maxLabel: 'Worth it regardless',
  },
  {
    id: 'r_stage', section: 'risk', kind: 'single', required: true,
    title: 'What are you looking for right now?',
    options: ['A co-founder for my existing idea', 'Someone to find an idea with',
      'To join someone else\'s idea', 'Still exploring'],
  },
  {
    id: 'st_sop', section: 'story', kind: 'text', required: true,
    minChars: 250, maxChars: 2500,
    title: 'Your Statement of Purpose',
    help: 'What problem pulls at you, what have you actually done about it, and what do you need a '
      + 'co-founder for? Specifics beat ambition — this is cross-checked against your LinkedIn record.',
  },
  {
    id: 'st_proud', section: 'story', kind: 'text', required: true,
    minChars: 80, maxChars: 1200,
    title: 'Describe something you built or shipped that you are proud of.',
    help: 'What was it, what was your part in it, and what happened to it?',
  },
  {
    id: 'st_looking', section: 'story', kind: 'text', required: false,
    maxChars: 600,
    title: 'What would your ideal co-founder be strong at?',
  },
];

export const FOUNDER_QUESTIONS: FounderQuestion[] = [
  ...PERSONALITY, ...WORKING_STYLE, ...SKILLS, ...REST,
];

export const QUESTIONNAIRE_VERSION = 1;

export const QUESTION_BY_ID = new Map(FOUNDER_QUESTIONS.map((q) => [q.id, q]));

export const SECTION_ORDER: FounderQuestion['section'][] = [
  'personality', 'working_style', 'skills', 'interests', 'commitment', 'risk', 'story',
];

export const SECTION_LABELS: Record<FounderQuestion['section'], string> = {
  personality: 'How you are wired',
  working_style: 'How you work',
  skills: 'What you can own',
  interests: 'Where you want to build',
  commitment: 'What you can commit',
  risk: 'How you think about risk',
  story: 'Your story',
};
