'use client';

import React, { useRef, useState } from 'react';
import { Bold, Italic, Link, List, Paperclip, Trash2, Underline, Upload, X } from 'lucide-react';
import { sendMail, type OutgoingMailAttachment } from '@/lib/functions';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface ComposeMailModalProps { onClose: () => void; }
interface LocalAttachment extends OutgoingMailAttachment { size: number; }

const MAX_RECIPIENTS = 100;
const MAX_SUBJECT = 250;
const MAX_BODY = 10000;
const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;

function parseRecipients(value: string): string[] {
  return [...new Set(value.split(/[;,\n]/).map(item => item.trim()).filter(Boolean))];
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseCsvRow(row: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    if (char === '"' && quoted && row[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { values.push(value.trim()); value = ''; }
    else value += char;
  }
  values.push(value.trim());
  return values;
}

export function emailsFromCsv(csv: string): string[] {
  const rows = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter(row => row.trim());
  if (!rows.length) return [];
  const headers = parseCsvRow(rows[0]).map(value => value.toLowerCase());
  const emailIndex = headers.findIndex(value => ['email', 'recipient', 'to', 'email_address'].includes(value));
  if (emailIndex < 0) return [];
  return [...new Set(rows.slice(1).map(row => parseCsvRow(row)[emailIndex]?.trim()).filter(value => value && isValidEmail(value)))];
}

function readableError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Email could not be sent.';
  return raw
    .replace(/^FirebaseError:\s*/i, '')
    .replace(/^\[functions\/[^\]]+\]\s*/i, '')
    .replace(/\s*\[400\]\s*$/i, '')
    .replace(/^recipients must be a non-empty array\.?$/i, 'Add at least one valid recipient before sending.');
}

async function fileToAttachment(file: File): Promise<LocalAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
  return { filename: file.name, mimeType: file.type || 'application/octet-stream', dataBase64: dataUrl.split(',')[1] ?? '', size: file.size };
}

