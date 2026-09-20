import { DEFAULT_RUBRIC, RUBRIC_TOTAL, bandFor, measureDeck, topicKeywords } from '../src/lib/checkpointRubric';
import { AI_UNAVAILABLE_MESSAGE, gradeSubmission } from '../src/lib/server/checkpointGrading';
import { ApiError } from '../src/lib/server/apiError';
import type { CheckpointRequest, ExtractedDeck, ExtractedSlide } from '../src/types/checkpoint';

const slide = (index: number, title: string, text: string, extra: Partial<ExtractedSlide> = {}): ExtractedSlide => ({
  index,
  title,
  text,
  notes: '',
  minFontPt: null,
  imageCount: null,
  ...extra,
});

function deckOf(slides: ExtractedSlide[], overrides: Partial<ExtractedDeck> = {}): ExtractedDeck {
  const emptySlides = slides.filter((item) => !item.title && item.text.replace(/\s/g, '').length < 12).map((item) => item.index);
  return {
    fileName: 'deck.pptx',
    format: 'pptx',
    slides,
    emptySlides,
    textPoor: emptySlides.length > slides.length / 2,
    truncated: false,
    ...overrides,
  };
}

const PROBLEM = 'Repeat purchase rate at a skincare brand fell from 34% to 19%. Recommend how to recover retention within two quarters.';

const find = <T extends { id: string }>(list: T[], id: string): T => list.find((item) => item.id === id)!;

describe('rubric', () => {
  it('weights sum to the advertised total', () => {
    expect(RUBRIC_TOTAL).toBe(100);
    expect(DEFAULT_RUBRIC.reduce((sum, c) => sum + c.weight, 0)).toBe(RUBRIC_TOTAL);
  });

  it('has no duplicate criterion ids', () => {
    expect(new Set(DEFAULT_RUBRIC.map((c) => c.id)).size).toBe(DEFAULT_RUBRIC.length);
  });

  it('maps percentages to bands at the documented thresholds', () => {
    expect(bandFor(0)).toBe('Not ready');
    expect(bandFor(39)).toBe('Not ready');
    expect(bandFor(40)).toBe('Needs work');
    expect(bandFor(59)).toBe('Needs work');
    expect(bandFor(60)).toBe('Competitive');
    expect(bandFor(79)).toBe('Competitive');
    expect(bandFor(80)).toBe('Strong');
    expect(bandFor(100)).toBe('Strong');
  });
});

describe('topicKeywords', () => {
  it('keeps content words and drops filler', () => {
    const keywords = topicKeywords(PROBLEM);
    expect(keywords).toContain('repeat');
    expect(keywords).toContain('retention');
    expect(keywords).not.toContain('from');
    // Words describing the exercise are not words describing the subject.
    expect(topicKeywords('The problem statement deck presentation slides')).toEqual([]);
  });
});

describe('measureDeck', () => {
  it('fails slide-limit compliance only when the limit is exceeded', () => {
    const deck = deckOf([slide(1, 'A', 'x'), slide(2, 'B', 'y'), slide(3, 'C', 'z')]);
    expect(find(measureDeck(deck, 2, PROBLEM), 'slide_count').status).toBe('fail');
    expect(find(measureDeck(deck, 3, PROBLEM), 'slide_count').status).toBe('ok');
    // No limit supplied means nothing to comply with, not a failure.
    expect(find(measureDeck(deck, 0, PROBLEM), 'slide_count').status).toBe('na');
  });

  it('flags a deck that carries no numbers, sources or economics', () => {
    const deck = deckOf([
      slide(1, 'Our vision', 'We believe skincare should feel effortless and joyful for everyone.'),
      slide(2, 'Our approach', 'A holistic strategy grounded in empathy and design thinking.'),
    ]);
    const measurements = measureDeck(deck, 0, PROBLEM);
    expect(find(measurements, 'quantification').status).toBe('fail');
    expect(find(measurements, 'citations').status).toBe('fail');
    expect(find(measurements, 'economics').status).toBe('fail');
    expect(find(measurements, 'closing_ask').status).toBe('warn');
    expect(find(measurements, 'risk').status).toBe('warn');
  });

  it('passes a deck that quantifies, cites, prices and closes', () => {
    const deck = deckOf([
      slide(1, 'Retention fell 34% to 19%', 'Source: internal cohort data as of 2025.'),
      slide(2, 'Root cause', 'Second-order churn concentrated in the 45-day window. Source: Statista 2024.'),
      slide(3, 'Unit economics', 'CAC ₹840, LTV ₹3,100, gross margin 62%. Risk: supply delays; mitigation is dual sourcing.'),
      slide(4, 'Recommendation', 'We recommend a 90-day replenishment programme. Next step: pilot in 2 cities.'),
    ]);
    const measurements = measureDeck(deck, 4, PROBLEM);
    for (const id of ['slide_count', 'quantification', 'citations', 'economics', 'risk', 'closing_ask']) {
      expect([id, find(measurements, id).status]).toEqual([id, 'ok']);
    }
  });

  it('reports font size only when the format exposed it', () => {
    const withFonts = deckOf([slide(1, 'A', 'text', { minFontPt: 9 })]);
    expect(find(measureDeck(withFonts, 0, PROBLEM), 'font_size').status).toBe('fail');
    expect(find(measureDeck(deckOf([slide(1, 'A', 'text')]), 0, PROBLEM), 'font_size').status).toBe('na');
  });

  it('marks speaker notes unavailable for PDF rather than failing them', () => {
    const pdf = deckOf([slide(1, 'A', 'text')], { format: 'pdf' });
    expect(find(measureDeck(pdf, 0, PROBLEM), 'speaker_notes').status).toBe('na');
    expect(find(measureDeck(deckOf([slide(1, 'A', 'text')]), 0, PROBLEM), 'speaker_notes').status).toBe('warn');
  });

  it('scores brief coverage from words the deck actually contains', () => {
    const offTopic = deckOf([slide(1, 'Blockchain logistics', 'Freight tokenisation across shipping lanes.')]);
    expect(find(measureDeck(offTopic, 0, PROBLEM), 'brief_coverage').status).toBe('fail');
  });

  it('counts slides with no readable text', () => {
    const deck = deckOf([slide(1, 'Intro', 'Retention fell sharply this year'), slide(2, '', '')]);
    expect(deck.emptySlides).toEqual([2]);
    expect(find(measureDeck(deck, 0, PROBLEM), 'unreadable_slides').value).toContain('1');
  });
});

