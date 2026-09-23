'use client';

import React, { useState } from 'react';
import { ExternalLink, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import type { NormalizedEvent } from '@/types';

const ALL_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

function isUrgent(isoDate: string): boolean {
  const eventDate = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return eventDate <= tomorrow;
}

function formatDeadlineDate(isoDate: string): { day: string; month: string; time: string } {
  const d = new Date(isoDate);
  return {
    day: d.toLocaleDateString('en-GB', { day: '2-digit' }),
    month: d.toLocaleDateString('en-GB', { month: 'short' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

function cleanText(text?: string): string {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}


function DeadlineRow({ event }: { event: NormalizedEvent }) {
  const urgent = isUrgent(event.startIso);
  const { day, month, time } = formatDeadlineDate(event.startIso);
  const title = cleanText(event.title);
  const subject = cleanText(event.subject);

  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-[#1A1A1A] transition-colors">
      {/* Date block */}
      <div
        className={`flex w-10 flex-shrink-0 flex-col items-center rounded border px-1 py-1 ${
          urgent
            ? 'border-red-800/40 bg-red-900/20 text-red-400'
            : 'border-[#2A2A2A] bg-[#1A1A1A] text-gray-400'
        }`}
      >
        <span className="text-[10px] font-semibold uppercase">{month}</span>
        <span className="text-base font-bold leading-none">{day}</span>
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-gray-200">{title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-gray-500">{time}</span>
          {subject && (
            <Badge variant="default">{subject}</Badge>
          )}
          {event.activityType && (
            <Badge variant="accent">{event.activityType}</Badge>
          )}
          {event.calendarName && (
            <span className="text-[10px] text-gray-600">{event.calendarName}</span>
          )}
        </div>
      </div>

      {/* External link */}
      {event.htmlLink && (
        <a
          href={event.htmlLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${event.title} in Google Calendar`}
          className="flex-shrink-0 text-gray-600 hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

export function DeadlinesList() {
  const { dashboardData, loading } = useDashboard();
  const [expanded, setExpanded] = useState(false);

  const allDeadlines = [...(dashboardData?.deadlines ?? [])].sort((a, b) =>
    a.startIso.localeCompare(b.startIso)
  );

  const visible = expanded ? allDeadlines : allDeadlines.slice(0, 8);

  return (
    <div className="flex flex-col h-full max-h-[620px] gap-4">
      {/* ── UPCOMING DEADLINES SECTION ─────────────────────── */}
      <section className="flex flex-1 min-h-0 flex-col rounded-xl border border-[#222] bg-[#161616] overflow-hidden overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 z-10 bg-[#161616] px-5 py-4 border-b border-[#1A1A1A]">
          <h3 className="text-sm font-semibold text-white">Upcoming Deadlines</h3>
        </div>

        <div className="px-2 py-2 space-y-0.5">
          {loading ? (
            <div className="space-y-2 px-3 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-10 w-10 animate-pulse rounded bg-[#2A2A2A]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#2A2A2A]" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-[#222]" />
                  </div>
                </div>
              ))}
            </div>
          ) : allDeadlines.length === 0 ? (
            <EmptyState title="No upcoming deadlines — you're clear" />
          ) : (
            <>
              {visible.map((ev, idx) => (
                <DeadlineRow
                  key={ev.id || ev.googleEventId || ev.iCalUID || `dl-${idx}-${ev.startIso}`}
                  event={ev}
                />
              ))}
              {allDeadlines.length > 8 && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="mt-2 w-full rounded-md py-2 text-center text-xs font-semibold text-gray-500 hover:bg-[#1a1a1a] hover:text-white"
                >
                  {expanded ? 'Show less' : `Show ${allDeadlines.length - 8} more`}
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
