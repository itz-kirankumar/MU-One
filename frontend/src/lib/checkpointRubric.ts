import {
  MAX_DECK_SLIDES,
  type DeckMeasurement,
  type ExtractedDeck,
  type RubricCriterion,
  type CheckpointBand,
} from '@/types/checkpoint';

/** Weights sum to 100 so the score the student sees is plain weighted arithmetic. */
export const DEFAULT_RUBRIC: RubricCriterion[] = [
  {
    id: 'problem_fit',
    label: 'Problem framing & fit to the brief',
    weight: 15,
    whatJudgesLookFor:
      'The deck restates the given problem accurately, scopes it, and answers the question that was actually asked rather than an adjacent one.',
  },
  {
    id: 'insight',
    label: 'Insight & root-cause depth',
    weight: 10,
    whatJudgesLookFor:
      'A non-obvious driver of the problem is identified and defended, not just symptoms restated from the brief.',
  },
  {
    id: 'solution',
    label: 'Solution specificity & differentiation',
    weight: 15,
    whatJudgesLookFor:
      'A concrete recommendation a reader could act on, with a stated reason it beats the obvious alternative and the do-nothing case.',
  },
  {
    id: 'evidence',
    label: 'Evidence & data rigour',
    weight: 15,
    whatJudgesLookFor:
      'Claims carry numbers with named sources and dates. Estimates are labelled as estimates and their derivation is shown.',
  },
  {
    id: 'economics',
    label: 'Sizing & unit economics',
    weight: 10,
    whatJudgesLookFor:
      'Market size built bottom-up, plus per-unit revenue, cost and contribution. Arithmetic that a judge can reproduce.',
  },
  {
    id: 'feasibility',
    label: 'Feasibility & execution plan',
    weight: 10,
    whatJudgesLookFor:
      'Sequenced actions with owners, timeline and required resources; the first 90 days are distinguishable from year three.',
  },
  {
    id: 'risk',
    label: 'Risks & mitigation',
    weight: 10,
    whatJudgesLookFor:
      'The two or three risks that could actually kill the recommendation, each with a specific mitigation and a trigger to watch.',
  },
  {
    id: 'narrative',
    label: 'Narrative & structure',
    weight: 10,
    whatJudgesLookFor:
      'A single spine from problem to recommendation, action-titled slides, and no slide that could be removed without loss.',
  },
  {
    id: 'craft',
    label: 'Slide craft & compliance',
    weight: 5,
    whatJudgesLookFor:
      'Within the slide limit, readable type, one message per slide, exhibits labelled and sourced.',
  },
];

export const RUBRIC_TOTAL = DEFAULT_RUBRIC.reduce((sum, criterion) => sum + criterion.weight, 0);

export function bandFor(percentage: number): CheckpointBand {
  if (percentage >= 80) return 'Strong';
  if (percentage >= 60) return 'Competitive';
  if (percentage >= 40) return 'Needs work';
  return 'Not ready';
}

const words = (value: string) => value.split(/\s+/).filter(Boolean);
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

const CITATION_PATTERN = /(https?:\/\/|www\.|\bsource[s]?\s*[:\-]|\bper\s+[A-Z]|\bas\s+of\s+\d{4}|\[\d+\]|\bibef\b|\bstatista\b|\bmckinsey\b|\bbcg\b|\bdeloitte\b|\bnielsen\b|\breport\b|\bsurvey\b)/i;
const ECONOMICS_PATTERN = /(\b(cac|ltv|arpu|aov|ebitda|capex|opex|irr|npv|roi|gmv|mrr|arr|tam|sam|som)\b|gross margin|contribution margin|unit econom|payback|break[\s-]?even|burn rate|cost per|price per|revenue per|₹|\$|€|£|\bcrore\b|\blakh\b|\bbn\b|\bmn\b)/i;
const ASK_PATTERN = /(next step|recommendation|we recommend|ask\b|roadmap|timeline|call to action|implementation|way forward|conclusion|decision)/i;
const RISK_PATTERN = /(risk|mitigat|downside|sensitivit|assumption|worst case|what could go wrong|contingen)/i;

