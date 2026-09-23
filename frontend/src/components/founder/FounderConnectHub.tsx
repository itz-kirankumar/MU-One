'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, FileText, Heart, MessageCircle, Plus, RefreshCw, Send, Users } from 'lucide-react';
import {
  extractLinkedInPdf, founderApi, founderError,
  type Bootstrap, type FounderComment, type FounderMessage, type FounderPost,
  type FounderSummary, type FounderThread, type MatchReport, type Question,
} from '@/lib/founder';

const card = 'rounded-2xl border border-[#303030] bg-[#171717] p-4 sm:p-5';
const input = 'w-full rounded-xl border border-[#383838] bg-[#101010] px-3 py-2.5 text-sm text-white outline-none focus:border-[#f7d344]';
const button = 'rounded-xl bg-[#f7d344] px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50';
const subtle = 'rounded-xl border border-[#383838] px-3 py-2 text-sm text-gray-200 hover:bg-[#242424] disabled:opacity-50';
type View = 'discover' | 'feed' | 'inbox' | 'profile';

export function FounderConnectHub() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [view, setView] = useState<View>('discover');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await founderApi.bootstrap()); }
    catch (cause) { setError(founderError(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    founderApi.bootstrap().then(result => { if (active) setData(result); })
      .catch(cause => { if (active) setError(founderError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('founder_connect');
    if (status) {
      queueMicrotask(() => setNotice(status === 'success' ? 'LinkedIn account connected. Add your profile PDF or background to improve matches.' : 'LinkedIn connection was not completed. You can still continue.'));
      params.delete('founder_connect'); params.delete('reason');
      window.history.replaceState({}, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
    }
  }, []);

  if (loading && !data) {
    return (
      <div role="status" className="flex flex-col items-center justify-center min-h-[400px] gap-6 animate-in fade-in duration-500">
        <div className="relative flex items-center justify-center h-20 w-20">
          <div className="absolute inset-0 rounded-full border-t-2 border-b-2 border-[#f7d344] animate-[spin_2s_linear_infinite] opacity-80"></div>
          <div className="absolute inset-1.5 rounded-full border-r-2 border-l-2 border-white animate-[spin_1.5s_linear_reverse_infinite] opacity-40"></div>
          <div className="absolute inset-3 rounded-full border-t-2 border-[#f7d344] animate-pulse opacity-60"></div>
          <Users className="h-7 w-7 text-[#f7d344] animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm font-semibold tracking-widest text-gray-300 uppercase animate-pulse">
            Loading Founder Connect
          </p>
          <div className="flex gap-1.5 mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f7d344] animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-[#f7d344] animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 rounded-full bg-[#f7d344] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }
  if (!data) return <div role="alert" className={card}>{error}<button className={`${subtle} ml-3`} onClick={refresh}>Try again</button></div>;
  const onboarded = data.onboarding.status === 'complete';
  return <div className="space-y-5 pb-12 text-white">
    <header className="border-b border-[#303030] pb-5">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#f7d344]">The MU community</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold sm:text-3xl">Founder Connect</h1><p className="mt-1 max-w-2xl text-sm text-gray-400">Find complementary builders, test ideas, and start a conversation.</p></div><button className={subtle} onClick={refresh} aria-label="Refresh Founder Connect"><RefreshCw size={16} /></button></div>
    </header>
    {notice && <p role="status" className="rounded-xl border border-emerald-600/30 bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
    {!onboarded ? <Onboarding data={data} onDone={refresh} onNotice={setNotice} onError={setError} /> : <>
      <nav aria-label="Founder Connect sections" className="flex flex-wrap gap-2">{(['discover', 'feed', 'inbox', 'profile'] as View[]).map(item => <button key={item} aria-current={view === item ? 'page' : undefined} className={view === item ? button : subtle} onClick={() => setView(item)}>{({ discover: 'Discover', feed: 'Community', inbox: 'Messages', profile: 'My profile' })[item]}</button>)}</nav>
      {view === 'discover' && <Discover data={data} onMessage={() => setView('inbox')} onError={setError} />}
      {view === 'feed' && <Community data={data} onError={setError} />}
      {view === 'inbox' && <Inbox onError={setError} />}
      {view === 'profile' && <Profile data={data} onUpdate={refresh} onError={setError} />}
    </>}
  </div>;
}

function Onboarding({ data, onDone, onNotice, onError }: { data: Bootstrap; onDone: () => Promise<void>; onNotice: (s: string) => void; onError: (s: string) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | number[] | string>>({});
  const [busy, setBusy] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [manual, setManual] = useState(false);
  const [headline, setHeadline] = useState('');
  const [summary, setSummary] = useState('');
  const [skills, setSkills] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const sections = data.questionnaire.sectionOrder;
  const questions = step ? data.questionnaire.questions.filter(q => q.section === sections[step - 1]) : [];
  async function run(work: () => Promise<unknown>, message: string) {
    setBusy(true); onError('');
    try { await work(); onNotice(message); await onDone(); }
    catch (cause) { onError(founderError(cause)); }
    finally { setBusy(false); }
  }
  function next() {
    const missing = questions.find(q => {
      const value = answers[q.id];
      if (!q.required) return false;
      if (q.kind === 'text') return typeof value !== 'string' || value.trim().length < (q.minChars ?? 1);
      if (q.kind === 'multi') return !Array.isArray(value) || value.length === 0;
      return typeof value !== 'number';
    });
    if (missing) { onError(`Please answer: ${missing.title}`); return; }
    onError('');
    if (step < sections.length) setStep(step + 1);
    else {
      if (!aiConsent) { onError('Please agree to AI-assisted profile review and matching before joining.'); return; }
      void run(() => founderApi.submit(answers, aiConsent), 'Your Founder Connect profile is ready.');
    }
  }
  return <div className="space-y-5">
    <div className={card}><h2 className="text-lg font-semibold">Set up your founder profile</h2><p className="mt-1 text-sm text-gray-400">Your answers and imported background stay private. Others see your profile summary and the match explanation, never your raw questionnaire or statement.</p><p className="mt-3 text-xs text-[#f7d344]">{step === 0 ? 'Background · optional' : `${step} of ${sections.length} · ${data.questionnaire.sectionLabels[sections[step - 1]]}`}</p></div>
    {step === 0 ? <div className={`${card} space-y-6`}>
      <div>
        <h3 className="text-lg font-semibold">Connect your background</h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">LinkedIn sign-in verifies your account and imports basic identity only. To analyze experience, education, and skills, upload your LinkedIn “Save to PDF” export or enter them yourself.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col justify-between rounded-xl border border-[#303030] bg-[#121212] p-4 transition-colors hover:border-[#404040]">
          <div>
            <div className="font-medium">
              <span>LinkedIn Sign-in</span>
            </div>
            <p className="mt-2 text-xs text-gray-400">Verifies your identity and pulls basic profile info directly from LinkedIn.</p>
          </div>
          <div className="mt-4">
            {data.linkedinConnection ? <p className="text-sm font-medium text-emerald-400">Connected as {data.linkedinConnection.name || data.linkedinConnection.email}</p> : data.linkedinSignInReady ? <button className={`${subtle} flex w-full items-center justify-center gap-2 bg-[#1a1a1a] font-medium`} disabled={busy} onClick={() => void run(async () => { window.location.assign(await founderApi.authUrl()); }, 'Opening LinkedIn…')}><img src="/linkedin-square.png" alt="LinkedIn" className="h-[18px] w-[18px] object-contain rounded-sm" /><span>Connect LinkedIn</span></button> : <p className="text-xs text-gray-500">Not configured yet.</p>}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-[#303030] bg-[#121212] p-4 transition-colors hover:border-[#404040]">
          <div>
            <div className="flex items-center gap-2 font-medium">
              <FileText size={18} className="text-[#f7d344]" />
              <span>Import Profile PDF</span>
            </div>
            <p className="mt-2 text-xs text-gray-400">Upload your &ldquo;Save to PDF&rdquo; export from LinkedIn for deep experience analysis.</p>
          </div>
          <div className="mt-4">
            <label className={`${subtle} flex w-full cursor-pointer items-center justify-center bg-[#1a1a1a] font-medium transition-colors hover:border-[#f7d344]`} htmlFor="linkedin-pdf">
              <span className="truncate">{busy ? 'Uploading...' : 'Choose PDF File'}</span>
              <input id="linkedin-pdf" type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (!file) return; void run(async () => founderApi.importLinkedIn({ source: 'pdf', extractedText: await extractLinkedInPdf(file) }), 'Profile details imported. You can continue the questionnaire.'); }} />
            </label>
            {data.profile?.linkedin && <p className="mt-2 truncate text-xs font-medium text-emerald-400">Imported: {data.profile.linkedin.headline || 'Success'}</p>}
          </div>
        </div>
      </div>

      <div className="border-t border-[#292929] pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-medium">Don&apos;t have LinkedIn?</h4>
            <p className="text-xs text-gray-400">You can enter your most recent roles and skills manually.</p>
          </div>
          <button className={subtle} type="button" onClick={() => setManual(!manual)}>{manual ? 'Hide manual entry' : 'Enter manually'}</button>
        </div>
        {manual && <form className="mt-4 grid gap-4 rounded-xl border border-[#303030] bg-[#121212] p-4 sm:p-5" onSubmit={event => { event.preventDefault(); void run(() => founderApi.importLinkedIn({ source: 'manual', headline, summary, profileUrl: '', location: '', roles: role ? [{ title: role, company, period: '', months: 0, description: '' }] : [], education: [], skills: skills.split(',').map(s => s.trim()).filter(Boolean) }), 'Background saved.'); }}><label className="text-sm font-medium text-gray-200">Headline<input className={`${input} mt-1`} required maxLength={300} value={headline} onChange={e => setHeadline(e.target.value)} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-gray-200">Most recent role<input className={`${input} mt-1`} value={role} onChange={e => setRole(e.target.value)} /></label><label className="text-sm font-medium text-gray-200">Company<input className={`${input} mt-1`} value={company} onChange={e => setCompany(e.target.value)} /></label></div><label className="text-sm font-medium text-gray-200">Skills <span className="text-xs font-normal text-gray-500">(comma separated)</span><input className={`${input} mt-1`} value={skills} onChange={e => setSkills(e.target.value)} /></label><label className="text-sm font-medium text-gray-200">Background summary<textarea className={`${input} mt-1 min-h-[80px] resize-none`} value={summary} onChange={e => setSummary(e.target.value)} /></label><button className={`${button} w-full`} disabled={busy}>Save manual background</button></form>}
      </div>

      <div className="flex justify-end border-t border-[#292929] pt-5">
        <button className={button} disabled={busy} onClick={() => setStep(1)}>
          Continue to questionnaire <ArrowRight size={16} className="ml-1.5 inline" />
        </button>
      </div>
    </div> : <div className={`${card} space-y-5`}>
      <h3 className="text-lg font-semibold">{data.questionnaire.sectionLabels[sections[step - 1]]}</h3>
      {questions.map(q => <QuestionField key={q.id} question={q} value={answers[q.id]} onChange={value => setAnswers(previous => ({ ...previous, [q.id]: value }))} />)}
      {step === sections.length && <label className="flex items-start gap-2 text-sm text-gray-300"><input type="checkbox" className="mt-1" checked={aiConsent} onChange={event => setAiConsent(event.target.checked)} /><span>I agree to have my questionnaire, statement and imported background processed for AI-assisted profile review and founder matching. My raw answers are not shown to other students.</span></label>}
      <div className="flex justify-between gap-3 border-t border-[#303030] pt-4"><button className={subtle} onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft size={15} className="mr-1 inline" /> Back</button><button className={button} onClick={next} disabled={busy}>{busy ? 'Saving…' : step === sections.length ? 'Finish profile' : 'Continue'}</button></div>
    </div>}
  </div>;
}

function QuestionField({ question: q, value, onChange }: { question: Question; value: number | number[] | string | undefined; onChange: (value: number | number[] | string) => void }) {
  return <fieldset className="space-y-2 border-b border-[#292929] pb-4 last:border-b-0"><legend className="text-sm font-medium">{q.title}{q.required && <span className="text-[#f7d344]"> *</span>}</legend>{q.help && <p className="text-xs leading-5 text-gray-400">{q.help}</p>}
    {q.kind === 'text' ? <><textarea aria-label={q.title} className={`${input} min-h-28`} value={typeof value === 'string' ? value : ''} maxLength={q.maxChars} onChange={e => onChange(e.target.value)} /><p className="text-xs text-gray-500">{typeof value === 'string' ? value.trim().length : 0} characters · {q.minChars ?? 0} minimum</p></> : q.kind === 'multi' ? <div className="flex flex-wrap gap-2">{q.options?.map((option, index) => { const selected = Array.isArray(value) && value.includes(index); return <button type="button" key={option} aria-pressed={selected} className={selected ? button : subtle} onClick={() => { const old = Array.isArray(value) ? value : []; onChange(selected ? old.filter(item => item !== index) : old.length < 5 ? [...old, index] : old); }}>{option}</button>; })}</div> : q.kind === 'single' ? <div className="flex flex-wrap gap-2">{q.options?.map((option, index) => <button type="button" key={option} aria-pressed={value === index} className={value === index ? button : subtle} onClick={() => onChange(index)}>{option}</button>)}</div> : <div><div className="flex flex-wrap gap-1">{Array.from({ length: (q.max ?? 6) - (q.min ?? 0) + 1 }, (_, index) => index + (q.min ?? 0)).map(number => <button key={number} type="button" aria-label={`${q.title}: ${number}`} aria-pressed={value === number} className={`${value === number ? button : subtle} min-w-10`} onClick={() => onChange(number)}>{number}</button>)}</div><div className="mt-1 flex justify-between text-xs text-gray-500"><span>{q.minLabel}</span><span>{q.maxLabel}</span></div></div>}
  </fieldset>;
}

function Discover({ data, onMessage, onError }: { data: Bootstrap; onMessage: () => void; onError: (s: string) => void }) {
  const [email, setEmail] = useState('');
  const [lookup, setLookup] = useState<{ found: boolean; onboarded: boolean; counterpart?: FounderSummary } | null>(null);
  const [suggestions, setSuggestions] = useState<FounderSummary[]>([]);
  const [report, setReport] = useState<MatchReport | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { founderApi.suggestions().then(result => setSuggestions(result.suggestions.map(s => s.counterpart))).catch(cause => onError(founderError(cause))); }, [onError]);
  async function find() { setBusy(true); onError(''); setReport(null); try { setLookup(await founderApi.lookup(email)); } catch (cause) { onError(founderError(cause)); } finally { setBusy(false); } }
  async function match(uid: string) { setBusy(true); onError(''); try { setReport((await founderApi.match(uid)).report); } catch (cause) { onError(founderError(cause)); } finally { setBusy(false); } }
  async function message(uid: string) { const body = window.prompt('Write an introduction to this founder'); if (!body?.trim()) return; setBusy(true); try { await founderApi.send(uid, body.trim()); onMessage(); } catch (cause) { onError(founderError(cause)); } finally { setBusy(false); } }
  return <div className="space-y-5"><section className={card}><h2 className="font-semibold">Check a founder match</h2><p className="my-2 text-sm text-gray-400">Search by MU email. Both students need a completed Founder Connect profile.</p><form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void find(); }}><input className={`${input} flex-1`} type="email" required placeholder="student@mastersunion.org" value={email} onChange={e => setEmail(e.target.value)} /><button className={button} disabled={busy}>Search</button></form>{lookup && <div className="mt-3 text-sm">{lookup.onboarded && lookup.counterpart ? <FounderRow founder={lookup.counterpart} onMatch={() => match(lookup.counterpart!.uid)} onMessage={() => message(lookup.counterpart!.uid)} busy={busy} /> : <p className="text-gray-400">{lookup.found ? 'This student has started, but has not completed, Founder Connect. Ask them to finish their profile.' : 'No Founder Connect profile yet. Invite them to join MU One and complete onboarding.'}</p>}</div>}</section>
    {report && <MatchPanel report={report} />}
    <section className={card}><h2 className="font-semibold">Potential collaborators</h2><p className="mb-4 mt-1 text-xs text-gray-400">Ranked by skills, working style and shared interests. Scores are prompts for conversation, not guarantees.</p>{suggestions.length ? <div className="space-y-3">{suggestions.map(person => <FounderRow key={person.uid} founder={person} onMatch={() => match(person.uid)} onMessage={() => message(person.uid)} busy={busy} />)}</div> : <p className="text-sm text-gray-400">No open founder profiles yet. More suggestions appear as students join.</p>}</section>
    <p className="text-xs text-gray-500">Your profile: {data.profile?.headline}</p>
  </div>;
}

function FounderRow({ founder, onMatch, onMessage, busy }: { founder: FounderSummary; onMatch: () => void; onMessage: () => void; busy: boolean }) { return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#303030] p-3"><div><p className="font-medium">{founder.displayName}</p><p className="text-xs text-gray-400">{founder.headline}</p><p className="mt-1 text-xs text-gray-500">{founder.topSkills.join(' · ')}</p></div><div className="flex gap-2"><button className={subtle} disabled={busy} onClick={onMessage}>Message</button><button className={button} disabled={busy} onClick={onMatch}>See match</button></div></div>; }
function MatchPanel({ report }: { report: MatchReport }) { return <section className={card}><div className="flex flex-wrap items-baseline gap-3"><strong className="text-3xl text-[#f7d344]">{Math.round(report.score)}%</strong><h2 className="font-semibold">with {report.counterpart.displayName}</h2><span className="text-xs text-gray-400">{report.band} · {report.confidence} confidence</span></div><p className="mt-2 text-xs text-gray-500">Compatibility is an exploratory score, not a prediction of startup success.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{report.components.map(item => <div className="rounded-xl border border-[#303030] p-3" key={item.id}><div className="flex justify-between text-sm"><span>{item.label}</span><span>{Math.round(item.score * 100)}%</span></div><p className="mt-1 text-xs text-gray-400">{item.detail}</p></div>)}</div>{report.strengths.length > 0 && <p className="mt-4 text-sm text-emerald-300">Strengths: {report.strengths.join(' · ')}</p>}{report.frictions.length > 0 && <p className="mt-2 text-sm text-amber-200">Discuss: {report.frictions.join(' · ')}</p>}{report.openQuestions.length > 0 && <ul className="mt-3 list-inside list-disc text-sm text-gray-400">{report.openQuestions.map(q => <li key={q}>{q}</li>)}</ul>}</section>; }

function Community({ data, onError }: { data: Bootstrap; onError: (s: string) => void }) {
  const [kind, setKind] = useState<'all' | 'post' | 'idea' | 'poll'>('all');
  const [mine, setMine] = useState(false);
  const [posts, setPosts] = useState<FounderPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const load = useCallback(async (page?: string | null) => {
    setBusy(true); onError('');
    try { const result = await founderApi.posts({ kind: kind === 'all' ? undefined : kind, mine, cursor: page }); setPosts(old => page ? [...old, ...result.posts] : result.posts); setCursor(result.nextCursor); }
    catch (cause) { onError(founderError(cause)); }
    finally { setBusy(false); }
  }, [kind, mine, onError]);
  useEffect(() => {
    let active = true;
    founderApi.posts({ kind: kind === 'all' ? undefined : kind, mine }).then(result => {
      if (active) { setPosts(result.posts); setCursor(result.nextCursor); }
    }).catch(cause => { if (active) onError(founderError(cause)); });
    return () => { active = false; };
  }, [kind, mine, onError]);
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2">{(['all', 'post', 'idea', 'poll'] as const).map(item => <button key={item} className={kind === item ? button : subtle} onClick={() => setKind(item)}>{item === 'all' ? 'Everything' : item === 'post' ? 'Discussion' : item === 'idea' ? 'Ideas' : 'Polls'}</button>)}</div><button className={subtle} aria-pressed={mine} onClick={() => setMine(!mine)}>{mine ? 'My posts' : 'All posts'}</button><button className={button} onClick={() => setComposing(!composing)}><Plus size={15} className="mr-1 inline" />Post</button></div>
    {composing && <PostComposer data={data} onCancel={() => setComposing(false)} onPosted={() => { setComposing(false); void load(); }} onError={onError} />}
    {posts.map(post => <PostCard key={post.id} post={post} onChanged={() => void load()} onError={onError} />)}
    {!busy && !posts.length && <p className={`${card} text-sm text-gray-400`}>No posts in this view yet. Start a conversation.</p>}
    {cursor && <button className={subtle} onClick={() => void load(cursor)} disabled={busy}>Load more</button>}
  </div>;
}

function PostComposer({ data, onCancel, onPosted, onError }: { data: Bootstrap; onCancel: () => void; onPosted: () => void; onError: (s: string) => void }) {
  const [kind, setKind] = useState<'post' | 'idea' | 'poll'>('post');
  const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const [problem, setProblem] = useState(''); const [stage, setStage] = useState('just_an_idea');
  const [options, setOptions] = useState(['', '']); const [anonymous, setAnonymous] = useState(false);
  const [tags, setTags] = useState<string[]>([]); const [wanted, setWanted] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const tagKeys = data.vocab.interests; const skillKeys = data.vocab.skills;
  async function publish(event: React.FormEvent) { event.preventDefault(); setBusy(true); onError(''); try { await founderApi.createPost({ kind, title, body, anonymous, tags: tags.map(tag => tagKeys.indexOf(tag)), idea: kind === 'idea' ? { problem, stage, lookingFor: wanted.map(skill => skillKeys.indexOf(skill)) } : null, poll: kind === 'poll' ? { options: options.map(s => s.trim()).filter(Boolean), durationDays: 7 } : null }); onPosted(); } catch (cause) { onError(founderError(cause)); } finally { setBusy(false); } }
  return <form className={`${card} space-y-3`} onSubmit={publish}><h2 className="font-semibold">Share with Founder Connect</h2><div className="flex gap-2">{(['post', 'idea', 'poll'] as const).map(value => <button type="button" key={value} aria-pressed={kind === value} className={kind === value ? button : subtle} onClick={() => setKind(value)}>{value === 'post' ? 'Discussion' : value === 'idea' ? 'Idea' : 'Poll'}</button>)}</div><label className="block text-sm">{kind === 'poll' ? 'Question' : 'Title'}<input className={`${input} mt-1`} required minLength={4} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} /></label><label className="block text-sm">Details<textarea className={`${input} mt-1 min-h-24`} required={kind !== 'poll'} minLength={kind === 'poll' ? 0 : 10} maxLength={4000} value={body} onChange={e => setBody(e.target.value)} /></label>
    {kind === 'idea' && <><label className="block text-sm">Problem you are solving<textarea className={`${input} mt-1`} required minLength={20} maxLength={600} value={problem} onChange={e => setProblem(e.target.value)} /></label><label className="block text-sm">Stage<select className={`${input} mt-1`} value={stage} onChange={e => setStage(e.target.value)}>{['just_an_idea', 'validating', 'building', 'launched'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label><p className="text-sm">Skills you need</p><div className="flex flex-wrap gap-2">{skillKeys.map(key => <button key={key} type="button" aria-pressed={wanted.includes(key)} className={wanted.includes(key) ? button : subtle} onClick={() => setWanted(old => old.includes(key) ? old.filter(k => k !== key) : old.length < 4 ? [...old, key] : old)}>{data.labels.skills[key]}</button>)}</div></>}
    {kind === 'poll' && <div className="space-y-2"><p className="text-sm">Options</p>{options.map((option, index) => <input key={index} className={input} aria-label={`Option ${index + 1}`} required maxLength={100} value={option} onChange={e => setOptions(old => old.map((value, i) => i === index ? e.target.value : value))} />)}{options.length < 6 && <button type="button" className={subtle} onClick={() => setOptions(old => [...old, ''])}>Add option</button>}</div>}
    <p className="text-sm">Topics (up to 5)</p><div className="flex max-h-32 flex-wrap gap-2 overflow-auto">{tagKeys.map(key => <button type="button" key={key} aria-pressed={tags.includes(key)} className={tags.includes(key) ? button : subtle} onClick={() => setTags(old => old.includes(key) ? old.filter(k => k !== key) : old.length < 5 ? [...old, key] : old)}>{data.labels.interests[key]}</button>)}</div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} />Post anonymously to other students</label><div className="flex gap-2"><button className={button} disabled={busy}>{busy ? 'Publishing…' : 'Publish'}</button><button type="button" className={subtle} onClick={onCancel}>Cancel</button></div>
  </form>;
}

function PostCard({ post, onChanged, onError }: { post: FounderPost; onChanged: () => void; onError: (s: string) => void }) {
  const [comments, setComments] = useState<FounderComment[] | null>(null); const [reply, setReply] = useState(''); const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  async function action(work: () => Promise<unknown>) { setBusy(true); onError(''); try { await work(); onChanged(); } catch (cause) { onError(founderError(cause)); } finally { setBusy(false); } }
  async function toggleComments() { if (comments) { setComments(null); return; } try { setComments((await founderApi.comments(post.id)).comments); } catch (cause) { onError(founderError(cause)); } }
  return <article className={`${card} space-y-3`}><div className="flex justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-[#f7d344]">{post.kind} · {post.authorName}</p><h2 className="mt-1 text-lg font-semibold">{post.title}</h2><p className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleString()}</p></div>{post.isAuthor && <button className={subtle} disabled={busy} onClick={() => { if (window.confirm('Delete this post?')) void action(() => founderApi.deletePost(post.id)); }}>Delete</button>}</div><p className="whitespace-pre-wrap text-sm leading-6 text-gray-300">{post.body}</p>{post.idea && <div className="rounded-xl border border-[#333] p-3 text-sm"><p className="text-xs text-[#f7d344]">{post.idea.stage.replaceAll('_', ' ')} · needs {post.idea.lookingFor.join(', ') || 'collaborators'}</p><p className="mt-1 text-gray-300">{post.idea.problem}</p></div>}
    {post.poll && <div className="space-y-2">{post.poll.options.map(option => <button key={option.id} disabled={!!post.myVote || busy} onClick={() => void action(() => founderApi.vote(post.id, option.id))} className={`${subtle} flex w-full justify-between text-left`}><span>{option.label}</span><span>{post.myVote ? `${post.poll!.counts[option.id] ?? 0} votes` : ''}</span></button>)}<p className="text-xs text-gray-500">{post.poll.totalVotes} votes · closes {new Date(post.poll.closesAt).toLocaleDateString()}</p></div>}
    <div className="flex flex-wrap gap-2">{post.tags.map(tag => <span key={tag} className="rounded-full bg-[#252525] px-2 py-1 text-xs text-gray-400">{tag}</span>)}</div><div className="flex gap-3 border-t border-[#303030] pt-3"><button className={subtle} aria-pressed={post.likedByMe} disabled={busy} onClick={() => void action(() => founderApi.like(post.id))}><Heart size={14} className="mr-1 inline" />{post.likeCount}</button><button className={subtle} onClick={() => void toggleComments()}><MessageCircle size={14} className="mr-1 inline" />{post.commentCount} comments</button></div>
    {comments && <div className="space-y-3 border-t border-[#303030] pt-3">{comments.map(comment => <p key={comment.id} className="text-sm"><strong className="mr-2">{comment.authorName}</strong><span className="text-gray-300">{comment.body}</span></p>)}<form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void action(async () => { await founderApi.comment(post.id, reply, anonymous); setReply(''); setComments((await founderApi.comments(post.id)).comments); }); }}><input className={`${input} flex-1`} aria-label="Write a comment" required maxLength={2000} value={reply} onChange={e => setReply(e.target.value)} /><label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} /> Anonymous</label><button className={button} disabled={busy}>Reply</button></form></div>}
  </article>;
}

function Inbox({ onError }: { onError: (s: string) => void }) {
  const [threads, setThreads] = useState<FounderThread[]>([]); const [active, setActive] = useState<FounderThread | null>(null);
  const [messages, setMessages] = useState<FounderMessage[]>([]); const [draft, setDraft] = useState(''); const [busy, setBusy] = useState(false);
  const loadThreads = useCallback(async () => { try { setThreads((await founderApi.threads()).threads); } catch (cause) { onError(founderError(cause)); } }, [onError]);
  useEffect(() => {
    let mounted = true;
    founderApi.threads().then(result => { if (mounted) setThreads(result.threads); })
      .catch(cause => { if (mounted) onError(founderError(cause)); });
    return () => { mounted = false; };
  }, [onError]);
  useEffect(() => { if (!active) return; founderApi.messages(active.id).then(result => setMessages(result.messages)).catch(cause => onError(founderError(cause))); void founderApi.read(active.id); }, [active, onError]);
  async function send(e: React.FormEvent) { e.preventDefault(); if (!active) return; setBusy(true); try { await founderApi.send(active.counterpart.uid, draft); setDraft(''); setMessages((await founderApi.messages(active.id)).messages); await loadThreads(); } catch (cause) { onError(founderError(cause)); } finally { setBusy(false); } }
  return <div className="grid min-h-[420px] gap-4 md:grid-cols-[240px_1fr]"><aside className={card}><h2 className="mb-3 font-semibold">Conversations</h2>{threads.length ? threads.map(thread => <button key={thread.id} className={`mb-1 w-full rounded-lg p-2 text-left text-sm ${active?.id === thread.id ? 'bg-[#303030]' : 'hover:bg-[#252525]'}`} onClick={() => setActive(thread)}><span className="font-medium">{thread.counterpart.name}</span>{thread.unread > 0 && <span className="ml-2 text-[#f7d344]">{thread.unread} new</span>}<span className="block truncate text-xs text-gray-500">{thread.lastMessage}</span></button>) : <p className="text-sm text-gray-400">No messages yet. Find someone in Discover to start.</p>}</aside><section className={`${card} flex flex-col`} aria-label="Conversation">{active ? <><h2 className="border-b border-[#303030] pb-3 font-semibold">{active.counterpart.name}</h2><div className="flex-1 space-y-3 overflow-auto py-4">{messages.map(message => <p key={message.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${message.mine ? 'ml-auto bg-[#493c17]' : 'bg-[#262626]'}`}>{message.body}</p>)}</div><form className="flex gap-2" onSubmit={send}><input className={input} aria-label="Message" required maxLength={4000} value={draft} onChange={e => setDraft(e.target.value)} /><button className={button} disabled={busy} aria-label="Send message"><Send size={16} /></button></form></> : <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Select a conversation</div>}</section></div>;
}

function Profile({ data, onUpdate, onError }: { data: Bootstrap; onUpdate: () => Promise<void>; onError: (s: string) => void }) {
  const profile = data.profile;
  if (!profile) return null;
  return <section className={`${card} space-y-4`}><div className="flex items-center gap-3"><Users className="text-[#f7d344]" /><div><h2 className="font-semibold">{profile.displayName}</h2><p className="text-sm text-gray-400">{profile.headline}</p></div></div><div className="flex flex-wrap gap-2">{profile.interests.map(tag => <span className="rounded-full bg-[#292929] px-2 py-1 text-xs" key={tag}>{data.labels.interests[tag] || tag}</span>)}</div><p className="text-sm text-gray-400">Top skills: {profile.topSkills.map(key => data.labels.skills[key] || key).join(' · ')}</p><label className="block text-sm">Who can start a conversation with me?<select className={`${input} mt-2`} value={profile.visibility} onChange={async event => { try { await founderApi.setVisibility(event.target.value as 'open' | 'selective'); await onUpdate(); } catch (cause) { onError(founderError(cause)); } }}><option value="open">Everyone on Founder Connect</option><option value="selective">Only people I have messaged</option></select></label><p className="text-xs text-gray-500">Your questionnaire, statement, imported profile and LinkedIn connection are kept private. Other students only see your summary and compatibility explanation.</p>{data.linkedinConnection && <p className="text-sm text-emerald-300">LinkedIn connected: {data.linkedinConnection.name}</p>}{profile.linkedin && <p className="text-sm text-gray-400">Background source: {profile.linkedin.source === 'pdf' ? 'LinkedIn PDF export' : 'Manual entry'}</p>}</section>;
}
