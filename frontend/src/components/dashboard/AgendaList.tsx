'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CalendarRange, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { CalendarEventCard } from '@/components/dashboard/CalendarEventCard';
import { ExpandableText } from '@/components/dashboard/ExpandableText';
import { getCalendarEventDetails } from '@/lib/calendarEventDetails';
import { subscribeToSharedTimetable } from '@/lib/firestore';
import type { NormalizedEvent } from '@/types';

type CalendarView = 'day' | 'week' | 'month' | 'timeline' | 'range';
const VIEW_KEY = 'muone.calendarView';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SECTIONS = Array.from({ length: 10 }, (_, index) => index + 1);

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromDateKey(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function eventKey(event: NormalizedEvent, index = 0): string {
  return event.googleEventId || event.iCalUID || event.id || `${event.startIso}-${index}`;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

function calendarDays(selected: Date, view: CalendarView): Date[] {
  if (view === 'day') return [new Date(selected)];
  if (view === 'week') {
    const start = startOfWeek(selected);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const daysInMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((first.getDay() + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => addDays(gridStart, index));
}

function shortDate(date: Date, withYear = false): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
}

function headerLabel(date: Date, view: CalendarView, rangeStart: string, rangeEnd: string): string {
  if (view === 'range') return `${shortDate(fromDateKey(rangeStart))} – ${shortDate(fromDateKey(rangeEnd), true)}`;
  if (view === 'day') return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (view === 'week') {
    const start = startOfWeek(date);
    return `${shortDate(start)} – ${shortDate(addDays(start, 6), true)}`;
  }
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function timelineDateLabel(value: string): { day: string; date: string } {
  const date = fromDateKey(value);
  return {
    day: date.toLocaleDateString('en-GB', { weekday: 'short' }),
    date: shortDate(date),
  };
}

function eventSubject(event: NormalizedEvent): string {
  return (event.course || event.subject || getCalendarEventDetails(event).course || 'General').trim();
}

function CalendarPill({ event, onSelect }: { event: NormalizedEvent; onSelect: () => void }) {
  const details = getCalendarEventDetails(event);
  return (
    <button type="button" onClick={onSelect} title={`${details.course}: ${details.title} · ${details.time}`} className="flex h-6 w-full items-center gap-1.5 rounded-md border border-[#383838] bg-[#202020] px-1.5 text-left text-[10px] text-gray-200 transition-colors hover:border-[#675a2b] hover:bg-[#28251a] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f7d344]">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f7d344]" aria-hidden="true" />
      <span className="truncate">{details.course}</span>
    </button>
  );
}

function TimelineEvent({ event }: { event: NormalizedEvent }) {
  const details = getCalendarEventDetails(event);
  return (
    <article data-testid="timeline-event" className="min-w-0 border-b border-[#252525] pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#d8bd4d]">{details.course}</p>
        {event.sectionNumber && <span className="text-[10px] font-medium text-gray-500">Section {event.sectionNumber}</span>}
      </div>
      <h4 className="mt-1 text-sm font-semibold leading-5 text-white">{details.title}</h4>
      <ExpandableText text={details.description} maxChars={150} className="mt-1.5 text-xs leading-5 text-gray-400" />
      <p className="mt-2 text-[11px] text-gray-500"><span className="text-gray-300">{details.time}</span><span aria-hidden="true"> · </span>{details.venue}<span aria-hidden="true"> · </span>{details.venueLabel}</p>
      {(details.meetingLink || event.htmlLink) && <div className="mt-1.5 flex gap-3 text-[11px]">
        {details.meetingLink && <a href={details.meetingLink} target="_blank" rel="noopener noreferrer" className="font-medium text-[#d8bd4d] hover:underline">Join session</a>}
        {event.htmlLink && <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-400 hover:text-white hover:underline">Google Calendar</a>}
      </div>}
    </article>
  );
}

export function AgendaList() {
  const { dashboardData, loading } = useDashboard();
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState<CalendarView>('month');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<NormalizedEvent | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('1');
  const [sharedEvents, setSharedEvents] = useState<NormalizedEvent[]>([]);
  const [sharedLoading, setSharedLoading] = useState(true);
  const [sharedError, setSharedError] = useState('');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState(() => dateKey(today));
  const [rangeEnd, setRangeEnd] = useState(() => dateKey(addDays(today, 14)));
  const [draftStart, setDraftStart] = useState(rangeStart);
  const [draftEnd, setDraftEnd] = useState(rangeEnd);
  const [rangeError, setRangeError] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (!['day', 'week', 'month', 'timeline', 'range'].includes(saved ?? '')) return;
    const timer = window.setTimeout(() => setView(saved as CalendarView), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const days = useMemo(() => calendarDays(selectedDate, view), [selectedDate, view]);
  const queryWindow = useMemo(() => {
    if (view === 'range') return { start: rangeStart, end: rangeEnd };
    const first = days[0] ?? selectedDate;
    const last = days[days.length - 1] ?? selectedDate;
    return { start: dateKey(first), end: dateKey(last) };
  }, [days, rangeEnd, rangeStart, selectedDate, view]);

  useEffect(() => {
    return subscribeToSharedTimetable(
      `${queryWindow.start}T00:00:00`,
      `${queryWindow.end}T23:59:59.999`,
      events => { setSharedEvents(events); setSharedError(''); setSharedLoading(false); },
      (err) => { setSharedError(`Shared timetable could not be loaded: ${err.message}`); setSharedLoading(false); }
    );
  }, [queryWindow.end, queryWindow.start]);

  const localEvents = useMemo(() => {
    const primary = dashboardData?.calendarAvailability?.events ?? dashboardData?.events ?? [];
    const fallback = dashboardData?.events ?? (dashboardData as { agenda?: NormalizedEvent[] })?.agenda ?? [];
    return [...primary, ...fallback].filter(event => !event.isDeadline);
  }, [dashboardData]);

  const allEvents = useMemo(() => {
    const unique = new Map<string, NormalizedEvent>();
    [...sharedEvents, ...localEvents].forEach((event, index) => unique.set(eventKey(event, index), event));
    return [...unique.values()].sort((a, b) => a.startIso.localeCompare(b.startIso));
  }, [localEvents, sharedEvents]);

  const subjects = useMemo(() => [...new Set(allEvents.map(eventSubject))].sort((a, b) => a.localeCompare(b)), [allEvents]);
  const events = useMemo(() => allEvents.filter(event => {
    if (subjectFilter !== 'all' && eventSubject(event) !== subjectFilter) return false;
    
    // If it's a shared section event, it must match the selected section
    if (event.sectionNumber) {
      if (sectionFilter === 'personal' || event.sectionNumber !== Number(sectionFilter)) return false;
    }
    
    return true;
  }), [allEvents, sectionFilter, subjectFilter]);

  const grouped = useMemo(() => {
    const result = new Map<string, NormalizedEvent[]>();
    for (const event of events) {
      const key = event.startIso.slice(0, 10);
      result.set(key, [...(result.get(key) ?? []), event]);
    }
    return result;
  }, [events]);

  const todayKey = dateKey(today);
  const visibleEvents = days.flatMap(day => grouped.get(dateKey(day)) ?? []);
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
  const timelineKeys = [...grouped.keys()].filter(key => view === 'range' ? key >= rangeStart && key <= rangeEnd : key.startsWith(selectedMonth)).sort();

  const chooseView = (next: CalendarView) => {
    setView(next);
    setSelectedEvent(null);
    window.localStorage.setItem(VIEW_KEY, next);
  };

  const navigate = (direction: -1 | 1) => {
    if (view === 'range') {
      const span = Math.round((fromDateKey(rangeEnd).getTime() - fromDateKey(rangeStart).getTime()) / 86_400_000) + 1;
      const nextStart = addDays(fromDateKey(rangeStart), direction * span);
      const nextEnd = addDays(fromDateKey(rangeEnd), direction * span);
      setRangeStart(dateKey(nextStart)); setDraftStart(dateKey(nextStart));
      setRangeEnd(dateKey(nextEnd)); setDraftEnd(dateKey(nextEnd));
    } else {
      setSelectedDate(current => {
        if (view === 'day') return addDays(current, direction);
        if (view === 'week') return addDays(current, direction * 7);
        return new Date(current.getFullYear(), current.getMonth() + direction, 1);
      });
    }
    setSelectedEvent(null);
  };

  const goToday = () => {
    if (view === 'range') {
      const start = dateKey(new Date());
      const end = dateKey(addDays(new Date(), 14));
      setRangeStart(start); setDraftStart(start);
      setRangeEnd(end); setDraftEnd(end);
    } else {
      setSelectedDate(new Date());
    }
  };

  const applyRange = () => {
    const start = fromDateKey(draftStart);
    const end = fromDateKey(draftEnd);
    const span = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    if (!draftStart || !draftEnd || span < 0) {
      setRangeError('Choose an end date on or after the start date.');
      return;
    }
    if (span > 179) {
      setRangeError('Choose a range of 180 days or less.');
      return;
    }
    setRangeError('');
    setRangeStart(draftStart);
    setRangeEnd(draftEnd);
    setRangeOpen(false);
    chooseView('range');
  };

  const showTimeline = view === 'timeline' || view === 'range';

  return (
    <section className="overflow-hidden rounded-xl border border-[#242424] bg-[#131313]">
      <div className="border-b border-[#242424] px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => navigate(-1)} aria-label={`Previous ${view}`} className="grid h-8 w-8 place-items-center rounded-md text-gray-400 hover:bg-[#222] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f7d344]"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={goToday} title="Go to today" className="min-w-40 rounded-md bg-[#1d1d1d] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#252525]">{headerLabel(selectedDate, view, rangeStart, rangeEnd)}</button>
            <button type="button" onClick={() => navigate(1)} aria-label={`Next ${view}`} className="grid h-8 w-8 place-items-center rounded-md text-gray-400 hover:bg-[#222] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f7d344]"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setRangeOpen(value => !value)} aria-expanded={rangeOpen} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium ${view === 'range' ? 'border-[#6c5e28] bg-[#302a15] text-[#f7d344]' : 'border-[#303030] bg-[#101010] text-gray-300 hover:text-white'}`}><CalendarRange className="h-3.5 w-3.5" />Custom range</button>
            <div className="inline-flex rounded-lg border border-[#303030] bg-[#0d0d0d] p-1" aria-label="Calendar view">
              {(['day', 'week', 'month', 'timeline'] as CalendarView[]).map(option => <button key={option} type="button" onClick={() => chooseView(option)} aria-pressed={view === option} title={`${option[0].toUpperCase() + option.slice(1)} view · saves as default`} className={`h-7 rounded-md px-3 text-xs font-medium capitalize transition-colors ${view === option ? 'bg-[#302a15] text-[#f7d344]' : 'text-gray-400 hover:text-white'}`}>{option}</button>)}
            </div>
          </div>
        </div>

        {rangeOpen && <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-[#303030] bg-[#101010] p-3">
          <label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">Start<input type="date" value={draftStart} onChange={event => setDraftStart(event.target.value)} className="mt-1 block h-9 rounded-md border border-[#333] bg-[#171717] px-2 text-xs text-white [color-scheme:dark]" /></label>
          <label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">End<input type="date" value={draftEnd} min={draftStart} onChange={event => setDraftEnd(event.target.value)} className="mt-1 block h-9 rounded-md border border-[#333] bg-[#171717] px-2 text-xs text-white [color-scheme:dark]" /></label>
          <button type="button" onClick={applyRange} className="h-9 rounded-md bg-[#f7d344] px-4 text-xs font-semibold text-black hover:bg-[#ffe36c]">Show range</button>
          {rangeError && <p role="alert" className="w-full text-xs text-red-400">{rangeError}</p>}
        </div>}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#222] pt-3">
          <label htmlFor="calendar-subject-filter" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Subject</label>
          <select id="calendar-subject-filter" value={subjectFilter} onChange={event => { setSubjectFilter(event.target.value); setSectionFilter('all'); setSelectedEvent(null); }} className="h-9 min-w-44 max-w-64 rounded-lg border border-[#303030] bg-[#101010] px-3 text-xs text-gray-300 outline-none focus:border-[#f7d344]">
            <option value="all">All subjects</option>
            {subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
          </select>
          <label htmlFor="calendar-section-filter" className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Section</label>
          <select id="calendar-section-filter" value={sectionFilter} onChange={event => { setSectionFilter(event.target.value); setSelectedEvent(null); }} className="h-9 min-w-32 rounded-lg border border-[#303030] bg-[#101010] px-3 text-xs text-gray-300 outline-none focus:border-[#f7d344]">
            {SECTIONS.map(section => <option key={section} value={section}>Section {section}</option>)}
            <option value="personal">Personal only</option>
          </select>
          <p className="ml-auto text-[10px] text-gray-600">Personal & Shared calendars</p>
        </div>
      </div>

      {sharedError && <p role="alert" className="border-b border-red-900/40 bg-red-950/20 px-4 py-2 text-xs text-red-300">{sharedError}</p>}
      {(loading || sharedLoading) && allEvents.length === 0 ? (
        <div className="grid min-h-64 place-items-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[#f7d344] border-t-transparent" /></div>
      ) : allEvents.length === 0 ? (
        <EmptyState icon={Calendar} title="No sessions" description="Personal and shared section calendars will appear here after the next sync." />
      ) : events.length === 0 ? (
        <EmptyState icon={Calendar} title="No sessions for these filters" description="Choose another subject, section, or date range." />
      ) : view === 'day' ? (
        <div className="p-3">{visibleEvents.length ? <div className="grid gap-2 md:grid-cols-2">{visibleEvents.map((event, index) => <CalendarEventCard key={eventKey(event, index)} event={event} />)}</div> : <p className="py-12 text-center text-xs text-gray-500">No shared sessions on this day.</p>}</div>
      ) : showTimeline ? (
        <div className="px-3 py-4 sm:px-5">
          {timelineKeys.length ? <div className="relative">
            <div className="absolute bottom-2 left-[3.9rem] top-2 w-px bg-[#37331f] sm:left-[5.4rem]" aria-hidden="true" />
            <div className="space-y-5">{timelineKeys.map(key => {
              const label = timelineDateLabel(key);
              const dayEvents = grouped.get(key) ?? [];
              return <section key={key} className="relative grid grid-cols-[3.25rem_1fr] gap-4 sm:grid-cols-[4.75rem_1fr]">
                <div className="pt-0.5 text-right"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#d8bd4d]">{label.day}</p><p className="mt-0.5 text-xs text-gray-400">{label.date}</p></div>
                <span className="absolute left-[3.55rem] top-2 h-2.5 w-2.5 rounded-full border-2 border-[#131313] bg-[#f7d344] sm:left-[5.05rem]" aria-hidden="true" />
                <div className="min-w-0 space-y-4 pl-2">{dayEvents.map((event, index) => <TimelineEvent key={eventKey(event, index)} event={event} />)}</div>
              </section>;
            })}</div>
          </div> : <p className="py-12 text-center text-xs text-gray-500">No shared sessions in this period.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar"><div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-[#292929] bg-[#101010]">{WEEKDAYS.map(day => <div key={day} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">{day}</div>)}</div>
          <div className="grid grid-cols-7">{days.map(day => {
            const key = dateKey(day);
            const dayEvents = grouped.get(key) ?? [];
            const outsideMonth = view === 'month' && day.getMonth() !== selectedDate.getMonth();
            const visibleLimit = view === 'month' ? 3 : 6;
            return <div key={key} className={`min-h-24 border-b border-r border-[#282828] p-1.5 ${key === todayKey ? 'bg-[#242015]' : outsideMonth ? 'bg-[#0e0e0e]' : 'bg-[#151515]'}`}>
              <div className={`mb-1 text-right text-[10px] font-medium ${key === todayKey ? 'text-[#f7d344]' : outsideMonth ? 'text-gray-700' : 'text-gray-400'}`}>{day.getDate()}</div>
              <div className="space-y-1">
                {dayEvents.slice(0, visibleLimit).map((event, index) => <CalendarPill key={eventKey(event, index)} event={event} onSelect={() => setSelectedEvent(event)} />)}
                {dayEvents.length > visibleLimit && <button type="button" onClick={() => { setSelectedDate(day); chooseView('day'); }} className="px-1 text-[10px] font-medium text-[#d8bd4d] hover:underline">+{dayEvents.length - visibleLimit} more</button>}
              </div>
            </div>;
          })}</div>
        </div></div>
      )}

      {selectedEvent && view !== 'day' && <div className="border-t border-[#2a2a2a] bg-[#101010] p-3">
        <div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Event details</p><button type="button" onClick={() => setSelectedEvent(null)} aria-label="Close event details" className="grid h-7 w-7 place-items-center rounded-md text-gray-500 hover:bg-[#222] hover:text-white"><X className="h-3.5 w-3.5" /></button></div>
        <CalendarEventCard event={selectedEvent} />
      </div>}
    </section>
  );
}
