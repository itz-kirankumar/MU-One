'use client';

import { CalendarPlus, ExternalLink, MapPin, Video } from 'lucide-react';
import { getCalendarEventDetails, NOT_PROVIDED } from '@/lib/calendarEventDetails';
import type { NormalizedEvent } from '@/types';

interface CalendarEventCardProps {
  event: NormalizedEvent;
  onAddTask?: () => void;
}

const detailItems = (
  details: ReturnType<typeof getCalendarEventDetails>
): Array<[string, string]> => [
  ['Course', details.course],
  ['Date', details.date],
  ['Time', details.time],
  ['Venue', details.venue],
  ['Faculty / host', details.faculty],
  ['Calendar', details.source],
];

export function CalendarEventCard({ event, onAddTask }: CalendarEventCardProps) {
  const details = getCalendarEventDetails(event);

  return (
    <article className="rounded-xl border border-[#292929] bg-[#121212] p-4 transition-colors hover:border-[#3a3a3a]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f7d344]">
            {details.activity}
          </p>
          <h4 className="mt-1 break-words text-sm font-semibold leading-5 text-white">
            {details.title}
          </h4>
        </div>
        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${details.title} in Google Calendar`}
            title="Open in Google Calendar"
            className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-[#303030] text-gray-400 hover:border-[#555] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>

      <dl className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {detailItems(details).map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</dt>
            <dd className={`mt-0.5 break-words text-xs leading-5 ${value === NOT_PROVIDED ? 'text-gray-600' : 'text-gray-300'}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {(details.meetingLink || onAddTask) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#242424] pt-3">
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
          {onAddTask && (
            <button
              type="button"
              onClick={onAddTask}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#1E3A6B] bg-[#0D1E3A] px-3 text-xs font-semibold text-[#60A5FA] hover:bg-[#152B52] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Add to tasks
            </button>
          )}
        </div>
      )}
    </article>
  );
}

