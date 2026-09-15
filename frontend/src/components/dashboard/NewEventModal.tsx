'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { createCalendarEvent } from '@/lib/functions';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface NewEventModalProps {
  onClose: () => void;
}

export function NewEventModal({ onClose }: NewEventModalProps) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Close on Escape
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setError('Title is required'); return; }
    if (!start) { setError('Start time is required'); return; }
    if (!end) { setError('End time is required'); return; }
    if (new Date(end) <= new Date(start)) { setError('End must be after start'); return; }

    setError('');
    setSubmitting(true);
    try {
      await createCalendarEvent({
        title: trimmedTitle,
        start,
        end,
        description: description.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
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
        aria-label="New calendar event"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="w-full max-w-md rounded-xl border border-[#2A2A2A] bg-[#161616] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1A1A1A] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">New Event</h2>
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
              <label htmlFor="event-title" className="block text-xs font-medium text-gray-400 mb-1">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                id="event-title"
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(''); }}
                placeholder="Event title"
                className="w-full rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-start" className="block text-xs font-medium text-gray-400 mb-1">
                  Start <span className="text-red-400">*</span>
                </label>
                <input
                  id="event-start"
                  type="datetime-local"
                  value={start}
                  onChange={(e) => { setStart(e.target.value); setError(''); }}
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344] [color-scheme:dark]"
                />
              </div>
              <div>
                <label htmlFor="event-end" className="block text-xs font-medium text-gray-400 mb-1">
                  End <span className="text-red-400">*</span>
                </label>
                <input
                  id="event-end"
                  type="datetime-local"
                  value={end}
                  onChange={(e) => { setEnd(e.target.value); setError(''); }}
                  className="w-full rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344] [color-scheme:dark]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="event-desc" className="block text-xs font-medium text-gray-400 mb-1">
                Description (optional)
              </label>
              <textarea
                id="event-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
              />
            </div>

            {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
            {success && <p className="text-xs text-green-400">Event created!</p>}

            <button
              type="submit"
              disabled={submitting || success}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[#f7d344] py-2.5 text-sm font-semibold text-black disabled:opacity-50 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
            >
              {submitting ? <LoadingSpinner size="sm" /> : null}
              {success ? 'Created!' : submitting ? 'Creating…' : 'Create Event'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
