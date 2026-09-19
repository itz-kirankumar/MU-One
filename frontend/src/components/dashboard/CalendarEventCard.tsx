'use client';

import { useId, useState } from 'react';
import { CalendarPlus, ChevronDown, Clock3, ExternalLink, MapPin, Video } from 'lucide-react';
import { getCalendarEventDetails } from '@/lib/calendarEventDetails';
import type { NormalizedEvent } from '@/types';

interface CalendarEventCardProps {
  event: NormalizedEvent;
  onAddTask?: () => void;
}

export function CalendarEventCard({ event, onAddTask }: CalendarEventCardProps) {
  const details = getCalendarEventDetails(event);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  return (
    <article className="rounded-xl border border-[#36311f] bg-[#15140f] p-3 transition-colors hover:border-[#64582a]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-[10px] font-semibold uppercase tracking-[0.1em] text-[#f7d344]">
            {details.course}
          </p>
          <h4 className="mt-1 break-words text-sm font-semibold leading-5 text-white">
            {details.title}
          </h4>
        </div>
        <span className="shrink-0 rounded-lg border border-[#4a4020] bg-[#302a15] px-2 py-1 text-[10px] font-semibold text-[#f7d344]">
          {details.venueLabel}
        </span>
      </div>

      <p className="mt-2 line-clamp-1 text-xs leading-5 text-gray-400" title={details.description}>
        {details.description}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-md bg-[#292824] px-2 text-[11px] text-gray-300">
          <MapPin className="h-3 w-3 text-gray-500" aria-hidden="true" />
          {details.venue}
        </span>
        <span className="inline-flex min-h-7 items-center gap-1.5 rounded-md bg-[#292824] px-2 text-[11px] tabular-nums text-gray-300">
          <Clock3 className="h-3 w-3 text-gray-500" aria-hidden="true" />
          {details.time}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[#2a281f] pt-2">
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-[#f7d344] hover:bg-[#242116] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
        >
          {expanded ? 'Show less' : 'Show more'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {onAddTask && (
          <button
            type="button"
            onClick={onAddTask}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#1E3A6B] bg-[#0D1E3A] px-2 text-[11px] font-semibold text-[#60A5FA] hover:bg-[#152B52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Add to tasks
          </button>
        )}
      </div>

      {expanded && (
        <div id={detailsId} className="mt-2 rounded-lg border border-[#2e2b20] bg-[#11110e] p-3">
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <div><dt className="font-medium uppercase tracking-wide text-gray-500">Date</dt><dd className="mt-1 text-gray-300">{details.date}</dd></div>
            <div><dt className="font-medium uppercase tracking-wide text-gray-500">Calendar</dt><dd className="mt-1 break-words text-gray-300">{details.source}</dd></div>
            <div className="sm:col-span-2"><dt className="font-medium uppercase tracking-wide text-gray-500">Description</dt><dd className="mt-1 whitespace-pre-wrap break-words leading-5 text-gray-300">{details.description}</dd></div>
          </dl>
          {(details.meetingLink || event.htmlLink) && <div className="mt-4 flex flex-wrap gap-2">
          {details.meetingLink && (
            <a
              href={details.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#333] px-3 text-xs font-medium text-gray-200 hover:border-[#555] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
            >
              {details.venue === 'Online' ? <Video className="h-3.5 w-3.5" aria-hidden="true" /> : <MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
              Join session
            </a>
          )}
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#333] px-3 text-xs font-medium text-gray-200 hover:border-[#555] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Open in Google Calendar
            </a>
          )}
          </div>}
        </div>
      )}
    </article>
  );
}