describe('gradeSubmission', () => {
  const request: CheckpointRequest = {
    problemStatement: PROBLEM,
    rubricNotes: '',
    slideLimit: 4,
    deck: deckOf([
      slide(1, 'Retention fell 34% to 19%', 'Source: internal cohort data.'),
      slide(2, 'Recommendation', 'We recommend a replenishment programme. CAC ₹840.'),
    ]),
  };

  const fullScores = (awarded: number) =>
    DEFAULT_RUBRIC.map((criterion) => ({
      criterionId: criterion.id,
      awarded,
      verdict: 'partial',
      evidence: 'quoted text',
      slideRefs: [1],
      reasoning: 'because',
      fix: 'do this',
    }));

  const reply = (payload: unknown) => ({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
  });

  const originalKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;

  beforeAll(() => {
    // jsdom does not always ship the static; the grader builds one per request.
    if (typeof AbortSignal.timeout !== 'function') {
      AbortSignal.timeout = () => new AbortController().signal;
    }
  });

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  it('reports the model as unavailable instead of inventing a grade when no key is configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(gradeSubmission(request)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      message: AI_UNAVAILABLE_MESSAGE,
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a partial rubric rather than returning an understated total', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(reply({ scores: fullScores(5).slice(0, 3) })) as unknown as typeof fetch;
    await expect(gradeSubmission(request)).rejects.toBeInstanceOf(ApiError);
    await expect(gradeSubmission(request)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it('computes the total from the per-criterion awards, ignoring any total the model claims', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      reply({
        verdictSummary: 'Thin on evidence.',
        totalAwarded: 99,
        percentage: 99,
        scores: DEFAULT_RUBRIC.map((criterion) => ({
          criterionId: criterion.id,
          awarded: criterion.weight / 2,
          verdict: 'partial',
          evidence: 'quoted',
          slideRefs: [1],
          reasoning: 'r',
          fix: 'f',
        })),
      })
    ) as unknown as typeof fetch;

    const result = await gradeSubmission(request);
    expect(result.totalAwarded).toBe(RUBRIC_TOTAL / 2);
    expect(result.percentage).toBe(50);
    expect(result.band).toBe('Needs work');
  });

  it('clamps an award that exceeds its weight and floors a negative one', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      reply({
        scores: DEFAULT_RUBRIC.map((criterion, position) => ({
          criterionId: criterion.id,
          awarded: position === 0 ? criterion.weight + 40 : -10,
          verdict: 'present',
          evidence: 'quoted',
          slideRefs: [1],
          reasoning: 'r',
          fix: 'f',
        })),
      })
    ) as unknown as typeof fetch;

    const result = await gradeSubmission(request);
    expect(result.scores[0].awarded).toBe(DEFAULT_RUBRIC[0].weight);
    expect(result.scores.slice(1).every((score) => score.awarded === 0)).toBe(true);
    expect(result.totalAwarded).toBe(DEFAULT_RUBRIC[0].weight);
  });

  it('drops slide references that do not exist in the submitted deck', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      reply({
        scores: DEFAULT_RUBRIC.map((criterion) => ({
          criterionId: criterion.id,
          awarded: 1,
          verdict: 'partial',
          evidence: 'quoted',
          slideRefs: [1, 2, 7, 0, -3, 'x'],
          reasoning: 'r',
          fix: 'f',
        })),
        flaws: [{ severity: 'nonsense', title: 'Flaw', whatIsWrong: 'wrong', slideRefs: [99] }],
      })
    ) as unknown as typeof fetch;

    const result = await gradeSubmission(request);
    expect(result.scores[0].slideRefs).toEqual([1, 2]);
    expect(result.flaws[0].slideRefs).toEqual([]);
    // An unrecognised severity must not silently become the least serious one.
    expect(result.flaws[0].severity).toBe('major');
  });

  it('falls back to the second model when the first one fails', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce(reply({ scores: fullScores(2) }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await gradeSubmission(request);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.model).toBe('gemini-1.5-flash');
    expect(result.totalAwarded).toBe(DEFAULT_RUBRIC.length * 2);
  });

  it('always attaches the measured checks and a caveat about what the grade is not', async () => {
    global.fetch = jest.fn().mockResolvedValue(reply({ scores: fullScores(3) })) as unknown as typeof fetch;
    const result = await gradeSubmission(request);
    expect(result.measurements.length).toBeGreaterThan(5);
    expect(result.caveats.some((caveat) => /not your competition’s official marking/.test(caveat))).toBe(true);
  });
});
