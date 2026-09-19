'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { surveyApi, surveyError } from '@/lib/surveys';
import type { Survey, SurveyAnswer } from '@/types/surveys';

export function SurveyDetail({ id, onBack, onResults }: { id: string; onBack: () => void; onResults: () => void }) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [success, setSuccess] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    surveyApi.detail(id).then(data => { if (active) { setSurvey(data); setError(''); } })
      .catch(err => { if (active) setError(surveyError(err)); });
    return () => { active = false; };
  }, [id, attempt]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!survey || inFlight.current) return;
    const payload: SurveyAnswer[] = survey.questions.map(q => ({ questionId: q.id, value: answers[q.id] ?? null }));
    inFlight.current = true; setBusy(true); setError('');
    try {
      await surveyApi.respond(id, payload, consent);
      setSuccess(true);
      setSurvey({ ...survey, hasResponded: true, responseCount: survey.responseCount + 1 });
    } catch (err) { setError(surveyError(err)); }
    finally { setBusy(false); inFlight.current = false; }
  }

  return <div className="mx-auto max-w-3xl space-y-6">
    <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"><ArrowLeft size={16} /> Back to surveys</button>
    {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error} {!survey && <button onClick={() => setAttempt(a => a + 1)} className="ml-3 underline">Try again</button>}</div>}
    {!survey && !error && <p role="status" className="py-16 text-center text-gray-400">Loading survey…</p>}
    {survey && <>
      <header className="space-y-3"><p className="text-xs font-semibold uppercase tracking-widest text-[#f7d344]">Community survey · {survey.status}</p>
        <h2 className="break-words text-3xl font-semibold">{survey.title}</h2>
        <p className="text-sm text-gray-400">By {survey.authorName} · {survey.questions.length} questions · Closes {new Date(survey.closesAt).toLocaleDateString('en-GB')}</p>
        <p className="whitespace-pre-wrap break-words leading-7 text-gray-300">{survey.description}</p></header>
      <div className="flex items-start gap-3 rounded-xl border border-[#333] bg-[#181818] p-4"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-[#f7d344]" /><div className="text-sm"><p className="font-medium">{survey.anonymousResponses ? 'Your response is anonymous to the creator' : 'Your name and email will be shared with the creator'}</p><p className="mt-1 text-xs leading-5 text-gray-400">Only the creator can read responses. {survey.anonymousResponses ? 'Avoid including identifying details in your answers. MU One keeps a private participation record to allow one response per account.' : 'Submit only if you agree to share your identity alongside your answers.'}</p></div></div>
      {survey.isOwner ? <div className="rounded-xl border border-[#333] p-6"><p className="text-sm text-gray-300">This is your survey. Other members can respond; your own answers won’t count toward validation.</p><button onClick={onResults} className="mt-4 rounded-lg bg-[#f7d344] px-4 py-2 text-sm font-semibold text-black">View results · {survey.responseCount}</button><div className="mt-5 space-y-2 text-sm text-gray-400">{survey.questions.map((q, i) => <p key={q.id}>{i + 1}. {q.title}</p>)}</div></div>
        : survey.hasResponded ? <div role="status" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center"><CheckCircle2 className="mx-auto mb-3 text-emerald-400" size={28} /><h3 className="text-lg font-semibold">{success ? 'Thank you. Your response is in.' : 'You’ve already responded.'}</h3><p className="mt-2 text-sm text-gray-400">Your input helps this member validate their idea.</p></div>
          : survey.status === 'closed' ? <p className="rounded-xl border border-[#333] p-6 text-gray-400">This survey is no longer accepting responses.</p>
            : <form onSubmit={submit} className="space-y-5"><fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
              {survey.questions.map((question, index) => <fieldset key={question.id} className="rounded-2xl border border-[#292929] bg-[#161616] p-5 sm:p-6"><legend className="max-w-full px-2 text-sm font-medium">{index + 1}. {question.title} {question.required ? <span className="text-[#f7d344]">*</span> : <span className="text-gray-500">(optional)</span>}</legend>
                {question.type === 'text' ? <textarea aria-label={question.title} required={question.required} maxLength={1500} rows={4} value={answers[question.id] ?? ''} onChange={e => setAnswers({ ...answers, [question.id]: e.target.value })} className="w-full rounded-xl border border-[#333] bg-[#111] p-3 text-sm" placeholder="Your perspective…" />
                  : <div className={question.type === 'rating' ? 'grid grid-cols-5 gap-2' : 'space-y-2'}>{(question.type === 'rating' ? ['1', '2', '3', '4', '5'] : question.options).map((option, i) => {
                    const value = question.type === 'rating' ? i + 1 : i;
                    return <label key={value} className={`flex cursor-pointer items-center rounded-xl border border-[#333] py-3 text-sm hover:border-[#f7d344]/50 ${question.type === 'rating' ? 'flex-col gap-2 px-2' : 'gap-3 px-4'}`}><input type="radio" name={question.id} required={question.required} value={value} checked={answers[question.id] === value} onChange={() => setAnswers({ ...answers, [question.id]: value })} className="accent-[#f7d344]" />{option}</label>;
                  })}{!question.required && <button type="button" onClick={() => setAnswers(old => { const next = { ...old }; delete next[question.id]; return next; })} className="p-2 text-xs text-gray-400 underline">Clear answer</button>}</div>}
              </fieldset>)}
              {!survey.anonymousResponses && <label className="flex items-start gap-3 text-sm text-gray-300"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 accent-[#f7d344]" />I agree to share my name and email with the survey creator.</label>}
              <button disabled={busy} className="rounded-xl bg-[#f7d344] px-6 py-3 text-sm font-semibold text-black disabled:opacity-50">{busy ? 'Submitting…' : 'Submit response'}</button>
              <p className="text-xs text-gray-500">One response per member. You can’t edit a response after submitting.</p>
            </fieldset></form>}
    </>}
  </div>;
}
