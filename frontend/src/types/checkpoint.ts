/** Shared contract between the browser extractor, the grading route and the UI. */

export type CheckpointVerdict = 'present' | 'partial' | 'missing';
export type FlawSeverity = 'fatal' | 'major' | 'minor';
export type MeasurementStatus = 'ok' | 'warn' | 'fail' | 'na';
export type CheckpointBand = 'Not ready' | 'Needs work' | 'Competitive' | 'Strong';
export type DeckFormat = 'pptx' | 'pdf';

export const MAX_DECK_SLIDES = 60;
export const MAX_SLIDE_CHARS = 6_000;
export const MAX_DECK_CHARS = 150_000;
export const MAX_DECK_FILE_BYTES = 25_000_000;
export const MAX_PROBLEM_CHARS = 8_000;
export const MIN_PROBLEM_CHARS = 30;
export const MAX_RUBRIC_CHARS = 4_000;

/** One slide (PPTX) or page (PDF) reduced to the text a judge would actually read. */
export interface ExtractedSlide {
  index: number;
  title: string;
  text: string;
  notes: string;
  /** Smallest run size in points; null when the format did not expose it. */
  minFontPt: number | null;
  /** Pictures on the slide; null when the format did not expose it. */
  imageCount: number | null;
}

export interface ExtractedDeck {
  fileName: string;
  format: DeckFormat;
  slides: ExtractedSlide[];
  /** Slides whose text could not be read at all (scanned or image-only). */
  emptySlides: number[];
  /** Set when the deck is overwhelmingly image-only, so judged findings are unreliable. */
  textPoor: boolean;
  truncated: boolean;
}

export interface RubricCriterion {
  id: string;
  label: string;
  weight: number;
  whatJudgesLookFor: string;
}

/** A measured fact: computed by code from the deck, never asserted by the model. */
export interface DeckMeasurement {
  id: string;
  label: string;
  value: string;
  status: MeasurementStatus;
  detail: string;
}

export interface CheckpointScore {
  criterionId: string;
  label: string;
  weight: number;
  awarded: number;
  verdict: CheckpointVerdict;
  /** Quoted from the deck so the student can see what the score was based on. */
  evidence: string;
  slideRefs: number[];
  reasoning: string;
  fix: string;
}

export interface DeckFlaw {
  id: string;
  severity: FlawSeverity;
  title: string;
  slideRefs: number[];
  whatIsWrong: string;
  whyJudgesPenalise: string;
  fix: string;
}

export interface CheckpointResult {
  totalAwarded: number;
  totalPossible: number;
  percentage: number;
  band: CheckpointBand;
  verdictSummary: string;
  scores: CheckpointScore[];
  flaws: DeckFlaw[];
  measurements: DeckMeasurement[];
  judgeQuestions: string[];
  alignment: { covered: string[]; missed: string[]; note: string };
  deckSummary: { fileName: string; format: DeckFormat; slideCount: number; wordCount: number };
  gradedAt: string;
  model: string;
  /** Warnings the student must weigh before trusting the grade. */
  caveats: string[];
}

export interface CheckpointRequest {
  problemStatement: string;
  rubricNotes: string;
  slideLimit: number;
  deck: ExtractedDeck;
}
