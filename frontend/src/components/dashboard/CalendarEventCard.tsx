'use client';

import { CalendarPlus, Clock3, ExternalLink, MapPin, Video } from 'lucide-react';
import { getCalendarEventDetails } from '@/lib/calendarEventDetails';
import { ExpandableText } from '@/components/dashboard/ExpandableText';
import type { NormalizedEvent } from '@/types';

interface CalendarEventCardProps {
  event: NormalizedEvent;
  onAddTask?: () => void;
}

export function CalendarEventCard({ event, onAddTask }: CalendarEventCardProps) {
  const details = getCalendarEventDetails(event);

  const direct = String(event.sectionCode || '').trim().toUpperCase();
  let section = null;
  if (/^[A-H]$/.test(direct)) {
    section = direct;
  } else {
    const label = String(event.sectionLabel || '').match(/\b(?:section|sec)\s*[-:#]?\s*([A-H]|[1-8])\b/i)?.[1];
    if (label) {
      section = /^\d$/.test(label) ? String.fromCharCode(64 + Number(label)) : label.toUpperCase();
    } else {
      const legacy = Number(event.sectionNumber);
      if (legacy >= 1 && legacy <= 8) section = String.fromCharCode(64 + legacy);
    }
  }

  return (
    <article className="rounded-xl border border-[#36311f] bg-[#15140f] p-3 transition-colors hover:border-[#64582a]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="break-words text-[10px] font-semibold uppercase tracking-[0.1em] text-[#f7d344]">
              {details.course}
            </p>
            {section && <span className="text-[10px] font-medium text-gray-500">Section {section}</span>}
          </div>
          <h4 className="mt-1 break-words text-sm font-semibold leading-5 text-white">
            {details.title}
          </h4>
        </div>
        <span className="shrink-0 rounded-lg border border-[#4a4020] bg-[#302a15] px-2 py-1 text-[10px] font-semibold text-[#f7d344]">
          {details.venueLabel}
        </span>
      </div>

      <ExpandableText text={details.description} className="mt-2 text-xs leading-5 text-gray-400" />

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

      {(onAddTask || details.meetingLink || event.htmlLink) && <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[#2a281f] pt-2">
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
        {details.meetingLink && <a href={details.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-gray-300 hover:bg-[#242424] hover:text-white"><Video className="h-3 w-3" aria-hidden="true" />Join</a>}
        {event.htmlLink && <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-gray-300 hover:bg-[#242424] hover:text-white"><ExternalLink className="h-3 w-3" aria-hidden="true" />Calendar</a>}
      </div>}
    </article>
  );
}
