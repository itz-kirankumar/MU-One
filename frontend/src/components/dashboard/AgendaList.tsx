'use client';

import React from 'react';
import { ExternalLink, Calendar } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { EmptyState } from '@/components/ui/EmptyState';
import type { NormalizedEvent } from '@/types';

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

  // Non-deadline events, sorted chronologically
  const rawEvents = dashboardData?.events ?? (dashboardData as { agenda?: NormalizedEvent[] })?.agenda ?? [];
  const events = [...rawEvents]
    .filter((e) => !e.isDeadline)
    .sort((a, b) => a.startIso.localeCompare(b.startIso));

  const grouped = groupByDate(events);
  const dateKeys = [...grouped.keys()].sort();

  return (
    <section className="rounded-xl border border-[#222] bg-[#161616] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1A1A1A]">
        <h3 className="text-sm font-semibold text-white">This Week</h3>
      </div>

      <div className="px-4 py-2">
        {loading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-[#2A2A2A]" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No upcoming events"
            description="Calendar events will appear here once synced"
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
    </section>
  );
}
