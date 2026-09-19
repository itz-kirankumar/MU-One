'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { surveyApi, surveyError } from '@/lib/surveys';
import type { SurveyResults as Results } from '@/types/surveys';

export function SurveyResults({ id, onBack }: { id: string; onBack: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const confirmCloseRef = useRef<HTMLButtonElement>(null);
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    surveyApi.results(id).then(result => { if (active) { setData(result); setError(''); } })
      .catch(err => { if (active) setError(surveyError(err)); });
    return () => { active = false; };
  }, [id, attempt]);
  useEffect(() => { if (data) headingRef.current?.focus(); }, [data]);
  useEffect(() => { if (confirmClose) confirmCloseRef.current?.focus(); }, [confirmClose]);

  async function close() {
    setBusy(true); setError('');
    try { await surveyApi.close(id); setConfirmClose(false); setAttempt(value => value + 1); }
    catch (err) { setError(surveyError(err)); }
    finally { setBusy(false); }
  }

  async function loadMore() {
    if (!data?.nextCursor) return;
    setBusy(true); setError('');
    try {
      const page = await surveyApi.results(id, data.nextCursor);
      setData({ ...page, responses: [...data.responses, ...page.responses].filter((response, index, list) => list.findIndex(item => item.id === response.id) === index) });
    } catch (err) { setError(surveyError(err)); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6" aria-busy={!data && !error}>
    <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"><ArrowLeft size={16} /> Back to surveys</button>
    {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}<button className="ml-3 underline" onClick={() => setAttempt(a => a + 1)}>Try again</button></div>}
    {!data && !error && <p role="status" className="py-16 text-center text-gray-400">Loading results…</p>}
    {data && <>
      <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#f7d344]">Your research · Private results</p><h1 ref={headingRef} tabIndex={-1} className="mt-2 break-words text-3xl font-semibold outline-none">{data.survey.title}</h1><p className="mt-2 text-sm text-gray-400">{data.survey.responseCount} responses · {data.survey.status} · {data.survey.anonymousResponses ? 'Anonymous responses' : 'Named responses'}</p></div>
        <div className="flex gap-3"><button aria-label="Refresh results" disabled={busy} onClick={() => setAttempt(a => a + 1)} className="rounded-xl border border-[#333] p-3"><RefreshCw size={16} /></button>{data.survey.status === 'open' && <button disabled={busy} onClick={() => setConfirmClose(true)} className="rounded-xl border border-[#333] px-4 py-2 text-sm">Close survey</button>}</div></header>
      {confirmClose && <div role="alertdialog" aria-labelledby="close-survey-title" onKeyDown={event => { if (event.key === 'Escape' && !busy) setConfirmClose(false); }} className="flex flex-wrap items-center gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><p id="close-survey-title" className="flex-1">Stop accepting responses? Existing results will remain available. This cannot be reopened.</p><button ref={confirmCloseRef} disabled={busy} onClick={close} className="rounded-lg bg-[#f7d344] px-4 py-2 font-semibold text-black">{busy ? 'Closing…' : 'Confirm close'}</button><button disabled={busy} onClick={() => setConfirmClose(false)}>Cancel</button></div>}
      {data.survey.responseCount === 0 && <div className="rounded-2xl border border-dashed border-[#444] p-10 text-center"><h3 className="text-xl font-semibold">Your first response is still ahead.</h3><p className="mt-2 text-sm text-gray-400">Your survey is visible in the community feed. Invite fellow members to find it in Surveys.</p></div>}
      <div className="grid gap-4 md:grid-cols-2">{data.survey.questions.map((question, index) => {
        const total = data.answeredCounts[question.id] ?? 0;
        const counts = data.counts[question.id] ?? {};
        const average = total ? Object.entries(counts).reduce((sum, [value, count]) => sum + Number(value) * count, 0) / total : 0;
        return <section key={question.id} className="min-w-0 rounded-2xl border border-[#292929] bg-[#161616] p-5"><h3 className="break-words text-sm font-semibold">{index + 1}. {question.title}</h3><p className="mt-1 text-xs text-gray-500">{total} answered{question.type === 'rating' && total > 0 ? ` · Average ${average.toFixed(1)} / 5` : ''}</p>
          {question.type === 'text' ? <p className="mt-4 text-sm text-gray-400">Written answers are shown in the responses below.</p> : <div className="mt-5 space-y-4">{(question.type === 'rating' ? ['1', '2', '3', '4', '5'] : question.options).map((label, i) => {
            const count = counts[String(question.type === 'rating' ? i + 1 : i)] ?? 0;
            const percent = total ? Math.round(count / total * 100) : 0;
            return <div key={i}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="break-words text-gray-300">{label}</span><span className="shrink-0 text-gray-400">{count} · {percent}%</span></div><div role="progressbar" aria-label={`${label}: ${percent}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-[#292929]"><div style={{ width: `${percent}%` }} className="h-full rounded-full bg-[#f7d344]" /></div></div>;
          })}</div>}</section>;
      })}</div>
      <div className="flex items-center justify-between"><h3 className="text-xl font-semibold">Individual responses</h3><span className="text-xs text-gray-500">{data.responses.length} loaded of {data.survey.responseCount}</span></div>
      <div className="space-y-3">{data.responses.map((response, index) => <details key={response.id} className="rounded-xl border border-[#292929] bg-[#161616] p-4"><summary className="cursor-pointer text-sm font-medium">{response.respondent ? response.respondent.name : `Anonymous response ${index + 1}`}{response.respondent && <span className="ml-2 break-all text-xs font-normal text-gray-400">{response.respondent.email}</span>}</summary><dl className="mt-5 space-y-4">{data.survey.questions.map(q => {
        const value = response.answers.find(a => a.questionId === q.id)?.value;
        const answer = value === null || value === undefined ? 'Not answered' : q.type === 'choice' ? q.options[Number(value)] : String(value);
        return <div key={q.id}><dt className="text-xs text-gray-500">{q.title}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-200">{answer}</dd></div>;
      })}</dl></details>)}</div>
      {data.nextCursor && <button disabled={busy} onClick={loadMore} className="rounded-xl border border-[#333] px-5 py-3 text-sm disabled:opacity-50">{busy ? 'Loading…' : 'Load more responses'}</button>}
    </>}
  </div>;
}
