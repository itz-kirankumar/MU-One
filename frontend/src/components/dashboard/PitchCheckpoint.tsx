'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Gauge,
  HelpCircle,
  Loader2,
  MinusCircle,
  RotateCcw,
  Ruler,
  ShieldAlert,
  Target,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DeckExtractError, deckFormatFor, extractDeck } from '@/lib/deckExtract';
import { DEFAULT_RUBRIC, RUBRIC_TOTAL } from '@/lib/checkpointRubric';
import { checkpointMarkdown, downloadCheckpoint } from '@/lib/checkpointExport';
import {
  MAX_PROBLEM_CHARS,
  MAX_RUBRIC_CHARS,
  MIN_PROBLEM_CHARS,
  type CheckpointResult,
  type CheckpointVerdict,
  type ExtractedDeck,
  type MeasurementStatus,
} from '@/types/checkpoint';

const fieldClass =
  'w-full min-w-0 rounded-xl border border-[#333] bg-[#0A0A0A] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#f7d344]/60';
const quietButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm font-medium text-gray-200 hover:bg-[#242424] focus-visible:outline-2 focus-visible:outline-[#f7d344] disabled:opacity-40 disabled:cursor-not-allowed';
const primaryButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#f7d344] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#ffe26e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d344] disabled:opacity-40 disabled:cursor-not-allowed';
const panelClass = 'min-w-0 rounded-2xl border border-[#292929] bg-[#141414] p-4 sm:p-6';

const STATUS_STYLE: Record<MeasurementStatus, { chip: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  ok: { chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', icon: CheckCircle2, label: 'Pass' },
  warn: { chip: 'border-amber-500/30 bg-amber-500/10 text-amber-300', icon: AlertTriangle, label: 'Watch' },
  fail: { chip: 'border-red-500/30 bg-red-500/10 text-red-300', icon: XCircle, label: 'Fail' },
  na: { chip: 'border-[#333] bg-[#1A1A1A] text-gray-400', icon: MinusCircle, label: 'Not checked' },
};

const VERDICT_STYLE: Record<CheckpointVerdict, string> = {
  present: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  partial: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  missing: 'border-red-500/30 bg-red-500/10 text-red-300',
};

const SEVERITY_STYLE = {
  fatal: { wrap: 'border-red-500/40 bg-red-500/[0.07]', chip: 'bg-red-500/20 text-red-300', label: 'Fatal' },
  major: { wrap: 'border-amber-500/30 bg-amber-500/[0.06]', chip: 'bg-amber-500/20 text-amber-300', label: 'Major' },
  minor: { wrap: 'border-[#333] bg-[#181818]', chip: 'bg-[#2A2A2A] text-gray-300', label: 'Minor' },
} as const;

const BAND_COLOUR: Record<CheckpointResult['band'], string> = {
  Strong: 'text-emerald-400',
  Competitive: 'text-[#f7d344]',
  'Needs work': 'text-amber-400',
  'Not ready': 'text-red-400',
};

function SlideRefs({ refs }: { refs: number[] }) {
  if (!refs.length) return null;
  return (
    <span className="text-xs text-gray-500">
      slide{refs.length === 1 ? '' : 's'} {refs.join(', ')}
    </span>
  );
}

export function PitchCheckpoint() {
  const { user } = useAuth();
  const [problemStatement, setProblemStatement] = useState('');
  const [rubricNotes, setRubricNotes] = useState('');
  const [slideLimit, setSlideLimit] = useState('');
  const [deck, setDeck] = useState<ExtractedDeck | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState('');
  const [softNotice, setSoftNotice] = useState('');
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState<CheckpointResult | null>(null);
  const [gradedStatement, setGradedStatement] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const extractionRef = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestRef.current?.abort();
    };
  }, []);

  const trimmedProblem = problemStatement.trim();
  const problemReady = trimmedProblem.length >= MIN_PROBLEM_CHARS && trimmedProblem.length <= MAX_PROBLEM_CHARS;
  const canGrade = Boolean(user) && problemReady && !!deck && !extracting && !grading;

  const deckWords = useMemo(
    () => (deck ? deck.slides.reduce((sum, slide) => sum + `${slide.title} ${slide.text}`.split(/\s+/).filter(Boolean).length, 0) : 0),
    [deck]
  );

  function resetOutput() {
    requestRef.current?.abort();
    setGrading(false);
    setError('');
    setSoftNotice('');
    setNotice('');
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    resetOutput();
    if (!deckFormatFor(file)) {
      setDeck(null);
      setError('Upload a .pptx or .pdf file. Other formats cannot be read.');
      return;
    }
    const token = ++extractionRef.current;
    setExtracting(true);
    setDeck(null);
    setResult(null);
    try {
      const extracted = await extractDeck(file);
      if (!mounted.current || token !== extractionRef.current) return;
      setDeck(extracted);
      setNotice(
        `Read ${extracted.slides.length} ${extracted.format === 'pdf' ? 'page' : 'slide'}${extracted.slides.length === 1 ? '' : 's'} from ${extracted.fileName}. Nothing was uploaded — only the text below is sent for grading.`
      );
    } catch (failure) {
      if (!mounted.current || token !== extractionRef.current) return;
      setError(
        failure instanceof DeckExtractError
          ? failure.message
          : 'That file could not be read. Try re-exporting it from PowerPoint or your PDF tool.'
      );
    } finally {
      if (mounted.current && token === extractionRef.current) setExtracting(false);
    }
  }

  async function grade(event: React.FormEvent) {
    event.preventDefault();
    if (!canGrade || !user || !deck) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const statement = trimmedProblem;
    setGrading(true);
    setError('');
    setSoftNotice('');
    setNotice('');
    try {
      const token = await user.getIdToken();
      if (controller.signal.aborted) return;
      const response = await fetch('/api/pitch-checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          problemStatement: statement,
          rubricNotes: rubricNotes.trim(),
          slideLimit: Number(slideLimit) || 0,
          deck,
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) {
        // A missing or overloaded model must never produce a made-up grade.
        if (data?.code === 'AI_UNAVAILABLE') {
          if (mounted.current) setSoftNotice(typeof data.error === 'string' ? data.error : 'Grading is unavailable right now.');
          return;
        }
        throw new Error(typeof data?.error === 'string' ? data.error : 'Grading could not be completed. Please retry.');
      }
      if (!data || !Array.isArray(data.scores) || !Array.isArray(data.measurements)) {
        throw new Error('The grading response was incomplete. Please retry.');
      }
      if (controller.signal.aborted || !mounted.current) return;
      setResult(data as CheckpointResult);
      setGradedStatement(statement);
    } catch (failure) {
      if (!controller.signal.aborted && mounted.current) {
        setError(failure instanceof Error ? failure.message : 'Grading failed. Please retry.');
      }
    } finally {
      if (mounted.current && requestRef.current === controller) setGrading(false);
    }
  }

  async function copyReport() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(checkpointMarkdown(result, gradedStatement));
      setNotice('Scorecard copied as Markdown.');
    } catch {
      setError('Copying failed. Use Download instead.');
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <header className="min-w-0 rounded-2xl border border-[#292929] bg-gradient-to-br from-[#161616] to-[#101010] p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Target className="h-5 w-5 text-[#f7d344]" />
          <h1 className="text-xl font-bold text-white sm:text-2xl">Pitch Checkpoint</h1>
          <span className="rounded-full border border-[#f7d344]/30 bg-[#f7d344]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#f7d344]">
            Graded
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          Give it the problem you were set and your deck. It is read slide by slide, checked against a published{' '}
          {RUBRIC_TOTAL}-point rubric, and returned as a score you can audit line by line — with every flaw a judge would
          call out.
        </p>
      </header>

      <form onSubmit={grade} className="min-w-0 space-y-5">
        <section className={panelClass}>
          <h2 className="text-sm font-semibold text-white">1 · What were you asked to solve?</h2>
          <p className="mt-1 text-xs text-gray-500">
            Paste the case prompt or problem statement exactly as it was given. Everything is graded against this, so a
            vague paste produces a vague grade.
          </p>
          <label htmlFor="checkpoint-problem" className="sr-only">
            Problem statement
          </label>
          <textarea
            id="checkpoint-problem"
            value={problemStatement}
            onChange={(event) => {
              setProblemStatement(event.target.value.slice(0, MAX_PROBLEM_CHARS));
              resetOutput();
            }}
            rows={6}
            maxLength={MAX_PROBLEM_CHARS}
            placeholder="e.g. A D2C skincare brand's repeat purchase rate has fallen from 34% to 19% over four quarters. Recommend how to recover it within two quarters on a ₹2 crore budget. Deliverable: 8 slides plus appendix."
            className={`${fieldClass} mt-3 resize-y`}
            required
          />
          <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs">
            <span className={trimmedProblem.length && !problemReady ? 'text-amber-400' : 'text-gray-500'}>
              {trimmedProblem.length < MIN_PROBLEM_CHARS
                ? `At least ${MIN_PROBLEM_CHARS} characters needed (${trimmedProblem.length} so far).`
                : 'Good — this is what the deck will be judged against.'}
            </span>
            <span className="text-gray-600">
              {problemStatement.length}/{MAX_PROBLEM_CHARS}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
            <div className="min-w-0">
              <label htmlFor="checkpoint-rubric" className="text-xs font-medium text-gray-300">
                Competition rules or marking scheme <span className="text-gray-600">(optional)</span>
              </label>
              <textarea
                id="checkpoint-rubric"
                value={rubricNotes}
                onChange={(event) => {
                  setRubricNotes(event.target.value.slice(0, MAX_RUBRIC_CHARS));
                  resetOutput();
                }}
                rows={3}
                maxLength={MAX_RUBRIC_CHARS}
                placeholder="Judging weights, mandatory sections, format rules…"
                className={`${fieldClass} mt-1.5 resize-y`}
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="checkpoint-limit" className="text-xs font-medium text-gray-300">
                Slide limit <span className="text-gray-600">(optional)</span>
              </label>
              <input
                id="checkpoint-limit"
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                value={slideLimit}
                onChange={(event) => {
                  setSlideLimit(event.target.value);
                  resetOutput();
                }}
                placeholder="e.g. 8"
                className={`${fieldClass} mt-1.5`}
              />
              <p className="mt-1.5 text-xs text-gray-600">Checked exactly, not judged.</p>
            </div>
          </div>
        </section>

        <section className={panelClass}>
          <h2 className="text-sm font-semibold text-white">2 · Upload your deck</h2>
          <p className="mt-1 text-xs text-gray-500">
            .pptx or .pdf, up to 25 MB. The file is read in your browser — only the extracted text leaves this page.
            .pptx also carries your speaker notes and font sizes, so it gets a stricter check.
          </p>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void handleFile(event.dataTransfer.files?.[0]);
            }}
            className={`mt-3 rounded-xl border border-dashed p-5 text-center transition-colors ${
              dragging ? 'border-[#f7d344] bg-[#f7d344]/5' : 'border-[#3A3A3A] bg-[#0F0F0F]'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="sr-only"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            {extracting ? (
              <p className="flex items-center justify-center gap-2 text-sm text-gray-300">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Reading your deck…
              </p>
            ) : (
              <>
                <Upload className="mx-auto h-6 w-6 text-gray-500" aria-hidden="true" />
                <button type="button" onClick={() => inputRef.current?.click()} className={`${quietButton} mt-3`}>
                  Choose a file
                </button>
                <p className="mt-2 text-xs text-gray-600">or drop it here</p>
              </>
            )}
          </div>

          {deck && (
            <div className="mt-3 min-w-0 rounded-xl border border-[#292929] bg-[#0F0F0F] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 text-sm text-white">
                  <FileText className="h-4 w-4 flex-shrink-0 text-[#f7d344]" aria-hidden="true" />
                  <span className="truncate">{deck.fileName}</span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDeck(null);
                    setResult(null);
                    resetOutput();
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-[#242424] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Remove
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {deck.slides.length} {deck.format === 'pdf' ? 'pages' : 'slides'} · {deckWords} words read
                {deck.emptySlides.length > 0 && ` · ${deck.emptySlides.length} with no readable text`}
                {deck.truncated && ' · long deck, later slides were cut'}
              </p>
              {deck.textPoor && (
                <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
                  Most slides have no selectable text, so this looks like an image export. Grading will only see a
                  fraction of your work — upload the editable original for a real check.
                </p>
              )}
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-white">
                  See exactly what will be sent
                </summary>
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                  {deck.slides.map((slide) => (
                    <div key={slide.index} className="rounded-lg border border-[#242424] bg-[#141414] p-2.5">
                      <p className="text-xs font-semibold text-gray-300">
                        {slide.index}. {slide.title || <span className="italic text-gray-600">no title text</span>}
                      </p>
                      {slide.text && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500">{slide.text}</p>}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!canGrade} className={primaryButton}>
            {grading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Gauge className="h-4 w-4" aria-hidden="true" />}
            {grading ? 'Grading your submission…' : 'Grade my submission'}
          </button>
          {result && (
            <button
              type="button"
              onClick={() => {
                setResult(null);
                resetOutput();
              }}
              className={quietButton}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Clear result
            </button>
          )}
          {!user && <span className="text-xs text-amber-400">Sign in with your Masters&rsquo; Union account to grade a deck.</span>}
          {user && !problemReady && <span className="text-xs text-gray-500">Add the problem statement to continue.</span>}
          {user && problemReady && !deck && <span className="text-xs text-gray-500">Upload a deck to continue.</span>}
        </div>
      </form>

      <div aria-live="polite" className="space-y-3">
        {notice && <p className="text-xs text-gray-400">{notice}</p>}
        {softNotice && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" aria-hidden="true" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-amber-200">{softNotice}</p>
                <p className="mt-1 text-xs text-amber-200/70">
                  Your problem statement and deck are still loaded here — press Grade again in a few minutes and nothing
                  needs re-entering.
                </p>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4" role="alert">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" aria-hidden="true" />
              <p className="min-w-0 text-sm text-red-200">{error}</p>
            </div>
          </div>
        )}
      </div>

      {result && <CheckpointReport result={result} problemStatement={gradedStatement} onCopy={copyReport} />}

      {!result && (
        <section className={panelClass}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Ruler className="h-4 w-4 text-gray-400" aria-hidden="true" />
            What you will be marked on
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            The full rubric, published before you submit. Nothing is scored against a hidden criterion.
          </p>
          <ul className="mt-3 space-y-2">
            {DEFAULT_RUBRIC.map((criterion) => (
              <li key={criterion.id} className="flex min-w-0 gap-3 rounded-lg border border-[#242424] bg-[#0F0F0F] p-3">
                <span className="mt-0.5 flex h-7 w-10 flex-shrink-0 items-center justify-center rounded-md bg-[#f7d344]/10 text-xs font-bold text-[#f7d344]">
                  {criterion.weight}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{criterion.label}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{criterion.whatJudgesLookFor}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CheckpointReport({
  result,
  problemStatement,
  onCopy,
}: {
  result: CheckpointResult;
  problemStatement: string;
  onCopy: () => void;
}) {
  return (
    <div className="min-w-0 space-y-5">
      <section className={panelClass}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total score</p>
            <p className="mt-1 text-4xl font-bold text-white">
              {result.totalAwarded}
              <span className="text-2xl text-gray-500">/{result.totalPossible}</span>
            </p>
            <p className={`mt-1 text-sm font-semibold ${BAND_COLOUR[result.band]}`}>
              {result.band} · {result.percentage}%
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onCopy} className={quietButton}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy
            </button>
            <button type="button" onClick={() => downloadCheckpoint(result, problemStatement)} className={quietButton}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </button>
          </div>
        </div>

        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#242424]">
          <div
            className="h-full rounded-full bg-[#f7d344] transition-[width]"
            style={{ width: `${Math.max(0, Math.min(100, result.percentage))}%` }}
          />
        </div>

        <p className="mt-4 text-sm leading-relaxed text-gray-300">{result.verdictSummary}</p>
        <p className="mt-3 text-xs text-gray-600">
          {result.deckSummary.slideCount} {result.deckSummary.format === 'pdf' ? 'pages' : 'slides'} ·{' '}
          {result.deckSummary.wordCount} words read · graded {new Date(result.gradedAt).toLocaleString()} · {result.model}
        </p>
      </section>

      <section className={panelClass}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Ruler className="h-4 w-4 text-gray-400" aria-hidden="true" />
          Measured checks
        </h2>
        <p className="mt-1 text-xs text-gray-500">
          Counted from your file by code, not opinion. You can verify every one of these by hand.
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {result.measurements.map((item) => {
            const style = STATUS_STYLE[item.status];
            const Icon = style.icon;
            return (
              <li key={item.id} className="min-w-0 rounded-lg border border-[#242424] bg-[#0F0F0F] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.chip}`}>
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {style.label}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-gray-300">{item.value}</p>
                <p className="mt-1 text-xs text-gray-500">{item.detail}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={panelClass}>
        <h2 className="text-sm font-semibold text-white">Scorecard</h2>
        <p className="mt-1 text-xs text-gray-500">
          Each criterion is scored out of its own weight; the total is their sum. No hidden adjustment is applied.
        </p>
        <ul className="mt-3 space-y-3">
          {result.scores.map((score) => (
            <li key={score.criterionId} className="min-w-0 rounded-xl border border-[#242424] bg-[#0F0F0F] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 text-sm font-semibold text-white">{score.label}</p>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${VERDICT_STYLE[score.verdict]}`}>
                    {score.verdict}
                  </span>
                  <span className="font-mono text-sm text-white">
                    {score.awarded}
                    <span className="text-gray-500">/{score.weight}</span>
                  </span>
                </div>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#242424]">
                <div
                  className="h-full rounded-full bg-[#f7d344]/70"
                  style={{ width: `${score.weight ? Math.round((score.awarded / score.weight) * 100) : 0}%` }}
                />
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <p className="text-gray-300">
                  <span className="font-semibold text-gray-400">Evidence: </span>
                  {score.evidence} <SlideRefs refs={score.slideRefs} />
                </p>
                {score.reasoning && (
                  <p className="text-gray-400">
                    <span className="font-semibold text-gray-500">Why this number: </span>
                    {score.reasoning}
                  </p>
                )}
                {score.fix && (
                  <p className="rounded-lg border border-[#2A2A2A] bg-[#151515] p-2 text-gray-300">
                    <span className="font-semibold text-[#f7d344]">Do this: </span>
                    {score.fix}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between rounded-xl border border-[#f7d344]/30 bg-[#f7d344]/[0.07] px-3.5 py-3">
          <span className="text-sm font-semibold text-white">Total</span>
          <span className="font-mono text-sm font-bold text-[#f7d344]">
            {result.totalAwarded}/{result.totalPossible}
          </span>
        </div>
      </section>

      {result.flaws.length > 0 && (
        <section className={panelClass}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldAlert className="h-4 w-4 text-gray-400" aria-hidden="true" />
            Flaws a judge would call out
          </h2>
          <ul className="mt-3 space-y-2.5">
            {result.flaws.map((flaw) => {
              const style = SEVERITY_STYLE[flaw.severity];
              return (
                <li key={flaw.id} className={`min-w-0 rounded-xl border p-3.5 ${style.wrap}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.chip}`}>
                      {style.label}
                    </span>
                    <p className="min-w-0 text-sm font-semibold text-white">{flaw.title}</p>
                    <SlideRefs refs={flaw.slideRefs} />
                  </div>
                  <p className="mt-2 text-xs text-gray-300">{flaw.whatIsWrong}</p>
                  {flaw.whyJudgesPenalise && <p className="mt-1 text-xs text-gray-500">{flaw.whyJudgesPenalise}</p>}
                  {flaw.fix && (
                    <p className="mt-2 rounded-lg border border-[#2A2A2A] bg-[#151515] p-2 text-xs text-gray-300">
                      <span className="font-semibold text-[#f7d344]">Fix: </span>
                      {flaw.fix}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(result.alignment.covered.length > 0 || result.alignment.missed.length > 0 || result.alignment.note) && (
        <section className={panelClass}>
          <h2 className="text-sm font-semibold text-white">Did you answer the question asked?</h2>
          {result.alignment.note && <p className="mt-1 text-xs text-gray-400">{result.alignment.note}</p>}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Covered</p>
              <ul className="mt-2 space-y-1.5">
                {result.alignment.covered.length ? (
                  result.alignment.covered.map((item) => (
                    <li key={item} className="flex gap-2 text-xs text-gray-300">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-400" aria-hidden="true" />
                      {item}
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-gray-500">Nothing in the brief was fully covered.</li>
                )}
              </ul>
            </div>
            <div className="min-w-0 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Missed</p>
              <ul className="mt-2 space-y-1.5">
                {result.alignment.missed.length ? (
                  result.alignment.missed.map((item) => (
                    <li key={item} className="flex gap-2 text-xs text-gray-300">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-400" aria-hidden="true" />
                      {item}
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-gray-500">Nothing obvious was left out.</li>
                )}
              </ul>
            </div>
          </div>
        </section>
      )}

      {result.judgeQuestions.length > 0 && (
        <section className={panelClass}>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <HelpCircle className="h-4 w-4 text-gray-400" aria-hidden="true" />
            Prepare for these
          </h2>
          <ul className="mt-3 space-y-2">
            {result.judgeQuestions.map((question) => (
              <li key={question} className="rounded-lg border border-[#242424] bg-[#0F0F0F] p-3 text-sm text-gray-300">
                {question}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="min-w-0 rounded-2xl border border-[#292929] bg-[#101010] p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Read this grade with care</h2>
        <ul className="mt-2 space-y-1.5">
          {result.caveats.map((caveat) => (
            <li key={caveat} className="flex gap-2 text-xs text-gray-500">
              <MinusCircle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
              {caveat}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
