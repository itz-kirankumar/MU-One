'use client';

import { useState } from 'react';
import { Copy, Inbox, RefreshCw } from 'lucide-react';
import { testmailApi, testmailError, type TestmailMessage } from '@/lib/testmail';
import { formatMailDueDate } from '@/lib/mailUtils';

const tagPattern = /^[a-zA-Z0-9_-]{1,100}$/;

export function TestmailLab() {
  const [tag, setTag] = useState('mu-one');
  const [address, setAddress] = useState('');
  const [messages, setMessages] = useState<TestmailMessage[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load(nextOffset = 0, wait = false) {
    if (!tagPattern.test(tag)) { setError('Use only letters, numbers, hyphens, or underscores in the tag.'); return; }
    setBusy(true); setError('');
    try {
      const [destination, inbox] = await Promise.all([
        testmailApi.address(tag),
        testmailApi.list({ tag, offset: nextOffset, limit: 20, liveQuery: wait }),
      ]);
      setAddress(destination.address); setMessages(inbox.messages); setCount(inbox.count); setOffset(inbox.offset);
    } catch (err) { setError(testmailError(err)); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <header><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f7d344]">Admin · Email QA</p><h1 className="mt-3 text-3xl font-semibold">Test the inbox. Trust the parser.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">Send test mail to a tagged Testmail address, then inspect exactly what MU One extracts, including due dates.</p></header>
    <section className="space-y-4 rounded-2xl border border-[#292929] bg-[#161616] p-5 sm:p-6">
      <div className="flex flex-wrap items-end gap-3"><label className="min-w-52 flex-1 space-y-2 text-sm"><span>Inbox tag</span><input value={tag} onChange={event => setTag(event.target.value)} maxLength={100} className="w-full rounded-xl border border-[#333] bg-[#111] px-3 py-2.5" /></label><button disabled={busy} onClick={() => load(0)} className="rounded-xl bg-[#f7d344] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">Open inbox</button><button disabled={busy} onClick={() => load(0, true)} title="Wait for a new message" className="rounded-xl border border-[#333] p-3 disabled:opacity-50"><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /></button></div>
      {address && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#0d0d0d] p-4"><div><p className="text-xs text-gray-500">Send test emails to</p><code className="mt-1 block break-all text-sm text-[#f7d344]">{address}</code></div><button onClick={() => navigator.clipboard.writeText(address)} className="flex items-center gap-2 rounded-lg border border-[#333] px-3 py-2 text-xs"><Copy size={14} /> Copy</button></div>}
      <p className="text-xs leading-5 text-gray-500">Testmail messages are temporary. Do not send production data, passwords, or personal information to this inbox.</p>
    </section>
    {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
    {!busy && !error && messages.length === 0 && <div className="rounded-2xl border border-dashed border-[#383838] py-14 text-center"><Inbox className="mx-auto mb-3 text-gray-500" /><h2 className="font-semibold">{address ? 'No messages for this tag' : 'Open a test inbox'}</h2><p className="mt-2 text-sm text-gray-500">{address ? 'Send an email to the address above, then wait for the next message.' : 'Choose a tag and open its inbox to start testing.'}</p></div>}
    <div className="space-y-3">{messages.map(message => <details key={message.id || `${message.receivedAt}-${message.subject}`} className="rounded-2xl border border-[#292929] bg-[#161616] p-5"><summary className="cursor-pointer list-none"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold">{message.subject || '(No subject)'}</h2><p className="mt-1 break-all text-xs text-gray-500">{message.from || 'Unknown sender'} · {new Date(message.receivedAt).toLocaleString('en-IN')}</p></div>{message.dueDate && <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-300">Due {formatMailDueDate(message.dueDate)}</span>}</div></summary><div className="mt-5 border-t border-[#292929] pt-5"><p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-300">{message.text || 'No text body.'}</p>{message.attachments.length > 0 && <p className="mt-4 text-xs text-gray-500">{message.attachments.length} attachment{message.attachments.length === 1 ? '' : 's'}: {message.attachments.map(file => file.filename || 'unnamed').join(', ')}</p>}</div></details>)}</div>
    {count > 20 && <div className="flex items-center justify-between text-sm"><button disabled={busy || offset === 0} onClick={() => load(Math.max(0, offset - 20))} className="rounded-lg border border-[#333] px-4 py-2 disabled:opacity-30">Previous</button><span className="text-gray-500">{offset + 1}–{Math.min(offset + messages.length, count)} of {count}</span><button disabled={busy || offset + 20 >= count} onClick={() => load(offset + 20)} className="rounded-lg border border-[#333] px-4 py-2 disabled:opacity-30">Next</button></div>}
  </div>;
}
