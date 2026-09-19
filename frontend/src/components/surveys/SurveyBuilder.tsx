'use client';

import { useRef, useState } from 'react';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { surveyApi, surveyError } from '@/lib/surveys';
import type { SurveyDraft, SurveyQuestion } from '@/types/surveys';

const field = 'w-full rounded-xl border border-[#333] bg-[#111] px-3 py-2.5 text-sm text-white placeholder:text-gray-500';
const newQuestion = (index: number): SurveyQuestion => ({ id: `q${index + 1}`, title: '', type: 'choice', required: true, options: ['', ''] });

export function SurveyBuilder({ onCancel, onPublished }: { onCancel: () => void; onPublished: (id: string) => void }) {
  const [draft, setDraft] = useState<SurveyDraft>({ title: '', description: '', anonymousAuthor: false,
    anonymousResponses: true, durationDays: 14, questions: [newQuestion(0)] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef<string | null>(null);
  const inFlight = useRef(false);

  function updateQuestion(index: number, patch: Partial<SurveyQuestion>) {
    setDraft(old => ({ ...old, questions: old.questions.map((q, i) => i === index ? { ...q, ...patch } : q) }));
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await surveyApi.create(draft, requestId.current);
      onPublished(result.id);
    } catch (err) { setError(surveyError(err)); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <form onSubmit={publish} className="mx-auto max-w-3xl space-y-6">
    <button type="button" onClick={onCancel} disabled={busy} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"><ArrowLeft size={16} /> Back to surveys</button>
    <div><p className="text-xs font-semibold uppercase tracking-widest text-[#f7d344]">Ask your community</p>
      <h2 className="mt-2 text-3xl font-semibold">Turn a question into evidence.</h2>
      <p className="mt-2 text-sm text-gray-400">Publish a survey for everyone on MU One. Keep it focused and easy to answer.</p></div>
    <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
      <section className="space-y-4 rounded-2xl border border-[#292929] bg-[#161616] p-5 sm:p-6">
        <label className="block space-y-2 text-sm font-medium"><span>Survey title</span><input required maxLength={120} className={field} placeholder="What should we build next?" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
        <label className="block space-y-2 text-sm font-medium"><span>What are you validating?</span><textarea required maxLength={1500} rows={3} className={field} placeholder="Explain your idea, who should respond, and how their input will help." value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
        <label className="block space-y-2 text-sm"><span>Accept responses for</span><select className={field} value={draft.durationDays} onChange={e => setDraft({ ...draft, durationDays: Number(e.target.value) })}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>
      </section>
      <section className="space-y-4 rounded-2xl border border-[#292929] bg-[#161616] p-5 sm:p-6">
        <h3 className="font-semibold">Identity & privacy</h3>
        <label className="flex items-start gap-3 text-sm"><input className="mt-1 accent-[#f7d344]" type="checkbox" checked={draft.anonymousAuthor} onChange={e => setDraft({ ...draft, anonymousAuthor: e.target.checked })} /><span>Post as an anonymous member<span className="mt-1 block text-xs leading-5 text-gray-400">Your name won’t appear to other members. You still own and manage this survey.</span></span></label>
        <label className="flex items-start gap-3 text-sm"><input className="mt-1 accent-[#f7d344]" type="checkbox" checked={draft.anonymousResponses} onChange={e => setDraft({ ...draft, anonymousResponses: e.target.checked })} /><span>Collect anonymous responses<span className="mt-1 block text-xs leading-5 text-gray-400">{draft.anonymousResponses ? 'You will see answers without names or email addresses.' : 'Respondents will be told their name and email are shared with you.'}</span></span></label>
        <p className="text-xs leading-5 text-gray-400">Only you can see results. MU One keeps a private participation record to prevent duplicate responses. Avoid asking for identifying details in anonymous surveys.</p>
      </section>
      <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Questions</h3><span className="text-xs text-gray-400">{draft.questions.length} / 10</span></div>
      {draft.questions.map((question, index) => <section key={index} className="space-y-4 rounded-2xl border border-[#292929] bg-[#161616] p-5 sm:p-6">
        <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Question {index + 1}</span>
          <button type="button" disabled={draft.questions.length === 1} aria-label={`Remove question ${index + 1}`} onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, id: `q${i + 1}` })) })} className="rounded p-2 text-gray-400 hover:text-red-300 disabled:opacity-30"><Trash2 size={16} /></button></div>
        <label className="block space-y-2 text-sm"><span>Question {index + 1} text</span><input required maxLength={300} className={field} placeholder="What would you like to find out?" value={question.title} onChange={e => updateQuestion(index, { title: e.target.value })} /></label>
        <div className="flex flex-wrap items-end gap-4"><label className="min-w-40 flex-1 space-y-2 text-sm"><span>Answer type</span><select className={field} value={question.type} onChange={e => updateQuestion(index, { type: e.target.value as SurveyQuestion['type'] })}><option value="choice">Single choice</option><option value="rating">Rating · 1 to 5</option><option value="text">Written answer</option></select></label>
          <label className="flex items-center gap-2 py-3 text-sm"><input type="checkbox" className="accent-[#f7d344]" checked={question.required} onChange={e => updateQuestion(index, { required: e.target.checked })} />Required</label></div>
        {question.type === 'choice' && <div className="space-y-2">{question.options.map((option, optionIndex) => <div key={optionIndex} className="flex items-center gap-2"><input required maxLength={100} aria-label={`Question ${index + 1} option ${optionIndex + 1}`} className={field} placeholder={`Option ${optionIndex + 1}`} value={option} onChange={e => updateQuestion(index, { options: question.options.map((o, i) => i === optionIndex ? e.target.value : o) })} /><button type="button" aria-label={`Remove option ${optionIndex + 1} from question ${index + 1}`} disabled={question.options.length <= 2} onClick={() => updateQuestion(index, { options: question.options.filter((_, i) => i !== optionIndex) })} className="p-2 text-gray-400 disabled:opacity-20"><Trash2 size={14} /></button></div>)}
          <button type="button" disabled={question.options.length >= 8} onClick={() => updateQuestion(index, { options: [...question.options, ''] })} className="py-2 text-xs text-[#f7d344] disabled:opacity-30">+ Add option</button></div>}
        {question.type === 'rating' && <p className="text-xs text-gray-400">Respondents choose a number from 1 to 5. Explain what each end means in your question.</p>}
      </section>)}
      <button type="button" disabled={draft.questions.length >= 10} onClick={() => setDraft({ ...draft, questions: [...draft.questions, newQuestion(draft.questions.length)] })} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#444] py-4 text-sm text-gray-300 hover:border-[#f7d344] disabled:opacity-40"><Plus size={16} /> Add question</button>
    </fieldset>
    {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#292929] pt-5"><p className="max-w-sm text-xs leading-5 text-gray-400">Questions and privacy settings are fixed after publication so responses stay comparable.</p><button disabled={busy} className="rounded-xl bg-[#f7d344] px-6 py-3 text-sm font-semibold text-black disabled:opacity-50">{busy ? 'Publishing…' : 'Publish survey'}</button></div>
  </form>;
}
