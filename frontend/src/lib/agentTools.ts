import { createCalendarEvent, createGoogleTask, sendMail } from '@/lib/functions';
import { createPersonalTask } from '@/lib/firestore';
import { toLocalDateIso } from '@/lib/mailUtils';
import type { NormalizedEvent, GoogleTask } from '@/types';

export interface ScheduleConflict {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  recommendedAction: string;
  suggestedSlot?: {
    startIso: string;
    endIso: string;
    title: string;
  };
}

export interface FocusSlot {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  formattedTime: string;
  durationMinutes: number;
  label: string;
  dateLabel: string;
}

export interface ParsedAgentQuery {
  targetDate: Date;
  dateLabel: string;
  durationMinutes: number;
  intent: 'find_slots' | 'block_calendar' | 'create_task' | 'send_email' | 'prioritize' | 'record_note';
  title: string;
}

/**
 * Parses natural language input for target date, duration, intent, and title.
 * Examples:
 * - "Block calendar 90 minutes tomorrow for Reliance deck"
 * - "Find me the focus slots for today"
 * - "Show availability on Friday for 2 hours"
 * - "Block 45 mins on 18 Sep for mock interview"
 */
export function parseDateAndDuration(text: string): ParsedAgentQuery {
  const lower = text.toLowerCase();
  const now = new Date();

  // 1. Detect duration in minutes (defaults to 90 min deep work)
  let durationMinutes = 90;
  const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  const minMatch = lower.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);

  if (hourMatch) {
    durationMinutes = Math.round(parseFloat(hourMatch[1]) * 60);
  } else if (minMatch) {
    durationMinutes = Math.round(parseInt(minMatch[1], 10));
  }

  // 2. Detect target date
  let targetDate = new Date(now);
  let dateLabel = 'Today';

  if (lower.includes('day after tomorrow')) {
    targetDate = new Date(now);
    targetDate.setDate(now.getDate() + 2);
    dateLabel = 'Day after tomorrow';
  } else if (lower.includes('tomorrow')) {
    targetDate = new Date(now);
    targetDate.setDate(now.getDate() + 1);
    dateLabel = 'Tomorrow';
  } else if (lower.includes('today')) {
    targetDate = new Date(now);
    dateLabel = 'Today';
  } else {
    // Check for weekday names
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekdayIdx = weekdays.findIndex((w) => new RegExp(`\\b${w}\\b`).test(lower));
    if (weekdayIdx !== -1) {
      const currentDay = now.getDay();
      let diff = weekdayIdx - currentDay;
      if (diff <= 0) diff += 7; // Next upcoming occurrence
      targetDate = new Date(now);
      targetDate.setDate(now.getDate() + diff);
      dateLabel = weekdays[weekdayIdx].charAt(0).toUpperCase() + weekdays[weekdayIdx].slice(1);
    } else {
      // Check explicit date patterns like "18 sep", "sep 18", "2026-09-18", "18/09"
      const isoMatch = lower.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
      const dmyMatch = lower.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?\b/);
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthRegex = new RegExp(
        `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames.join('|')})\\b|\\b(${monthNames.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`,
        'i'
      );
      const monthMatch = lower.match(monthRegex);

      if (isoMatch) {
        targetDate = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
        dateLabel = targetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      } else if (monthMatch) {
        const day = parseInt(monthMatch[1] || monthMatch[4], 10);
        const monStr = (monthMatch[2] || monthMatch[3]).toLowerCase();
        const monIdx = monthNames.findIndex((m) => monStr.startsWith(m));
        if (monIdx !== -1 && day >= 1 && day <= 31) {
          targetDate = new Date(now.getFullYear(), monIdx, day);
          if (targetDate.getTime() < now.getTime() - 86400000) {
            targetDate.setFullYear(now.getFullYear() + 1);
          }
          dateLabel = `${day} ${monthNames[monIdx].toUpperCase()}`;
        }
      } else if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const mon = parseInt(dmyMatch[2], 10) - 1;
        const year = dmyMatch[3] ? parseInt(dmyMatch[3], 10) : now.getFullYear();
        targetDate = new Date(year, mon, day);
        dateLabel = targetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      }
    }
  }

  // 3. Detect intent
  let intent: ParsedAgentQuery['intent'] = 'block_calendar';
  const isFindSlots =
    lower.includes('find') ||
    lower.includes('show') ||
    lower.includes('check') ||
    lower.includes('availability') ||
    lower.includes('what are my') ||
    lower.includes('free slots') ||
    lower.includes('available slots') ||
    lower.includes('open slots');

  if (isFindSlots) {
    intent = 'find_slots';
  } else if (lower.startsWith('send email') || lower.includes('email to') || lower.includes('mail to')) {
    intent = 'send_email';
  } else if (
    lower.startsWith('task') ||
    lower.includes('add task') ||
    lower.includes('remind me') ||
    lower.includes('todo')
  ) {
    intent = 'create_task';
  } else if (lower.includes('prioritize') || lower.includes('plan my day')) {
    intent = 'prioritize';
  } else if (
    lower.startsWith('note') ||
    lower.includes('record note') ||
    lower.includes('write down')
  ) {
    intent = 'record_note';
  }

  // 4. Extract Event Title
  let title = 'Deep Work: Protected Focus';
  const forMatch = text.match(/\bfor\s+([^,.;]+)/i);
  if (forMatch && forMatch[1] && forMatch[1].trim().length > 2) {
    const raw = forMatch[1].trim();
    title = raw.charAt(0).toUpperCase() + raw.slice(1);
  } else {
    const cleaned = text
      .replace(/^(please\s+)?(block\s+(calendar|focus\s*time)?(\s*for)?|schedule\s+focus\s*(\s*for)?|find\s+(me\s+)?(focus\s+slots?|availability)\s*(for)?)/i, '')
      .replace(/\b(tomorrow|today|day after tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
      .replace(/\b\d+\s*(hours?|hrs?|h|minutes?|mins?|m)\b/gi, '')
      .trim();
    if (cleaned.length > 2 && !/^(me|my|a|the|slots?|calendar)$/i.test(cleaned)) {
      title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }

  return { targetDate, dateLabel, durationMinutes, intent, title };
}

/**
 * Finds ALL available focus slots of at least `durationMinutes` on any specified target date.
 */
export function findAllFocusSlots(
  events: NormalizedEvent[],
  targetDate: Date = new Date(),
  durationMinutes = 60
): FocusSlot[] {
  const slots: FocusSlot[] = [];
  const now = new Date();
  const isToday =
    targetDate.getFullYear() === now.getFullYear() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getDate() === now.getDate();

  // Operating window: 09:00 AM to 08:00 PM
  const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 9, 0, 0);
  const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 20, 0, 0);

  // If today, don't recommend past hours; give at least 15 mins buffer
  let cursor = isToday
    ? new Date(Math.max(now.getTime() + 15 * 60000, dayStart.getTime()))
    : new Date(dayStart.getTime());

  // Filter and sort events for target date
  const dayEvents = (events || [])
    .filter((e) => {
      if (!e.startIso) return false;
      const d = new Date(e.startIso);
      return (
        d.getFullYear() === targetDate.getFullYear() &&
        d.getMonth() === targetDate.getMonth() &&
        d.getDate() === targetDate.getDate()
      );
    })
    .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime());

  const dateLabel = isToday
    ? 'Today'
    : targetDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  for (const ev of dayEvents) {
    const evStart = new Date(ev.startIso);
    const evEnd = ev.endIso ? new Date(ev.endIso) : new Date(evStart.getTime() + 60 * 60000);

    // Check gap before this event
    if (evStart.getTime() > cursor.getTime()) {
      const gapMs = evStart.getTime() - cursor.getTime();
      const gapMins = Math.floor(gapMs / 60000);

      if (gapMins >= durationMinutes) {
        const slotEnd = new Date(cursor.getTime() + durationMinutes * 60000);
        slots.push({
          start: new Date(cursor),
          end: slotEnd,
          startIso: cursor.toISOString(),
          endIso: slotEnd.toISOString(),
          formattedTime: `${cursor.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} – ${slotEnd.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
          durationMinutes,
          label: gapMins >= durationMinutes + 45 ? `Prime Focus Gap (${gapMins}m free)` : 'Optimal Focus Window',
          dateLabel,
        });

        // If the gap is huge (e.g., >= 2.5x requested duration), offer a secondary candidate slot in the same gap
        if (gapMins >= durationMinutes * 2.5) {
          const secondStart = new Date(cursor.getTime() + (durationMinutes + 30) * 60000);
          const secondEnd = new Date(secondStart.getTime() + durationMinutes * 60000);
          if (secondEnd.getTime() <= evStart.getTime()) {
            slots.push({
              start: secondStart,
              end: secondEnd,
              startIso: secondStart.toISOString(),
              endIso: secondEnd.toISOString(),
              formattedTime: `${secondStart.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} – ${secondEnd.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
              durationMinutes,
              label: 'Alternative Focus Window',
              dateLabel,
            });
          }
        }
      }
    }

    if (evEnd.getTime() > cursor.getTime()) {
      cursor = new Date(evEnd.getTime() + 10 * 60000); // 10 min breather
    }
  }

  // Check gap after last event until dayEnd (8:00 PM)
  if (dayEnd.getTime() - cursor.getTime() >= durationMinutes * 60000) {
    const slotEnd = new Date(cursor.getTime() + durationMinutes * 60000);
    const gapMins = Math.floor((dayEnd.getTime() - cursor.getTime()) / 60000);
    slots.push({
      start: new Date(cursor),
      end: slotEnd,
      startIso: cursor.toISOString(),
      endIso: slotEnd.toISOString(),
      formattedTime: `${cursor.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} – ${slotEnd.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
      durationMinutes,
      label: gapMins > durationMinutes + 60 ? 'Evening Deep Work Block' : 'Open End-of-Day Slot',
      dateLabel,
    });
  }

  return slots;
}

/**
 * Finds the single best focus slot for a given date and duration.
 */
export function findOptimalFocusSlot(
  events: NormalizedEvent[],
  targetDate: Date = new Date(),
  durationMinutes = 90
): FocusSlot | null {
  const slots = findAllFocusSlots(events, targetDate, durationMinutes);
  if (slots.length === 0) return null;

  // Prefer morning or early afternoon slots (10:00 to 16:00)
  const primeSlot = slots.find((s) => {
    const hr = s.start.getHours();
    return hr >= 10 && hr <= 15;
  });

  return primeSlot || slots[0];
}

/**
 * Proactively analyzes deadlines vs events to detect schedule crunches.
 */
export function detectScheduleConflicts(
  events: NormalizedEvent[],
  urgentMails: Array<{ subject: string; dueDate?: string | null }>,
  tasks: GoogleTask[]
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const todayIso = toLocalDateIso();

  // 1. Deadline on today with heavy event load
  const todayDeadlines = urgentMails.filter((m) => m.dueDate === todayIso);
  const todayEvents = events.filter((e) => e.startIso && new Date(e.startIso).toDateString() === new Date().toDateString());

  if (todayDeadlines.length > 0 && todayEvents.length >= 2) {
    const freeSlot = findOptimalFocusSlot(events, new Date(), 60);
    conflicts.push({
      id: 'conflict-deadline-crowd',
      severity: 'critical',
      title: `Tight Schedule for ${todayDeadlines[0].subject.slice(0, 30)}...`,
      description: `You have an active deadline due today but your calendar has ${todayEvents.length} scheduled sessions. Free preparation time is scarce.`,
      recommendedAction: freeSlot
        ? `Auto-block a dedicated focus slot at ${freeSlot.formattedTime} to guarantee submission.`
        : `Reschedule non-urgent tasks to open a dedicated prep window.`,
      suggestedSlot: freeSlot
        ? {
            startIso: freeSlot.startIso,
            endIso: freeSlot.endIso,
            title: `Deep Work Focus: ${todayDeadlines[0].subject.slice(0, 25)}`,
          }
        : undefined,
    });
  }

  // 2. Heavy task backlog warning
  const pendingTasks = tasks.filter((t) => !t.completed);
  if (pendingTasks.length >= 5) {
    conflicts.push({
      id: 'conflict-task-backlog',
      severity: 'warning',
      title: `${pendingTasks.length} Pending Tasks Accumulated`,
      description: 'Your task queue is getting crowded. Unfinished tasks degrade focus.',
      recommendedAction: 'Consolidate top 3 tasks and defer non-essential items.',
    });
  }

  return conflicts;
}

export type AgentActionType =
  | 'create_calendar_event'
  | 'create_task'
  | 'auto_block_focus'
  | 'send_email'
  | 'record_note'
  | 'prioritize';

export interface AgentExecutionResult {
  success: boolean;
  actionType: AgentActionType;
  message: string;
  details?: any;
}

/**
 * Autonomous command execution router.
 */
export async function executeAgentAction(
  actionType: AgentActionType,
  params: any,
  uid?: string
): Promise<AgentExecutionResult> {
  try {
    switch (actionType) {
      case 'create_calendar_event': {
        const res = await createCalendarEvent({
          title: params.title,
          start: params.start,
          end: params.end,
          description: params.description || 'Scheduled via MU AI Copilot',
        });
        const dateStr = new Date(params.start).toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
        const timeRange = `${new Date(params.start).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        })} – ${new Date(params.end).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        })}`;
        return {
          success: true,
          actionType,
          message: `Scheduled "${params.title}" on your Google Calendar for ${dateStr} (${timeRange}).`,
          details: res,
        };
      }

      case 'auto_block_focus': {
        const targetDate = params.targetDate ? new Date(params.targetDate) : new Date();
        const duration = params.duration || 90;
        const slot =
          params.slot ||
          findOptimalFocusSlot(params.events || [], targetDate, duration);

        if (!slot) {
          const formattedDate = targetDate.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          });
          return {
            success: false,
            actionType,
            message: `Could not find an open ${duration}-minute window on ${formattedDate} between scheduled classes.`,
          };
        }

        const startIso = slot.start instanceof Date ? slot.start.toISOString() : slot.startIso;
        const endIso = slot.end instanceof Date ? slot.end.toISOString() : slot.endIso;
        const title = params.title || 'Deep Work: Protected Focus';

        const res = await createCalendarEvent({
          title,
          start: startIso,
          end: endIso,
          description: 'Protected Deep Work block auto-scheduled by MU Chief of Staff Agent',
        });

        const startDate = new Date(startIso);
        const dateStr = startDate.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
        const timeStr = `${startDate.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        })} – ${new Date(endIso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

        return {
          success: true,
          actionType,
          message: `Blocked ${duration}m protected focus "${title}" on your Google Calendar for ${dateStr} (${timeStr}).`,
          details: res,
        };
      }

      case 'create_task': {
        if (params.useGoogleTask) {
          const res = await createGoogleTask({
            title: params.title,
            dueDate: params.dueDate || toLocalDateIso(),
          });
          return {
            success: true,
            actionType,
            message: `Created Google Task: "${params.title}".`,
            details: res,
          };
        } else if (uid) {
          await createPersonalTask(uid, {
            title: params.title,
            dueDate: params.dueDate || toLocalDateIso(),
            importance: params.importance || 'must_do',
            completed: false,
          });
          return {
            success: true,
            actionType,
            message: `Added "${params.title}" to your must-do priorities.`,
          };
        }
        return { success: false, actionType, message: 'User ID missing for task creation.' };
      }

      case 'send_email': {
        const res = await sendMail({
          to: params.to,
          subject: params.subject,
          body: params.body,
        });
        return {
          success: true,
          actionType,
          message: `Email sent to ${params.to} regarding "${params.subject}".`,
          details: res,
        };
      }

      default:
        return { success: false, actionType, message: `Unsupported agent action: ${actionType}` };
    }
  } catch (err: any) {
    return {
      success: false,
      actionType,
      message: err.message || 'Agent action execution failed.',
    };
  }
}