const TOPIC_STOPWORDS = new Set([
  'about', 'above', 'after', 'again', 'their', 'there', 'these', 'those', 'which', 'while', 'would',
  'could', 'should', 'being', 'been', 'have', 'has', 'had', 'does', 'did', 'doing', 'with', 'from',
  'that', 'this', 'they', 'them', 'then', 'than', 'your', 'ours', 'into', 'onto', 'over', 'under',
  'very', 'also', 'more', 'most', 'some', 'such', 'only', 'other', 'because', 'between', 'through',
  'during', 'before', 'both', 'each', 'many', 'much', 'must', 'need', 'needs', 'will', 'shall',
  'problem', 'statement', 'case', 'study', 'company', 'business', 'students', 'student', 'team',
  'please', 'given', 'provide', 'using', 'based', 'slide', 'slides', 'deck', 'presentation',
]);

/** Content words of the brief, used to measure coverage rather than guess at it. */
export function topicKeywords(problemStatement: string, max = 40): string[] {
  const counts = new Map<string, number>();
  for (const raw of problemStatement.toLowerCase().match(/[a-z][a-z'-]{3,}/g) ?? []) {
    const word = raw.replace(/['-]+$/, '');
    if (word.length < 4 || TOPIC_STOPWORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([word]) => word);
}

/**
 * Deterministic facts about the deck. These are computed, not judged, so the
 * student can verify every one by hand — and the model is told to treat them
 * as given rather than re-deriving them.
 */
export function measureDeck(deck: ExtractedDeck, slideLimit: number, problemStatement: string): DeckMeasurement[] {
  const slides = deck.slides;
  const bodyText = slides.map((slide) => `${slide.title}\n${slide.text}`);
  const allText = bodyText.join('\n');
  const perSlideWords = bodyText.map((text) => words(text).length);
  const totalWords = perSlideWords.reduce((sum, count) => sum + count, 0);
  const measurements: DeckMeasurement[] = [];

  const overLimit = slideLimit > 0 && slides.length > slideLimit;
  measurements.push({
    id: 'slide_count',
    label: 'Slide count vs limit',
    value: slideLimit > 0 ? `${slides.length} of ${slideLimit}` : `${slides.length}`,
    status: overLimit ? 'fail' : slideLimit > 0 ? 'ok' : 'na',
    detail: overLimit
      ? `Over the stated limit by ${slides.length - slideLimit}. Many competitions disqualify or stop reading at the limit.`
      : slideLimit > 0
        ? 'Within the limit you entered.'
        : 'No slide limit was provided, so compliance was not checked.',
  });

  const busiest = perSlideWords.filter((count) => count > 60).length;
  measurements.push({
    id: 'text_density',
    label: 'Words per slide',
    value: `median ${median(perSlideWords)} · max ${Math.max(0, ...perSlideWords)}`,
    status: busiest >= 3 ? 'fail' : busiest >= 1 || median(perSlideWords) > 40 ? 'warn' : 'ok',
    detail: busiest
      ? `${busiest} slide${busiest === 1 ? '' : 's'} exceed 60 words. Dense slides get skimmed, so the message is lost.`
      : 'Slide text stays inside a readable range.',
  });

  const fontSizes = slides.map((slide) => slide.minFontPt).filter((size): size is number => typeof size === 'number' && size > 0);
  const smallest = fontSizes.length ? Math.min(...fontSizes) : null;
  measurements.push({
    id: 'font_size',
    label: 'Smallest text size',
    value: smallest === null ? 'not detectable' : `${Math.round(smallest)} pt`,
    status: smallest === null ? 'na' : smallest < 10 ? 'fail' : smallest < 12 ? 'warn' : 'ok',
    detail:
      smallest === null
        ? 'This file format did not expose run-level font sizes.'
        : smallest < 12
          ? 'Text below 12 pt is unreadable from the back of a room and on a judge’s laptop thumbnail.'
          : 'All detected text is at a readable size.',
  });

  const quantified = bodyText.filter((text) => /\d/.test(text)).length;
  const quantifiedShare = slides.length ? Math.round((quantified / slides.length) * 100) : 0;
  measurements.push({
    id: 'quantification',
    label: 'Slides containing a number',
    value: `${quantified} of ${slides.length} (${quantifiedShare}%)`,
    status: quantifiedShare < 40 ? 'fail' : quantifiedShare < 60 ? 'warn' : 'ok',
    detail:
      quantifiedShare < 60
        ? 'Qualitative-only slides read as opinion. Judges mark down claims with no magnitude attached.'
        : 'Most slides carry a number, so claims can be checked.',
  });

  const cited = bodyText.filter((text) => CITATION_PATTERN.test(text)).length;
  measurements.push({
    id: 'citations',
    label: 'Slides citing a source',
    value: `${cited} of ${slides.length}`,
    status: cited === 0 ? 'fail' : cited < 2 ? 'warn' : 'ok',
    detail:
      cited === 0
        ? 'No source markers (URL, "Source:", named publisher, year) were found anywhere in the deck.'
        : 'Source markers were detected; check that each number traces to one.',
  });

  measurements.push({
    id: 'economics',
    label: 'Unit economics language',
    value: ECONOMICS_PATTERN.test(allText) ? 'present' : 'absent',
    status: ECONOMICS_PATTERN.test(allText) ? 'ok' : 'fail',
    detail: ECONOMICS_PATTERN.test(allText)
      ? 'Cost, price, margin or sizing terms appear in the deck.'
      : 'No currency, margin, CAC/LTV or TAM/SAM/SOM terms found. Financial viability appears unaddressed.',
  });

  measurements.push({
    id: 'risk',
    label: 'Risk discussion',
    value: RISK_PATTERN.test(allText) ? 'present' : 'absent',
    status: RISK_PATTERN.test(allText) ? 'ok' : 'warn',
    detail: RISK_PATTERN.test(allText)
      ? 'Risk or assumption language appears in the deck.'
      : 'No risk, assumption or sensitivity language found. Judges read this as overconfidence.',
  });

  const closing = bodyText.slice(-2).join('\n');
  measurements.push({
    id: 'closing_ask',
    label: 'Closing recommendation',
    value: ASK_PATTERN.test(closing) ? 'present' : 'absent',
    status: ASK_PATTERN.test(closing) ? 'ok' : 'warn',
    detail: ASK_PATTERN.test(closing)
      ? 'The final slides state a recommendation or next step.'
      : 'The last two slides contain no recommendation, next step or ask. Decks that trail off lose the decision.',
  });

  const withNotes = slides.filter((slide) => slide.notes.trim().length > 40).length;
  measurements.push({
    id: 'speaker_notes',
    label: 'Speaker notes coverage',
    value: deck.format === 'pdf' ? 'not available in PDF' : `${withNotes} of ${slides.length}`,
    status: deck.format === 'pdf' ? 'na' : withNotes === 0 ? 'warn' : 'ok',
    detail:
      deck.format === 'pdf'
        ? 'Export to PDF drops speaker notes, so this was not checked. Upload the .pptx to include it.'
        : withNotes === 0
          ? 'No slide carries speaker notes. The spoken argument is not captured anywhere.'
          : 'Speaker notes are present on part of the deck.',
  });

  const keywords = topicKeywords(problemStatement);
  const lowerAll = allText.toLowerCase();
  const covered = keywords.filter((word) => lowerAll.includes(word));
  measurements.push({
    id: 'brief_coverage',
    label: 'Brief keyword coverage',
    value: keywords.length ? `${covered.length} of ${keywords.length} key terms` : 'no key terms extracted',
    status: !keywords.length
      ? 'na'
      : covered.length / keywords.length < 0.4
        ? 'fail'
        : covered.length / keywords.length < 0.65
          ? 'warn'
          : 'ok',
    detail: keywords.length
      ? `Terms from your problem statement missing from the deck: ${
          keywords.filter((word) => !lowerAll.includes(word)).slice(0, 12).join(', ') || 'none'
        }. A literal word gap is a hint, not proof — the idea may be phrased differently.`
      : 'The problem statement was too short to extract key terms from.',
  });

  if (deck.emptySlides.length) {
    measurements.push({
      id: 'unreadable_slides',
      label: 'Slides with no readable text',
      value: `${deck.emptySlides.length} (${deck.emptySlides.slice(0, 8).join(', ')}${deck.emptySlides.length > 8 ? '…' : ''})`,
      status: deck.emptySlides.length > slides.length / 3 ? 'fail' : 'warn',
      detail:
        'These slides are images or charts with no selectable text. Nothing on them could be graded, and screen readers and plagiarism checks cannot read them either.',
    });
  }

  measurements.push({
    id: 'word_total',
    label: 'Total words read',
    value: `${totalWords}`,
    status: 'na',
    detail: `Extracted from ${slides.length} ${deck.format === 'pdf' ? 'page' : 'slide'}${slides.length === 1 ? '' : 's'}${
      deck.truncated ? ` (capped at ${MAX_DECK_SLIDES} slides)` : ''
    }.`,
  });

  return measurements;
}

export function deckWordCount(deck: ExtractedDeck): number {
  return deck.slides.reduce((sum, slide) => sum + words(`${slide.title} ${slide.text}`).length, 0);
}
