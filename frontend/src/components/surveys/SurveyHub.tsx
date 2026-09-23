'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, ClipboardList, Plus, RefreshCw, Users } from 'lucide-react';
import { surveyApi, surveyError } from '@/lib/surveys';
import type { Survey } from '@/types/surveys';
import { SurveyBuilder } from './SurveyBuilder';
import { SurveyDetail } from './SurveyDetail';
import { SurveyResults } from './SurveyResults';

export function SurveyHub() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const exploreTabRef = useRef<HTMLButtonElement>(null);
  const mineTabRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<'feed' | 'create' | 'detail' | 'results'>('feed');
  const [selected, setSelected] = useState('');
  const [mine, setMine] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (view === 'feed') headingRef.current?.focus();
  }, [view]);
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const showMine = event.key === 'ArrowRight' || event.key === 'End';
    setMine(showMine);
    (showMine ? mineTabRef : exploreTabRef).current?.focus();
  }
  function back() { setView('feed'); setRevision(r => r + 1); }
  if (view === 'create') return <SurveyBuilder onCancel={back} onPublished={id => { setSelected(id); setNotice('Published. Your survey is now visible to everyone on MU One.'); setView('results'); }} />;
  if (view === 'detail') return <SurveyDetail key={selected} id={selected} onBack={back} onResults={() => setView('results')} />;
  if (view === 'results') return <><div role="status" aria-live="polite" className="text-sm text-emerald-300">{notice}</div><SurveyResults key={selected} id={selected} onBack={back} /></>;
  return <div className="space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[#292929] pb-7"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f7d344]">The MU community</p><h1 ref={headingRef} tabIndex={-1} className="mt-3 text-3xl font-semibold outline-none sm:text-4xl">Good ideas start with questions.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-gray-400">Test an idea, understand a problem, or find your next insight. Ask the community. Help someone else learn.</p></div><button onClick={() => { setNotice(''); setView('create'); }} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#f7d344] px-5 py-3 text-sm font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><Plus size={17} aria-hidden="true" /> Create survey</button></header>
    <div className="flex items-center justify-between gap-3"><div role="tablist" aria-label="Survey lists" className="flex gap-1 rounded-xl border border-[#292929] bg-[#111] p-1">{[false, true].map(value => { const label = value ? 'My surveys' : 'Explore surveys'; return <button ref={value ? mineTabRef : exploreTabRef} key={String(value)} id={`survey-tab-${value ? 'mine' : 'explore'}`} role="tab" tabIndex={mine === value ? 0 : -1} aria-selected={mine === value} aria-controls="survey-feed-panel" onClick={() => setMine(value)} onKeyDown={handleTabKey} className={`min-h-11 rounded-lg px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${mine === value ? 'bg-[#292929] text-white' : 'text-gray-400'}`}>{label}</button>; })}</div><button onClick={() => setRevision(r => r + 1)} aria-label="Refresh surveys" title="Refresh surveys" className="min-h-11 min-w-11 rounded-lg border border-[#333] p-2.5 text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"><RefreshCw size={16} aria-hidden="true" /></button></div>
    <SurveyFeed key={`${mine}-${revision}`} mine={mine} onSelect={survey => { setSelected(survey.id); setNotice(''); setView(survey.isOwner ? 'results' : 'detail'); }} onCreate={() => setView('create')} />
  </div>;
}

