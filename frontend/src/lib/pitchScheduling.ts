import type { NormalizedEvent } from '@/types';

export interface PitchFocusSlot {
  startIso: string;
  endIso: string;
  label: string;
}

function localDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(year, month - 1, day);
  return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day
    ? result : null;
}

function eventDate(value: string): Date {
  return localDate(value) || new Date(value);
}

/** Candidates from a complete calendar snapshot; the caller must check coverage/freshness. */
export function getPitchFocusSlots(
  events: NormalizedEvent[], date: string, duration: number, deadline: string, now = new Date(),
): PitchFocusSlot[] {
  const day = localDate(date);
  const due = deadline ? localDate(deadline) : null;
  if (!day || (deadline && !due) || !Number.isFinite(now.getTime()) ||
      !Number.isInteger(duration) || duration < 45 || duration > 120 ||
      (due && day.getTime() > due.getTime())) return [];

  const start = new Date(day); start.setHours(9);
  const end = new Date(day); end.setHours(20);
  if (end.getTime() <= now.getTime()) return [];
  const floor = Math.max(start.getTime(), now.getTime() + 15 * 60000);
  const ceiling = end.getTime();
  const busy: Array<[number, number]> = [];
  for (const event of events) {
    const begin = eventDate(event.startIso);
    if (!Number.isFinite(begin.getTime())) return []; // Unknown event timing cannot establish a free gap.
    const allDay = event.allDay || event.isAllDay || /^\d{4}-\d{2}-\d{2}$/.test(event.startIso);
    let finish: Date;
    if (event.endIso) finish = eventDate(event.endIso);
    else if (allDay) { finish = new Date(begin); finish.setDate(finish.getDate() + 1); }
    else {
      // Missing end: conservatively occupy the remainder of its day.
      finish = new Date(begin); finish.setHours(23, 59, 59, 999);
    }
    if (!Number.isFinite(finish.getTime()) || finish.getTime() <= begin.getTime()) return [];
    const buffer = allDay ? 0 : 10 * 60000;
    const a = Math.max(floor, begin.getTime() - buffer);
    const b = Math.min(ceiling, finish.getTime() + buffer);
    if (a < b) busy.push([a, b]);
  }
  busy.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const interval of busy) {
    const previous = merged[merged.length - 1];
    if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1]);
    else merged.push([...interval]);
  }
  const gaps: Array<[number, number]> = [];
  let cursor = floor;
  for (const [a, b] of merged) {
    if (cursor < a) gaps.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < ceiling) gaps.push([cursor, ceiling]);
  const result: PitchFocusSlot[] = [];
  for (const [a, b] of gaps) {
    // Round to a local quarter hour (also works for half/quarter-hour timezones).
    const rounded = new Date(a);
    rounded.setMinutes(Math.ceil((rounded.getMinutes() + (rounded.getSeconds() || rounded.getMilliseconds() ? 1 : 0)) / 15) * 15, 0, 0);
    for (let t = rounded.getTime(); t + duration * 60000 <= b && result.length < 8; t += (duration + 15) * 60000) {
      const begin = new Date(t), finish = new Date(t + duration * 60000);
      result.push({ startIso: begin.toISOString(), endIso: finish.toISOString(),
        label: `${begin.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} – ${finish.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` });
    }
  }
  return result;
}
