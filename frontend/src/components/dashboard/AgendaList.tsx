'use client';

import React, { useState } from 'react';
import { Calendar, CalendarDays } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { CalendarEventCard } from '@/components/dashboard/CalendarEventCard';
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
            {displayedEvents.length} event{displayedEvents.length === 1 ? '' : 's'}
          </span>
        </div>

        {beyondThisWeekEvents.length > 0 && (
          <button
            onClick={() => setShowAllScheduled((s) => !s)}
            aria-expanded={showAllScheduled}
            aria-controls="calendar-events-list"
            title={showAllScheduled ? 'Return to this week' : 'Open full calendar'}
            className="flex min-h-10 items-center gap-2 rounded-lg border border-[#3a3420] bg-[#1d1a11] px-3 text-xs font-semibold text-[#f7d344] transition-colors hover:border-[#665a2d] hover:bg-[#242013] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {showAllScheduled ? 'This week' : 'Open full calendar'}
          </button>
        )}
      </div>

      <div id="calendar-events-list" className={`px-4 py-3 overflow-y-auto custom-scrollbar ${showAllScheduled ? 'max-h-[720px]' : 'max-h-[520px]'}`}>
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
                  <div className="space-y-3">
                    {dayEvents.map((ev, idx) => (
                      <CalendarEventCard
                        key={ev.id || ev.googleEventId || ev.iCalUID || `agenda-${idx}-${ev.startIso}`}
                        event={ev}
                      />
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
