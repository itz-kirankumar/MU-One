'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { sendMail } from '@/lib/functions';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface ComposeMailModalProps {
  onClose: () => void;
}

const MAX_RECIPIENTS = 20;
const MAX_SUBJECT = 250;
const MAX_BODY = 10000;

function parseRecipients(str: string): string[] {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ComposeMailModal({ onClose }: ComposeMailModalProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const recipients = parseRecipients(to);

    if (recipients.length === 0) { setError('At least one recipient is required'); return; }
    if (recipients.length > MAX_RECIPIENTS) { setError(`Maximum ${MAX_RECIPIENTS} recipients allowed`); return; }
    if (recipients.some((r) => !isValidEmail(r))) { setError('One or more email addresses are invalid'); return; }
    if (!subject.trim()) { setError('Subject is required'); return; }
    if (subject.length > MAX_SUBJECT) { setError(`Subject must be ${MAX_SUBJECT} characters or fewer`); return; }
    if (!body.trim()) { setError('Body is required'); return; }
    if (body.length > MAX_BODY) { setError(`Body must be ${MAX_BODY} characters or fewer`); return; }

    setError('');
    setSubmitting(true);
    try {
      await sendMail({ to: recipients.join(','), subject: subject.trim(), body: body.trim() });
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compose email"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md rounded-xl border border-[#2A2A2A] bg-[#161616] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1A1A1A] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Compose Email</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="px-5 py-4 space-y-3">
            <div>
              <label htmlFor="mail-to" className="block text-xs font-medium text-gray-400 mb-1">
                To <span className="text-red-400">*</span>
                <span className="ml-1 text-gray-600 font-normal">(comma-separated)</span>
              </label>
              <input
                id="mail-to"
                type="text"
                value={to}
                onChange={(e) => { setTo(e.target.value); setError(''); }}
                placeholder="student@mastersunion.org, ..."
                className="w-full rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
              />
            </div>

            <div>
              <label htmlFor="mail-subject" className="block text-xs font-medium text-gray-400 mb-1">
                Subject <span className="text-red-400">*</span>
              </label>
              <input
                id="mail-subject"
                type="text"
                value={subject}
                maxLength={MAX_SUBJECT}
                onChange={(e) => { setSubject(e.target.value); setError(''); }}
                className="w-full rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
              />
              <p className="mt-0.5 text-right text-[10px] text-gray-600">
                {subject.length}/{MAX_SUBJECT}
              </p>
            </div>

            <div>
              <label htmlFor="mail-body" className="block text-xs font-medium text-gray-400 mb-1">
                Body <span className="text-red-400">*</span>
              </label>
              <textarea
                id="mail-body"
                value={body}
                maxLength={MAX_BODY}
                onChange={(e) => { setBody(e.target.value); setError(''); }}
                rows={6}
                className="w-full resize-none rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
              />
              <p className="mt-0.5 text-right text-[10px] text-gray-600">
                {body.length}/{MAX_BODY}
              </p>
            </div>

            {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
            {success && <p className="text-xs text-green-400">Email sent!</p>}

            <button
              type="submit"
              disabled={submitting || success}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[#f7d344] py-2.5 text-sm font-semibold text-black disabled:opacity-50 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
            >
              {submitting ? <LoadingSpinner size="sm" /> : null}
              {success ? 'Sent!' : submitting ? 'Sending…' : 'Send Email'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
