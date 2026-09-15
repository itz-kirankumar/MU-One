'use client';

import React, { useState } from 'react';
import { ExternalLink, Calendar, CalendarClock, ChevronDown } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { EmptyState } from '@/components/ui/EmptyState';
import type { NormalizedEvent } from '@/types';

function getLocalDateIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
}

function getEndOfWeekIso(d: Date = new Date()): string {
  const current = new Date(d);
  const day = current.getDay(); // 0 is Sunday, 1 is Monday, ...
  const daysToSunday = day === 0 ? 0 : 7 - day;
  const sunday = new Date(current);
  sunday.setDate(current.getDate() + daysToSunday);
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, '0');
  const date = String(sunday.getDate()).padStart(2, '0');
  return `${y}-${m}-${date}`;
}

function groupByDate(events: NormalizedEvent[]): Map<string, NormalizedEvent[]> {
  const map = new Map<string, NormalizedEvent[]>();
  for (const ev of events) {
    const dateKey = ev.startIso.slice(0, 10); // YYYY-MM-DD
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey)!.push(ev);
  }
  return map;
}

function formatGroupDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

function formatEventTime(isoStart: string, isoEnd?: string, allDay?: boolean): string {
  if (allDay) return 'All day';
  const start = new Date(isoStart).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (!isoEnd) return start;
  const end = new Date(isoEnd).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${start} – ${end}`;
}

export function AgendaList() {
  const { dashboardData, loading } = useDashboard();
  const [showAllScheduled, setShowAllScheduled] = useState(false);

  const todayStr = getLocalDateIso();
  const endOfWeekStr = getEndOfWeekIso();

  // Non-deadline events from today onwards, sorted chronologically
  const rawEvents = dashboardData?.events ?? (dashboardData as { agenda?: NormalizedEvent[] })?.agenda ?? [];
  const upcomingEvents = [...rawEvents]
    .filter((e) => !e.isDeadline && (e.startIso.slice(0, 10) >= todayStr || !e.startIso.includes('-')))
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  // Events strictly for this week (from today through Sunday of current week)
  const thisWeekEvents = upcomingEvents.filter(
    (e) => e.startIso.slice(0, 10) <= endOfWeekStr
  );

  // Events beyond this week (ongoing planned scheduled)
  const beyondThisWeekEvents = upcomingEvents.filter(
    (e) => e.startIso.slice(0, 10) > endOfWeekStr
  );

  const displayedEvents = showAllScheduled ? upcomingEvents : thisWeekEvents;
  const grouped = groupByDate(displayedEvents);
  const dateKeys = [...grouped.keys()].sort();

  return (
    <section className="rounded-xl border border-[#222] bg-[#161616] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1A1A1A] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-semibold text-white">This Week</h3>
          <span className="text-[10px] text-gray-400 bg-[#202020] px-2 py-0.5 rounded border border-[#2A2A2A]">
            {showAllScheduled ? 'All Planned & Scheduled' : 'This Week Only'}
          </span>
        </div>

        {beyondThisWeekEvents.length > 0 && (
          <button
            onClick={() => setShowAllScheduled((s) => !s)}
            title={showAllScheduled ? 'Show only this week' : 'See more ongoing planned scheduled'}
            className="flex items-center gap-1.5 text-xs text-[#f7d344] hover:text-yellow-300 px-2.5 py-1 rounded hover:bg-[#202020] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
          >
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">
              {showAllScheduled ? 'This week only' : `+${beyondThisWeekEvents.length} more scheduled`}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                showAllScheduled ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      <div className="px-4 py-2 max-h-[380px] overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-[#2A2A2A]" />
            ))}
          </div>
        ) : displayedEvents.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={showAllScheduled ? "No scheduled events" : "No upcoming events this week"}
            description={
              beyondThisWeekEvents.length > 0 && !showAllScheduled
                ? `You have ${beyondThisWeekEvents.length} events scheduled in upcoming weeks. Click above to view.`
                : "Calendar events will appear here once synced"
            }
          />
        ) : (
          <div className="divide-y divide-[#1A1A1A]">
            {dateKeys.map((dateKey) => {
              const dayEvents = grouped.get(dateKey)!;
              return (
                <div key={dateKey} className="py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                    {formatGroupDate(dateKey)}
                  </p>
                  <div className="space-y-1">
                    {dayEvents.map((ev, idx) => (
                      <div
                        key={ev.id || ev.googleEventId || ev.iCalUID || `agenda-${idx}-${ev.startIso}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#1A1A1A] transition-colors"
                      >
                        {/* Time chip */}
                        <span className="min-w-[90px] text-right text-[11px] tabular-nums text-gray-500">
                          {formatEventTime(ev.startIso, ev.endIso, ev.allDay)}
                        </span>
                        {/* Dot */}
                        <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#f7d344]" />
                        {/* Title */}
                        <span className="flex-1 truncate text-sm text-gray-200">
                          {ev.title.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
                        </span>
                        {/* Source */}
                        {ev.calendarName && (
                          <span className="hidden sm:block text-[10px] text-gray-600 truncate max-w-[100px]">
                            {ev.calendarName}
                          </span>
                        )}
                        {/* External link */}
                        {ev.htmlLink && (
                          <a
                            href={ev.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open ${ev.title} in calendar`}
                            className="text-gray-600 hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
                          >
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {beyondThisWeekEvents.length > 0 && (
        <button
          onClick={() => setShowAllScheduled((s) => !s)}
          className="w-full py-2.5 px-4 text-center text-xs font-medium text-amber-400/90 hover:text-amber-300 hover:bg-[#1A1A1A] transition-colors flex items-center justify-center gap-2 border-t border-[#1A1A1A]"
        >
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {showAllScheduled
              ? 'Collapse to this week only'
              : `See ${beyondThisWeekEvents.length} more ongoing scheduled events`}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${
              showAllScheduled ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      )}
    </section>
  );
}