export function ComposeMailModal({ onClose }: ComposeMailModalProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const syncEditor = () => {
    const editor = editorRef.current;
    setBodyText(editor?.innerText.trim() ?? '');
    setBodyHtml(editor?.innerHTML ?? '');
    setError('');
  };

  const format = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditor();
  };

  const addLink = () => {
    const url = window.prompt('Paste the link URL');
    if (url && /^https?:\/\//i.test(url)) format('createLink', url);
  };

  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const emails = emailsFromCsv(await file.text());
    if (!emails.length) { setError('CSV needs an “email” column with at least one valid address.'); return; }
    const combined = [...new Set([...parseRecipients(to), ...emails])].slice(0, MAX_RECIPIENTS);
    setTo(combined.join(', '));
    setBulkMode(true);
    setError('');
  };

  const addAttachments = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    const total = attachments.reduce((sum, item) => sum + item.size, 0) + files.reduce((sum, file) => sum + file.size, 0);
    if (attachments.length + files.length > 10) { setError('You can attach up to 10 files.'); return; }
    if (total > MAX_ATTACHMENT_BYTES) { setError('Attachments must total 6 MB or less.'); return; }
    try {
      const converted = await Promise.all(files.map(fileToAttachment));
      setAttachments(current => [...current, ...converted]);
      setError('');
    }
    catch (attachmentError) { setError(readableError(attachmentError)); }
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const recipients = parseRecipients(to);
    if (!recipients.length) { setError('Add at least one recipient.'); return; }
    if (recipients.length > MAX_RECIPIENTS) { setError(`A bulk send can include up to ${MAX_RECIPIENTS} recipients.`); return; }
    if (recipients.some(recipient => !isValidEmail(recipient))) { setError('One or more recipient addresses are invalid.'); return; }
    if (!subject.trim()) { setError('Add a subject.'); return; }
    if (!bodyText) { setError('Write a message before sending.'); return; }

    setError('');
    setSubmitting(true);
    try {
      const result = await sendMail({ recipients, subject: subject.trim(), body: bodyText.slice(0, MAX_BODY), html: bodyHtml, attachments: attachments.map(({ filename, mimeType, dataBase64 }) => ({ filename, mimeType, dataBase64 })), bulkMode: bulkMode || recipients.length > 20 });
      setSuccess(result.sentCount && result.sentCount > 1 ? `${result.sentCount} emails sent.` : 'Email sent.');
      window.setTimeout(onClose, 1400);
    } catch (sendError) { setError(readableError(sendError)); }
    finally { setSubmitting(false); }
  }

  return <>
    <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} aria-hidden="true" />
    <div role="dialog" aria-modal="true" aria-label="Compose email" className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#303030] bg-[#161616] shadow-2xl custom-scrollbar">
        <div className="flex items-center justify-between border-b border-[#242424] px-5 py-4"><div><h2 className="text-sm font-semibold text-white">Compose Email</h2><p className="mt-0.5 text-[11px] text-gray-500">Rich formatting, attachments and CSV bulk sending</p></div><button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded text-gray-500 hover:bg-[#222] hover:text-white"><X className="h-4 w-4" /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="flex rounded-lg border border-[#303030] bg-[#101010] p-1"><button type="button" onClick={() => setBulkMode(false)} aria-pressed={!bulkMode} className={`h-7 flex-1 rounded-md text-xs ${!bulkMode ? 'bg-[#292929] text-white' : 'text-gray-500'}`}>Single / group</button><button type="button" onClick={() => setBulkMode(true)} aria-pressed={bulkMode} className={`h-7 flex-1 rounded-md text-xs ${bulkMode ? 'bg-[#292929] text-white' : 'text-gray-500'}`}>Individual bulk</button></div>

          <div><div className="mb-1 flex items-center justify-between"><label htmlFor="mail-to" className="text-xs font-medium text-gray-400">To <span className="text-red-400">*</span></label><div className="flex items-center gap-2"><a href="/templates/bulk-email-sample.csv" download className="text-[10px] text-gray-500 hover:text-[#f7d344] hover:underline">Sample CSV</a><label className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-medium text-[#d8bd4d] hover:text-[#f7d344]"><Upload className="h-3 w-3" />Import CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} className="sr-only" /></label></div></div><textarea id="mail-to" value={to} onChange={event => { setTo(event.target.value); setError(''); }} rows={2} placeholder="student@mastersunion.org, ..." className="w-full resize-none rounded-md border border-[#303030] bg-[#1a1a1a] px-3 py-2 text-sm text-gray-200 outline-none focus:border-[#f7d344]" /><p className="mt-1 text-right text-[10px] text-gray-600">{parseRecipients(to).length}/{MAX_RECIPIENTS} recipients</p></div>

          <div><label htmlFor="mail-subject" className="mb-1 block text-xs font-medium text-gray-400">Subject <span className="text-red-400">*</span></label><input id="mail-subject" value={subject} maxLength={MAX_SUBJECT} onChange={event => { setSubject(event.target.value); setError(''); }} className="h-10 w-full rounded-md border border-[#303030] bg-[#1a1a1a] px-3 text-sm text-gray-200 outline-none focus:border-[#f7d344]" /></div>

          <div><span className="mb-1 block text-xs font-medium text-gray-400">Message <span className="text-red-400">*</span></span><div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-[#303030] bg-[#111] p-1.5">{[[Bold, 'bold', 'Bold'], [Italic, 'italic', 'Italic'], [Underline, 'underline', 'Underline'], [List, 'insertUnorderedList', 'Bulleted list']].map(([Icon, command, label]) => { const ToolIcon = Icon as typeof Bold; return <button key={String(command)} type="button" onClick={() => format(String(command))} aria-label={String(label)} className="grid h-8 w-8 place-items-center rounded text-gray-400 hover:bg-[#292929] hover:text-white"><ToolIcon className="h-3.5 w-3.5" /></button>; })}<button type="button" onClick={addLink} aria-label="Insert link" className="grid h-8 w-8 place-items-center rounded text-gray-400 hover:bg-[#292929] hover:text-white"><Link className="h-3.5 w-3.5" /></button></div><div className="relative"><div ref={editorRef} role="textbox" aria-label="Body" aria-multiline="true" contentEditable suppressContentEditableWarning onInput={syncEditor} className="min-h-44 rounded-b-md border border-[#303030] bg-[#1a1a1a] px-3 py-3 text-sm leading-6 text-gray-200 outline-none focus:border-[#f7d344]" />{!bodyText && <span className="pointer-events-none absolute left-3 top-3 text-sm text-gray-600">Write your email…</span>}</div><p className="mt-1 text-right text-[10px] text-gray-600">{bodyText.length}/{MAX_BODY}</p></div>

          <div><input ref={attachmentInputRef} type="file" multiple onChange={addAttachments} className="hidden" /><button type="button" onClick={() => attachmentInputRef.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#333] px-3 text-xs text-gray-300 hover:bg-[#222]"><Paperclip className="h-3.5 w-3.5" />Attach files</button>{attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{attachments.map((attachment, index) => <span key={`${attachment.filename}-${index}`} className="inline-flex items-center gap-2 rounded-md bg-[#222] px-2 py-1 text-[11px] text-gray-300"><span className="max-w-40 truncate">{attachment.filename}</span><button type="button" onClick={() => setAttachments(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${attachment.filename}`} className="text-gray-600 hover:text-red-400"><Trash2 className="h-3 w-3" /></button></span>)}</div>}</div>

          {error && <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300" role="alert">{error}</p>}
          {success && <p className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300" role="status">{success}</p>}
          <button type="submit" disabled={submitting || Boolean(success)} className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#f7d344] text-sm font-semibold text-black hover:bg-[#ffe36c] disabled:opacity-50">{submitting && <LoadingSpinner size="sm" />}{submitting ? 'Sending…' : bulkMode ? 'Send individual emails' : 'Send Email'}</button>
        </form>
      </div>
    </div>
  </>;
}