function SurveyFeed({ mine, onSelect, onCreate }: { mine: boolean; onSelect: (survey: Survey) => void; onCreate: () => void }) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    surveyApi.list(mine).then(page => { if (active) { setSurveys(page.surveys); setCursor(page.nextCursor); setError(''); } })
      .catch(err => { if (active) setError(surveyError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mine, attempt]);
  async function more() {
    setLoading(true); setError('');
    try { const page = await surveyApi.list(mine, cursor); setSurveys(old => [...old, ...page.surveys].filter((s, i, list) => list.findIndex(item => item.id === s.id) === i)); setCursor(page.nextCursor); }
    catch (err) { setError(surveyError(err)); }
    finally { setLoading(false); }
  }
  return <section
    id="survey-feed-panel"
    role="tabpanel"
    aria-labelledby={`survey-tab-${mine ? 'mine' : 'explore'}`}
    aria-busy={loading}
  >
    {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}<button onClick={() => setAttempt(a => a + 1)} className="ml-3 underline">Try again</button></div>}
    {loading && !surveys.length && (
      <div role="status" className="flex flex-col items-center justify-center min-h-[400px] gap-6 animate-in fade-in duration-500">
        <div className="relative flex items-center justify-center h-20 w-20">
          <div className="absolute inset-0 rounded-full border-t-2 border-b-2 border-[#f7d344] animate-[spin_2s_linear_infinite] opacity-80"></div>
          <div className="absolute inset-1.5 rounded-full border-r-2 border-l-2 border-white animate-[spin_1.5s_linear_reverse_infinite] opacity-40"></div>
          <div className="absolute inset-3 rounded-full border-t-2 border-[#f7d344] animate-pulse opacity-60"></div>
          <ClipboardList className="h-7 w-7 text-[#f7d344] animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-semibold tracking-widest text-gray-300 uppercase animate-pulse">
            Loading community surveys
          </p>
          <div className="flex gap-1.5 mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f7d344] animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-[#f7d344] animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-[#f7d344] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    )}
    {!loading && !error && !surveys.length && <div className="rounded-2xl border border-dashed border-[#383838] px-5 py-16 text-center"><ClipboardList size={32} className="mx-auto mb-4 text-[#f7d344]" /><h2 className="text-xl font-semibold">{mine ? 'Your research starts here.' : 'Be the first to ask.'}</h2><p className="mt-2 text-sm text-gray-400">{mine ? 'Create a survey and bring your idea to the community.' : 'There are no surveys yet. Start a conversation with a question.'}</p><button onClick={onCreate} className="mt-5 text-sm font-semibold text-[#f7d344]">Create your first survey →</button></div>}
    <div className="grid gap-4 md:grid-cols-2">{surveys.map(survey => <article key={survey.id} aria-labelledby={`survey-title-${survey.id}`} className="flex min-w-0 flex-col rounded-2xl border border-[#292929] bg-[#161616] p-5 transition-colors hover:border-[#444] sm:p-6"><div className="mb-4 flex flex-wrap gap-2 text-[11px]"><span className={`rounded-full px-2.5 py-1 ${survey.status === 'open' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-[#292929] text-gray-400'}`}>{survey.status === 'open' ? 'Open for responses' : 'Closed'}</span><span className="rounded-full bg-[#242424] px-2.5 py-1 text-gray-400">{survey.anonymousResponses ? 'Anonymous responses' : 'Named responses'}</span></div><h2 id={`survey-title-${survey.id}`} className="break-words text-xl font-semibold">{survey.title}</h2><p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-gray-400">{survey.description}</p><p className="mt-4 text-xs text-gray-500">By {survey.authorName} · {survey.questions.length} questions</p><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#292929] pt-4"><span className="flex items-center gap-1.5 text-xs text-gray-400"><Users size={14} aria-hidden="true" />{survey.responseCount} responses</span><button onClick={() => onSelect(survey)} className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[#f7d344] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20">{survey.isOwner ? 'View results' : survey.hasResponded ? 'Response submitted' : survey.status === 'closed' ? 'View survey' : 'Take survey'}<ArrowUpRight size={15} aria-hidden="true" /></button></div></article>)}</div>
    {cursor && <button onClick={more} disabled={loading} className="rounded-xl border border-[#333] px-5 py-3 text-sm disabled:opacity-50">{loading ? 'Loading…' : 'Load more surveys'}</button>}
  </section>;
}
