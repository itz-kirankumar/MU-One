'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarPlus, Check, Copy, Download, ExternalLink, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { createCalendarEvent, createGoogleTask } from '@/lib/functions';
import { pitchMarkdown, safePitchUrl } from '@/lib/pitchExport';
import { getPitchFocusSlots } from '@/lib/pitchScheduling';
import type { PitchDraft, PitchInput, PitchResult } from '@/types/pitch';

interface PitchWorkspaceProps {
  draft: PitchDraft;
  onChange: (draft: PitchDraft) => void;
  saveStatus: string;
  saveError?: string;
  onNewDraft: () => void;
  drafts: PitchDraft[];
  onSelectDraft: (id: string) => void;
}

const fieldClass = 'w-full min-w-0 rounded-xl border border-[#333] bg-[#0A0A0A] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#f7d344]/60';
const quietButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#3A3A3A] px-3 py-2 text-sm font-medium text-gray-200 hover:bg-[#242424] focus-visible:outline-2 focus-visible:outline-[#f7d344] disabled:opacity-40 disabled:cursor-not-allowed';
const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#f7d344] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#ffe26e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f7d344] disabled:opacity-40 disabled:cursor-not-allowed';
const panelClass = 'min-w-0 rounded-2xl border border-[#292929] bg-[#141414] p-4 sm:p-6';

function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function displayDate(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0 space-y-1.5"><span className="text-sm font-medium text-gray-300">{label}</span>{children}</label>;
}

function SourceRefs({ ids, sources }: { ids: string[]; sources: PitchResult['sources'] }) {
  const referenced = sources.filter((source) => ids.includes(source.id));
  if (!referenced.length) return null;
  return <div className="mt-3 flex flex-wrap gap-2" aria-label="Source references">{referenced.map((source) => {
    const url = safePitchUrl(source.url);
    return url ? <a key={source.id} href={url} target="_blank" rel="noopener noreferrer" className="rounded border border-[#444] px-2 py-1 text-xs text-[#f7d344] underline underline-offset-2" title={source.title}>{source.id}</a> : null;
  })}</div>;
}

