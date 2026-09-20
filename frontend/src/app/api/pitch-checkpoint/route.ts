import 'server-only';
import { NextRequest } from 'next/server';
import {
  ApiError,
  acquirePitchSlot,
  apiErrorResponse,
  asRecord,
  enforceRateLimit,
  readJsonBody,
  requireCampusUser,
} from '@/lib/server/apiSecurity';
import { gradeSubmission } from '@/lib/server/checkpointGrading';
import {
  MAX_DECK_CHARS,
  MAX_DECK_SLIDES,
  MAX_PROBLEM_CHARS,
  MAX_RUBRIC_CHARS,
  MAX_SLIDE_CHARS,
  MIN_PROBLEM_CHARS,
  type CheckpointRequest,
  type ExtractedDeck,
  type ExtractedSlide,
} from '@/types/checkpoint';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Two model attempts at ~26s each must be able to finish before the platform cuts the request.
export const maxDuration = 60;

/** Extracted deck text, not the file: a 60-slide deck lands well inside this. */
const MAX_BODY_BYTES = 400_000;

function requireString(value: unknown, field: string, min: number, max: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < min) throw new ApiError(400, `${field} must be at least ${min} characters.`, 'INVALID_INPUT');
  if (text.length > max) throw new ApiError(400, `${field} must be under ${max} characters.`, 'INVALID_INPUT');
  return text;
}

function readDeck(value: unknown): ExtractedDeck {
  const record = asRecord(value);
  const format = record.format === 'pptx' || record.format === 'pdf' ? record.format : null;
  if (!format) throw new ApiError(400, 'The deck format must be pptx or pdf.', 'INVALID_INPUT');
  if (!Array.isArray(record.slides) || !record.slides.length) throw new ApiError(400, 'The deck contained no readable slides.', 'INVALID_INPUT');
  if (record.slides.length > MAX_DECK_SLIDES) throw new ApiError(413, `Decks are limited to ${MAX_DECK_SLIDES} slides.`, 'BODY_TOO_LARGE');

  let total = 0;
  const slides: ExtractedSlide[] = record.slides.map((entry, position) => {
    const slide = asRecord(entry);
    const title = typeof slide.title === 'string' ? slide.title.slice(0, 300) : '';
    const text = typeof slide.text === 'string' ? slide.text.slice(0, MAX_SLIDE_CHARS) : '';
    const notes = typeof slide.notes === 'string' ? slide.notes.slice(0, MAX_SLIDE_CHARS) : '';
    total += title.length + text.length + notes.length;
    if (total > MAX_DECK_CHARS) throw new ApiError(413, 'That deck holds more text than can be graded in one pass.', 'BODY_TOO_LARGE');
    const minFontPt = Number(slide.minFontPt);
    const imageCount = Number(slide.imageCount);
    return {
      // Renumber from the server's own count so slide references cannot be skewed.
      index: position + 1,
      title,
      text,
      notes,
      minFontPt: Number.isFinite(minFontPt) && minFontPt > 0 ? minFontPt : null,
      imageCount: Number.isInteger(imageCount) && imageCount >= 0 ? imageCount : null,
    };
  });

  const emptySlides = slides.filter((slide) => !slide.title && slide.text.replace(/\s/g, '').length < 12).map((slide) => slide.index);
  return {
    fileName: typeof record.fileName === 'string' ? record.fileName.slice(0, 200) : 'submission',
    format,
    slides,
    emptySlides,
    textPoor: emptySlides.length > slides.length / 2,
    truncated: record.truncated === true,
  };
}

export async function POST(request: NextRequest) {
  let releaseSlot: (() => void) | null = null;
  try {
    const uid = await requireCampusUser(request);
    enforceRateLimit(uid, 'pitch-checkpoint', 12, 600_000);
    releaseSlot = acquirePitchSlot(uid);

    const body = asRecord(await readJsonBody(request, MAX_BODY_BYTES));
    const slideLimit = Math.trunc(Number(body.slideLimit));
    const payload: CheckpointRequest = {
      problemStatement: requireString(body.problemStatement, 'The problem statement', MIN_PROBLEM_CHARS, MAX_PROBLEM_CHARS),
      rubricNotes: typeof body.rubricNotes === 'string' ? body.rubricNotes.trim().slice(0, MAX_RUBRIC_CHARS) : '',
      slideLimit: Number.isFinite(slideLimit) && slideLimit > 0 ? Math.min(slideLimit, MAX_DECK_SLIDES) : 0,
      deck: readDeck(body.deck),
    };

    const result = await gradeSubmission(payload);
    return Response.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error);
  } finally {
    releaseSlot?.();
  }
}