export function PitchWorkspace({ draft, onChange, saveStatus, saveError, onNewDraft, drafts, onSelectDraft }: PitchWorkspaceProps) {
  const { user, googleConnected } = useAuth();
  const { dashboardData, syncStatus, hasSynced, triggerSync, isAutoSyncing, error: dashboardError } = useDashboard();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [taskEdits, setTaskEdits] = useState<Record<string, { title: string; dueDate: string }>>({});
  const [busyActions, setBusyActions] = useState<string[]>([]);
  const [prepDate, setPrepDate] = useState(localDate);
  const [duration, setDuration] = useState(60);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [syncError, setSyncError] = useState('');
  const requestRef = useRef<AbortController | null>(null);
  const actionLocks = useRef(new Set<string>());
  const completedActions = useRef(new Set<string>());
  const latestDraft = useRef(draft);
  const mounted = useRef(true);
  latestDraft.current = draft;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestRef.current?.abort();
    };
  }, []);

  // A prop change can also originate from a saved draft selection, outside this form.
  useEffect(() => {
    requestRef.current?.abort();
    setAnalyzing(false);
  }, [draft.id, JSON.stringify(draft.input)]);

  function updateInput<K extends keyof PitchInput>(key: K, value: PitchInput[K]) {
    requestRef.current?.abort();
    setAnalyzing(false);
    setError('');
    setNotice('');
    const updated = { ...latestDraft.current, input: { ...latestDraft.current.input, [key]: value }, updatedAt: new Date().toISOString() };
    latestDraft.current = updated;
    onChange(updated);
  }

  async function analyze(event: React.FormEvent) {
    event.preventDefault();
    if (analyzing || !user) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const input = { ...draft.input };
    const draftId = draft.id;
    setAnalyzing(true);
    setError('');
    setNotice('');
    try {
      const token = await user.getIdToken();
      if (controller.signal.aborted) return;
      const response = await fetch('/api/pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Analysis could not be completed. Please retry.');
      if (!data || !Array.isArray(data.slides) || !Array.isArray(data.critiques) || !Array.isArray(data.sources)) throw new Error('The analysis response was incomplete. Your draft is still saved; please retry.');
      if (controller.signal.aborted || !mounted.current || latestDraft.current.id !== draftId || JSON.stringify(latestDraft.current.input) !== JSON.stringify(input)) return;
      onChange({ ...latestDraft.current, result: data as PitchResult, analyzedInput: input, updatedAt: new Date().toISOString() });
      setNotice('Analysis ready. Review the evidence and turn the gaps into preparation tasks.');
    } catch (failure) {
      if (!controller.signal.aborted && mounted.current) setError(failure instanceof Error ? failure.message : 'Analysis failed. Please retry.');
    } finally {
      if (mounted.current && requestRef.current === controller) setAnalyzing(false);
    }
  }

  function startAction(key: string): boolean {
    if (actionLocks.current.has(key) || completedActions.current.has(key)) return false;
    actionLocks.current.add(key);
    setBusyActions([...actionLocks.current]);
    setError('');
    setNotice('');
    return true;
  }

  function finishAction(key: string) {
    actionLocks.current.delete(key);
    if (mounted.current) setBusyActions([...actionLocks.current]);
  }

  async function addResearchTask(critique: PitchResult['critiques'][number], key: string) {
    if (!googleConnected || draft.taskIds.includes(key)) return;
    const edit = taskEdits[key] ?? { title: critique.actionTitle.slice(0, 120), dueDate: draft.input.deadline };
    const title = edit.title.trim();
    if (!title || title.length > 120 || !startAction(key)) return;
    const original = latestDraft.current;
    try {
      await createGoogleTask({ title, ...(edit.dueDate ? { dueDate: edit.dueDate } : {}) });
      completedActions.current.add(key);
      const current = latestDraft.current.id === original.id ? latestDraft.current : original;
      const updated = { ...current, taskIds: [...new Set([...current.taskIds, key])], updatedAt: new Date().toISOString() };
      latestDraft.current = updated;
      onChange(updated);
      if (mounted.current) setNotice(`Added “${title}” to Google Tasks.`);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not add this task. Please retry.');
    } finally {
      finishAction(key);
    }
  }

  const result = draft.result;
  const stale = Boolean(result && JSON.stringify(draft.analyzedInput) !== JSON.stringify(draft.input));
  const connected = googleConnected;
  const availability = dashboardData?.calendarAvailability;
  const calendarHealth = syncStatus?.sourceHealth?.calendar;
  const coverageValid = Boolean(availability?.complete && Number.isFinite(new Date(availability.from).getTime()) && Number.isFinite(new Date(availability.to).getTime()));
  const calendarReady = connected && hasSynced && calendarHealth?.status === 'ok' && coverageValid;
  const allBookings = drafts.flatMap((item) => item.bookedSlots);
  const busyEvents = [...(availability?.events ?? []), ...allBookings];
  const slots = calendarReady && availability ? getPitchFocusSlots(busyEvents, prepDate, duration, draft.input.deadline)
    .filter((slot) => slot.startIso >= availability.from && slot.endIso <= availability.to) : [];
  const chosenSlot = slots.find((slot) => slot.startIso === selectedSlot);
  const calendarBusy = busyActions.includes('calendar');

  async function bookPreparation() {
    if (!calendarReady || !chosenSlot || !startAction('calendar')) return;
    const original = latestDraft.current;
    const slot = chosenSlot;
    const title = `${draft.input.competition || 'Pitch'} — preparation`.slice(0, 120);
    try {
      await createCalendarEvent({ title, start: slot.startIso, end: slot.endIso, description: 'Prepare the case argument, resolve evidence gaps, and rehearse judge questions in MU One.' });
      const current = latestDraft.current.id === original.id ? latestDraft.current : original;
      const updated = { ...current, bookedSlots: [...current.bookedSlots, { startIso: slot.startIso, endIso: slot.endIso, title }], updatedAt: new Date().toISOString() };
      latestDraft.current = updated;
      onChange(updated);
      if (mounted.current) {
        setSelectedSlot('');
        setNotice(`Preparation booked on Google Calendar: ${displayDate(slot.startIso)}.`);
      }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Could not book preparation. Please retry.');
    } finally {
      finishAction('calendar');
    }
  }

  async function copyOutline() {
    setError('');
    try {
      await navigator.clipboard.writeText(pitchMarkdown(draft));
      setNotice('Outline, assumptions, and sources copied.');
    } catch {
      setError('Clipboard access was blocked. Use Download Markdown to save the outline.');
    }
  }

  function downloadOutline() {
    const blob = new Blob([pitchMarkdown(draft)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(draft.input.competition || 'pitch-outline').replace(/[^a-z0-9-]/gi, '-').slice(0, 70)}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const sourceMailUrl = safePitchUrl(draft.sourceMail?.gmailUrl);
  return <div className="space-y-6 text-sm text-gray-300">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1 sm:max-w-md"><Field label="Your saved pitches"><select className={fieldClass} value={draft.id} onChange={(event) => onSelectDraft(event.target.value)} disabled={busyActions.length > 0}>{drafts.map((item) => <option key={item.id} value={item.id}>{item.input.competition || 'Untitled pitch'}</option>)}</select></Field></div>
      <div className="flex items-center justify-between gap-4"><span className="text-xs text-gray-400" role="status">{saveStatus}</span><button type="button" className={quietButton} onClick={onNewDraft} disabled={busyActions.length > 0}><Plus size={16} />New pitch</button></div>
    </div>
    {saveError && <p role="alert" className="rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-amber-200">{saveError}</p>}
    {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-800 bg-red-950/30 p-3 text-red-200"><AlertTriangle className="mt-0.5 shrink-0" size={16} />{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-3 text-emerald-200">{notice}</p>}

    <form onSubmit={analyze} className={`${panelClass} space-y-5`}>
      <div><h2 className="text-lg font-semibold text-white">Build an argument you can defend</h2><p className="mt-1 text-sm leading-relaxed text-gray-400">Start with the actual assignment. Get a tailored outline, evidence gaps, and questions to rehearse.</p></div>
      {draft.sourceMail && <div className="rounded-xl border border-[#443d22] bg-[#211e12] p-3"><span className="block text-xs font-semibold uppercase tracking-wide text-[#f7d344]">From your inbox</span><p className="mt-1 break-words text-gray-200">{draft.sourceMail.subject}</p>{sourceMailUrl && <a href={sourceMailUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-[#f7d344] underline underline-offset-2">Open original email<ExternalLink size={13} /></a>}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Submission type"><select className={fieldClass} value={draft.input.mode} onChange={(event) => updateInput('mode', event.target.value as PitchInput['mode'])}><option value="venture">Venture pitch — make the case for a new business</option><option value="case">Business case — recommend a decision</option></select></Field>
        <Field label="Competition or assignment"><input className={fieldClass} value={draft.input.competition} maxLength={200} placeholder="Competition name or course assignment" onChange={(event) => updateInput('competition', event.target.value)} /></Field>
        <Field label="Industry or domain"><input className={fieldClass} value={draft.input.industry} maxLength={160} placeholder="For example, clean energy or retail" onChange={(event) => updateInput('industry', event.target.value)} /></Field>
        <Field label="Round or submission stage"><input className={fieldClass} value={draft.input.round} maxLength={120} placeholder="For example, regional final" onChange={(event) => updateInput('round', event.target.value)} /></Field>
      </div>
      <Field label={draft.input.mode === 'case' ? 'Your proposed recommendation' : 'Your idea and the customer problem'}><textarea className={fieldClass} rows={3} value={draft.input.idea} maxLength={6000} placeholder={draft.input.mode === 'case' ? 'What should the company do, and why?' : 'Who needs this, what changes for them, and how would the business work?'} onChange={(event) => updateInput('idea', event.target.value)} /></Field>
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Actual brief or problem statement"><textarea className={fieldClass} rows={5} value={draft.input.brief} maxLength={18000} placeholder="Paste the assignment, constraints, deliverables, and submission instructions." onChange={(event) => updateInput('brief', event.target.value)} /></Field>
        <Field label="Judging rubric and weights"><textarea className={fieldClass} rows={5} value={draft.input.rubric} maxLength={8000} placeholder="Paste criteria and scores. If unavailable, leave blank; requirements will be marked as inferred." onChange={(event) => updateInput('rubric', event.target.value)} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Slide limit"><select className={fieldClass} value={draft.input.slideLimit} onChange={(event) => updateInput('slideLimit', Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => index + 3).map((count) => <option key={count} value={count}>{count} slides</option>)}</select></Field>
        <Field label="Submission deadline"><input className={fieldClass} type="date" value={draft.input.deadline} onChange={(event) => updateInput('deadline', event.target.value)} /></Field>
      </div>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center"><button type="submit" disabled={analyzing || !user || (!draft.input.idea.trim() && !draft.input.brief.trim())} className={primaryButton}>{analyzing ? <RefreshCw className="animate-spin" size={17} /> : <Sparkles size={17} />}{analyzing ? 'Researching and analyzing…' : result ? 'Update analysis' : 'Analyze my pitch'}</button><p className="text-xs leading-relaxed text-gray-400">Research may take a little time. Missing evidence is called out explicitly.</p></div>
    </form>

    {result && <div className="space-y-6">
      {stale && <div role="status" className="rounded-xl border border-amber-700 bg-amber-950/30 p-4 text-amber-200">Your brief has changed. This analysis and its export reflect the previous version. Choose Update analysis to use your edits.</div>}
      <section className={`${panelClass} space-y-4`} aria-labelledby="pitch-analysis-title">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 id="pitch-analysis-title" className="text-lg font-semibold text-white">Your argument, sharpened</h2><p className="mt-1 text-xs text-gray-400">Analyzed {displayDate(result.generatedAt)}</p></div><div className="flex flex-wrap gap-2"><button className={quietButton} onClick={copyOutline}><Copy size={15} />Copy outline</button><button className={quietButton} onClick={downloadOutline}><Download size={15} />Download Markdown</button></div></div>
        <p className="leading-relaxed">{result.summary}</p><p className="border-l-2 border-[#f7d344] pl-4 leading-relaxed text-white">{result.recommendation}</p>
        <div className={`rounded-xl border p-3 ${result.researchStatus === 'complete' ? 'border-[#3b3b3b] bg-[#1a1a1a]' : 'border-amber-800 bg-amber-950/20 text-amber-200'}`}><strong>{result.researchStatus === 'complete' ? 'Research retrieved' : result.researchStatus === 'partial' ? 'Partial research' : 'Research unavailable'}</strong><p className="mt-1 leading-relaxed">{result.researchNote}</p></div>
      </section>
      <section aria-labelledby="pitch-gaps-title"><h2 id="pitch-gaps-title" className="mb-3 text-lg font-semibold text-white">Weaknesses to resolve</h2><div className="grid gap-4 lg:grid-cols-3">{result.critiques.map((critique, index) => {
        const key = `${result.generatedAt}:${critique.id}`;
        const edit = taskEdits[key] ?? { title: critique.actionTitle.slice(0, 120), dueDate: draft.input.deadline };
        const done = draft.taskIds.includes(key);
        return <article key={key} className="flex min-w-0 flex-col rounded-xl border border-[#48302a] bg-[#191411] p-4"><span className="text-xs font-semibold uppercase tracking-wide text-amber-400">Gap {index + 1}</span><h3 className="mt-2 text-base font-semibold text-white">{critique.title}</h3><p className="mt-2 leading-relaxed">{critique.issue}</p><p className="mt-3 leading-relaxed text-gray-400"><strong className="font-medium text-gray-200">Evidence needed: </strong>{critique.evidenceNeeded}</p><div className="mt-auto space-y-3 pt-5"><Field label={`Research task ${index + 1}`}><input className={fieldClass} maxLength={120} value={edit.title} disabled={done || busyActions.includes(key)} onChange={(event) => setTaskEdits((previous) => ({ ...previous, [key]: { ...edit, title: event.target.value } }))} /></Field><Field label={`Task ${index + 1} due date`}><input className={fieldClass} type="date" value={edit.dueDate} disabled={done || busyActions.includes(key)} onChange={(event) => setTaskEdits((previous) => ({ ...previous, [key]: { ...edit, dueDate: event.target.value } }))} /></Field><button className={`${quietButton} w-full`} onClick={() => addResearchTask(critique, key)} disabled={!connected || stale || done || busyActions.includes(key) || !edit.title.trim()}>{done ? <Check size={15} /> : <Plus size={15} />}{done ? 'Added to Google Tasks' : busyActions.includes(key) ? 'Adding task…' : 'Add to Google Tasks'}</button></div></article>;
      })}</div>{!connected && <p className="mt-3 text-sm text-gray-400">Connect Google in Settings to add research tasks and book preparation.</p>}</section>
      <section aria-labelledby="pitch-outline-title"><h2 id="pitch-outline-title" className="mb-3 text-lg font-semibold text-white">Slide outline</h2><div className="grid gap-4 md:grid-cols-2">{result.slides.map((slide) => <article key={slide.number} className={`${panelClass} flex flex-col`}><span className="text-xs font-semibold uppercase tracking-wide text-[#f7d344]">Slide {slide.number}</span><h3 className="mt-2 text-lg font-semibold text-white">{slide.title}</h3><p className="mt-2 leading-relaxed text-gray-400">{slide.keyMessage}</p><ul className="my-4 list-disc space-y-2 pl-5 leading-relaxed marker:text-[#f7d344]">{slide.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul><div className="mt-auto border-t border-[#333] pt-3"><p className="leading-relaxed text-amber-200"><strong className="font-medium">Judge’s question: </strong>{slide.judgeQuestion}</p><SourceRefs ids={slide.sourceIds} sources={result.sources} /></div></article>)}</div></section>
      <section className={panelClass} aria-labelledby="pitch-criteria-title"><h2 id="pitch-criteria-title" className="mb-4 text-lg font-semibold text-white">Requirement coverage</h2>{!draft.analyzedInput?.rubric.trim() && <p className="mb-4 text-amber-200">No rubric was supplied. Treat inferred criteria as preparation guidance, and confirm them against the organizer’s instructions.</p>}<div className="space-y-4">{result.requirements.map((requirement, index) => <div key={index} className="border-t border-[#2d2d2d] pt-3"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-white">{requirement.criterion}</h3><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${requirement.coverage === 'covered' ? 'bg-emerald-950 text-emerald-300' : requirement.coverage === 'partial' ? 'bg-amber-950 text-amber-300' : 'bg-red-950 text-red-300'}`}>{requirement.coverage}</span></div><p className="mt-2 leading-relaxed text-gray-400">{requirement.feedback}</p></div>)}</div></section>
      <section className={panelClass} aria-labelledby="pitch-evidence-title"><h2 id="pitch-evidence-title" className="mb-2 text-lg font-semibold text-white">Evidence and assumptions</h2><p className="mb-4 text-gray-400">Check the source’s date, geography, and segment before defending a claim. Estimates depend on the assumptions shown.</p><div className="space-y-3">{result.assumptions.map((assumption, index) => <article key={index} className="rounded-xl border border-[#333] bg-[#0e0e0e] p-4"><span className={`text-xs font-semibold uppercase tracking-wide ${assumption.kind === 'sourced' ? 'text-emerald-300' : 'text-amber-300'}`}>{assumption.kind === 'sourced' ? 'Sourced claim' : assumption.kind === 'estimate' ? 'Calculated estimate' : 'Team assumption'}</span><p className="mt-2 leading-relaxed">{assumption.claim}</p>{assumption.calculation && <p className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-gray-400">Calculation: {assumption.calculation}</p>}<SourceRefs ids={assumption.sourceIds} sources={result.sources} /></article>)}</div></section>
      <section className={panelClass} aria-labelledby="pitch-sources-title"><h2 id="pitch-sources-title" className="mb-4 text-lg font-semibold text-white">Research sources</h2>{result.sources.length === 0 ? <p className="text-amber-200">No research sources were retrieved. Treat market claims as unverified until you add evidence.</p> : <ol className="space-y-4">{result.sources.map((source) => {
        const url = safePitchUrl(source.url);
        return <li key={source.id} className="min-w-0 border-t border-[#333] pt-3"><div className="flex items-start gap-2"><span className="rounded bg-[#242424] px-2 py-1 text-xs text-[#f7d344]">{source.id}</span>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="break-words font-medium text-white underline decoration-[#666] underline-offset-4">{source.title}<ExternalLink size={13} className="ml-1 inline" /></a> : <span>{source.title} (link unavailable)</span>}</div><p className="mt-2 text-xs text-gray-500">Retrieved {displayDate(source.retrievedAt)}</p><p className="mt-2 leading-relaxed text-gray-400">{source.excerpt}</p></li>;
      })}</ol>}</section>
    </div>}

    <section className={`${panelClass} space-y-4`} aria-labelledby="pitch-preparation-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="pitch-preparation-title" className="text-lg font-semibold text-white">Protect preparation time</h2><p className="mt-1 text-gray-400">Choose an available gap, then book it on Google Calendar.</p></div><button className={quietButton} disabled={!connected || isAutoSyncing || syncStatus?.syncing} onClick={async () => { setSyncError(''); try { await triggerSync({ force: true }); } catch (failure) { setSyncError(failure instanceof Error ? failure.message : 'Calendar sync failed. Please retry.'); } }}><RefreshCw size={15} className={isAutoSyncing ? 'animate-spin' : ''} />{isAutoSyncing ? 'Syncing…' : 'Refresh calendar'}</button></div>
      <p className="text-xs leading-relaxed text-gray-400">{availability?.syncedAt ? `Calendar snapshot: ${displayDate(availability.syncedAt)}. Availability can change after syncing.` : 'No complete calendar snapshot available yet.'}</p>
      {(syncError || dashboardError || calendarHealth?.status === 'error') && <p role="alert" className="text-red-300">{syncError || dashboardError || calendarHealth?.message || 'Calendar sync failed.'}</p>}
      {!calendarReady && <p className="rounded-xl border border-amber-900 bg-amber-950/20 p-3 text-amber-200">{!connected ? 'Connect Google in Settings to find preparation time.' : 'Refresh your calendar to load complete availability. Free slots cannot be confirmed from an incomplete calendar snapshot.'}</p>}
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Preparation date"><input className={fieldClass} type="date" min={localDate()} max={draft.input.deadline || undefined} value={prepDate} onChange={(event) => { setPrepDate(event.target.value); setSelectedSlot(''); }} /></Field><Field label="Session length"><select className={fieldClass} value={duration} onChange={(event) => { setDuration(Number(event.target.value)); setSelectedSlot(''); }}>{[45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></Field></div>
      {calendarReady && <><Field label="Available preparation slot"><select className={fieldClass} value={chosenSlot ? selectedSlot : ''} onChange={(event) => setSelectedSlot(event.target.value)}><option value="">{slots.length ? 'Choose a time' : 'No available slot in this calendar snapshot'}</option>{slots.map((slot) => <option key={slot.startIso} value={slot.startIso}>{slot.label}</option>)}</select></Field><p className="text-xs text-gray-400">Times use your device timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). {availability && `Synced coverage ends ${displayDate(availability.to)}.`}</p>{prepDate === draft.input.deadline && <p className="text-amber-200">This is the submission date. Confirm the exact submission time before booking.</p>}</>}
      <button className={primaryButton} onClick={bookPreparation} disabled={!calendarReady || !chosenSlot || calendarBusy}><CalendarPlus size={17} />{calendarBusy ? 'Booking…' : 'Block on Google Calendar'}</button>
      {draft.bookedSlots.length > 0 && <div className="border-t border-[#333] pt-3"><h3 className="mb-2 font-medium text-white">Booked preparation</h3><ul className="space-y-2">{draft.bookedSlots.map((slot) => <li key={slot.startIso} className="flex gap-2 text-emerald-300"><Check size={15} className="mt-0.5 shrink-0" />{displayDate(slot.startIso)} · {Math.round((new Date(slot.endIso).getTime() - new Date(slot.startIso).getTime()) / 60000)} minutes</li>)}</ul></div>}
    </section>
  </div>;
}
