'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  AlertCircle,
  Zap,
  ArrowRight,
  ListTodo,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  CalendarPlus,
} from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { createPersonalTask, updateFocus } from '@/lib/firestore';
import { extractMailDueDate, getMailDeadlineStatus, toLocalDateIso } from '@/lib/mailUtils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  detectScheduleConflicts,
  executeAgentAction,
  findAllFocusSlots,
  findOptimalFocusSlot,
  FocusSlot,
  ScheduleConflict,
} from '@/lib/agentTools';

export function AiDayPrioritizer() {
  const { user } = useAuth();
  const { dashboardData } = useDashboard();

  const [expanded, setExpanded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applied, setApplied] = useState(false);
  const [blockingCalendar, setBlockingCalendar] = useState(false);
  const [calendarBlockedMsg, setCalendarBlockedMsg] = useState('');
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [focusDuration, setFocusDuration] = useState<number>(90);
  const [bookingSlotIdx, setBookingSlotIdx] = useState<number | null>(null);

  const [plan, setPlan] = useState<{
    summary: string;
    focusTheme: string;
    topPriorities: Array<{
      id: string;
      title: string;
      urgency: 'critical' | 'high' | 'medium';
      reason: string;
      timeBlock: string;
    }>;
    suggestedSchedule: Array<{
      time: string;
      action: string;
      category: 'deep_work' | 'event' | 'deadline';
    }>;
  } | null>(null);

  function generatePrioritizedPlan() {
    setAnalyzing(true);
    setApplied(false);
    setCalendarBlockedMsg('');

    setTimeout(() => {
      const todayIso = toLocalDateIso();
      const events = dashboardData?.events || [];
      const mailSignals = dashboardData?.mailSignals || [];
      const googleTasks = dashboardData?.googleTasks || [];

      // Detect today's deadlines from email signals
      const urgentMails = mailSignals
        .map((m) => {
          const effectiveDue =
            m.dueDate || extractMailDueDate(m.subject, m.snippet, m.receivedAt);
          const status = getMailDeadlineStatus(effectiveDue, todayIso);
          return { mail: m, effectiveDue, status, subject: m.subject };
        })
        .filter((item) => item.status === 'today' || item.status === 'upcoming');

      // Proactive conflict detection
      const detectedConflicts = detectScheduleConflicts(
        events,
        urgentMails.map((m) => ({ subject: m.subject, dueDate: m.effectiveDue || undefined })),
        googleTasks
      );
      setConflicts(detectedConflicts);

      // Top priority items
      const priorities: any[] = [];

      if (urgentMails.length > 0) {
        const topMail = urgentMails[0];
        priorities.push({
          id: 'p-1',
          title: `Submit / Act on: ${topMail.subject.replace(/^(fwd|re):\s*/i, '')}`,
          urgency: 'critical',
          reason: `Strict deadline detected from MU Mail (${topMail.effectiveDue || 'Due Today'}).`,
          timeBlock: '10:00 AM – 11:30 AM',
        });
      } else {
        priorities.push({
          id: 'p-1',
          title: 'Deep Work: Core Term Challenge & Case Analysis',
          urgency: 'high',
          reason: 'Uninterrupted morning focus on current venture deliverables.',
          timeBlock: '09:30 AM – 11:30 AM',
        });
      }

      if (events.length > 0) {
        const firstEvent = events[0];
        const eventStart = firstEvent.startIso
          ? new Date(firstEvent.startIso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          : 'today';
        const eventEnd = firstEvent.endIso
          ? new Date(firstEvent.endIso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          : '';
        const timeDisplay = eventEnd ? `${eventStart} – ${eventEnd}` : eventStart;

        priorities.push({
          id: 'p-2',
          title: `Attend & Engage: ${firstEvent.title}`,
          urgency: 'high',
          reason: `High-value interactive session scheduled at ${eventStart}.`,
          timeBlock: timeDisplay !== 'today' ? timeDisplay : '02:00 PM – 03:30 PM',
        });
      } else {
        priorities.push({
          id: 'p-2',
          title: 'Recruiter Outreach & Networking Follow-ups',
          urgency: 'medium',
          reason: 'Send 3 targeted LinkedIn/Email pitches to visiting companies.',
          timeBlock: '02:00 PM – 03:00 PM',
        });
      }

      const pendingTasks = googleTasks.filter((t) => !t.completed);
      if (pendingTasks.length > 0) {
        priorities.push({
          id: 'p-3',
          title: `Clear Pending Task: ${pendingTasks[0].title}`,
          urgency: 'medium',
          reason: 'Prevent backlog accumulation across your Google & Personal task queues.',
          timeBlock: '04:30 PM – 05:30 PM',
        });
      } else {
        priorities.push({
          id: 'p-3',
          title: 'Evening Synthesis & Peer Deck Review',
          urgency: 'medium',
          reason: 'Validate pitch deck assumptions with cohort members before tomorrow.',
          timeBlock: '05:00 PM – 06:00 PM',
        });
      }

      setPlan({
        summary: `AI analyzed ${events.length} schedule events, ${urgentMails.length} active deadlines, and ${pendingTasks.length} pending tasks. High-focus day centered on project execution and key submissions.`,
        focusTheme:
          urgentMails.length > 0
            ? 'Deadline Execution & Strategic Delivery'
            : 'Proactive Venture Building & Cohort Collaboration',
        topPriorities: priorities,
        suggestedSchedule: [
          { time: '09:00 – 11:30 AM', action: 'Deep Work Block (Highest cognitive demand)', category: 'deep_work' },
          { time: '11:30 – 01:00 PM', action: 'Communications, Mail Responses & Fast Tasks', category: 'deadline' },
          { time: '02:00 – 04:30 PM', action: 'Scheduled Sessions, Masterclasses & Cohort Sync', category: 'event' },
          { time: '05:00 – 06:30 PM', action: 'Wrap-up, Verification & Task Queue Cleared', category: 'deep_work' },
        ],
      });
      setAnalyzing(false);
      setExpanded(true);
    }, 500);
  }

  async function handleAutoApply() {
    if (!user || !plan) return;
    setApplied(true);

    try {
      await updateFocus(user.uid, `Today: ${plan.focusTheme}`);
      for (const p of plan.topPriorities) {
        await createPersonalTask(user.uid, {
          title: p.title,
          dueDate: toLocalDateIso(),
          importance: p.urgency === 'critical' || p.urgency === 'high' ? 'must_do' : 'normal',
          completed: false,
        });
      }
    } catch (err) {
      console.error('Failed to auto-apply priorities:', err);
    }
  }

  async function handleAutoBlockCalendar(conflict: ScheduleConflict) {
    if (blockingCalendar) return;
    setBlockingCalendar(true);
    setCalendarBlockedMsg('');

    try {
      const res = await executeAgentAction('auto_block_focus', {
        events: dashboardData?.events || [],
        slot: conflict.suggestedSlot,
        title: conflict.suggestedSlot?.title || 'Deep Work Focus Block',
      });
      if (res.success) {
        setCalendarBlockedMsg(res.message);
      } else {
        setCalendarBlockedMsg(res.message || 'Could not block calendar.');
      }
    } catch (err: any) {
      setCalendarBlockedMsg(err.message || 'Failed to schedule calendar block.');
    } finally {
      setBlockingCalendar(false);
    }
  }

  async function handleBlockSpecificSlot(slot: FocusSlot, idx: number) {
    if (bookingSlotIdx !== null) return;
    setBookingSlotIdx(idx);
    setCalendarBlockedMsg('');

    try {
      const res = await executeAgentAction('auto_block_focus', {
        slot,
        title: plan?.focusTheme ? `Focus: ${plan.focusTheme}` : 'Deep Work Focus Block',
      });
      if (res.success) {
        setCalendarBlockedMsg(res.message);
      } else {
        setCalendarBlockedMsg(res.message || 'Could not block calendar.');
      }
    } catch (err: any) {
      setCalendarBlockedMsg(err.message || 'Failed to schedule calendar block.');
    } finally {
      setBookingSlotIdx(null);
    }
  }

  const targetDate = new Date(Date.now() + selectedDayOffset * 86400000);
  const targetDayLabel =
    selectedDayOffset === 0
      ? 'Today'
      : selectedDayOffset === 1
      ? 'Tomorrow'
      : targetDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const availableSlots = findAllFocusSlots(
    dashboardData?.events || [],
    targetDate,
    focusDuration
  );

  return (
    <div className="rounded-2xl border border-[#262626] bg-gradient-to-r from-[#141414] via-[#171717] to-[#121212] overflow-hidden shadow-lg">
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-400">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">AI Chief of Staff & Prioritizer</h3>
              <span className="rounded bg-purple-900/40 text-purple-300 border border-purple-500/30 text-[10px] font-bold px-1.5 py-0.2 uppercase">
                Agentic
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Perceives calendar events, urgent deadlines, and task queues to autonomously plan & protect your day.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!plan ? (
            <button
              onClick={generatePrioritizedPlan}
              disabled={analyzing}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-md transition-all cursor-pointer"
            >
              {analyzing ? <LoadingSpinner size="sm" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{analyzing ? 'Reasoning & Planning...' : '⚡ Prioritize My Day'}</span>
            </button>
          ) : (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 rounded-xl bg-[#222] hover:bg-[#2A2A2A] border border-[#333] px-3 py-2 text-xs font-medium text-gray-300 hover:text-white transition-colors"
            >
              <span>{expanded ? 'Hide Roadmap' : 'View Roadmap'}</span>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Roadmap */}
      {plan && expanded && (
        <div className="p-4 sm:p-5 pt-0 border-t border-[#202020] space-y-4 animate-in fade-in duration-200">
          {/* Proactive Conflict Warnings */}
          {conflicts.length > 0 && (
            <div className="space-y-2">
              {conflicts.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-red-400 flex-shrink-0" />
                      <span className="text-xs font-bold text-red-300 uppercase tracking-wider">{c.title}</span>
                    </div>
                    <p className="text-xs text-gray-300">{c.description}</p>
                    <p className="text-[11px] text-amber-300/90 font-medium">{c.recommendedAction}</p>
                  </div>

                  {c.suggestedSlot && (
                    <button
                      onClick={() => handleAutoBlockCalendar(c)}
                      disabled={blockingCalendar}
                      className="flex items-center gap-1.5 rounded-xl bg-red-900/60 hover:bg-red-800/80 border border-red-500/40 px-3.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer flex-shrink-0"
                    >
                      {blockingCalendar ? <LoadingSpinner size="sm" /> : <CalendarPlus className="h-3.5 w-3.5" />}
                      <span>Auto-Block Focus on Google Calendar</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {calendarBlockedMsg && (
            <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-3 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <span>{calendarBlockedMsg}</span>
            </div>
          )}

          {/* Theme & Actions */}
          <div className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#222] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                Today's Core Focus
              </span>
              <p className="text-xs sm:text-sm font-semibold text-white mt-0.5">{plan.focusTheme}</p>
              <p className="text-xs text-gray-400 mt-1">{plan.summary}</p>
            </div>

            <button
              onClick={handleAutoApply}
              disabled={applied}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-md flex-shrink-0 ${
                applied
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                  : 'bg-[#f7d344] hover:bg-[#ffe26e] text-black cursor-pointer'
              }`}
            >
              {applied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
              <span>{applied ? 'Priorities Added to Tasks!' : '⚡ Apply to My Personal Tasks'}</span>
            </button>
          </div>

          {/* Top 3 Prioritized Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plan.topPriorities.map((p, idx) => (
              <div
                key={p.id}
                className="rounded-xl border border-[#262626] bg-[#121212] p-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="rounded bg-[#202020] border border-[#303030] px-2 py-0.5 text-[10px] font-bold text-gray-300">
                      #{idx + 1} Priority
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        p.urgency === 'critical'
                          ? 'bg-red-950/60 text-red-300 border border-red-800/40'
                          : p.urgency === 'high'
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                          : 'bg-blue-950/60 text-blue-300 border border-blue-800/40'
                      }`}
                    >
                      {p.urgency}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-white mb-1 leading-snug">{p.title}</h4>
                  <p className="text-[11px] text-gray-400 mb-2">{p.reason}</p>
                </div>
                <div className="pt-2 border-t border-[#1C1C1C] flex items-center gap-1.5 text-[10px] text-purple-300 font-medium">
                  <Clock className="h-3 w-3" />
                  <span>Optimal Block: {p.timeBlock}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Multi-Day Focus Slots & Availability Explorer */}
          <div className="rounded-xl border border-[#222] bg-[#0E0E0E] p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#f7d344]" />
                <span className="text-xs font-bold text-white">
                  Smart Focus Slots & Availability ({targetDayLabel})
                </span>
              </div>

              {/* Day & Duration Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Day selector pills */}
                <div className="flex rounded-lg bg-[#181818] p-0.5 border border-[#262626]">
                  {[
                    { label: 'Today', offset: 0 },
                    { label: 'Tomorrow', offset: 1 },
                    { label: 'Day After', offset: 2 },
                  ].map((d) => (
                    <button
                      key={d.offset}
                      onClick={() => setSelectedDayOffset(d.offset)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                        selectedDayOffset === d.offset
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {/* Duration selector pills */}
                <div className="flex rounded-lg bg-[#181818] p-0.5 border border-[#262626]">
                  {[45, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setFocusDuration(mins)}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${
                        focusDuration === mins
                          ? 'bg-[#2E2E2E] text-[#f7d344] font-semibold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Slots Grid */}
            {availableSlots.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-2">
                No open {focusDuration}-minute focus gaps found for {targetDayLabel} between scheduled sessions.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                {availableSlots.map((slot, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col justify-between p-3 rounded-xl bg-[#141414] border border-[#262626] hover:border-purple-500/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white">{slot.formattedTime}</span>
                        <span className="text-[10px] text-purple-300 font-semibold bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40">
                          {slot.durationMinutes}m
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400 block mb-2">{slot.label}</span>
                    </div>

                    <button
                      onClick={() => handleBlockSpecificSlot(slot, idx)}
                      disabled={bookingSlotIdx === idx}
                      className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 py-1.5 text-xs font-bold text-white transition-all cursor-pointer shadow-sm"
                    >
                      <Zap className="h-3 w-3" />
                      <span>{bookingSlotIdx === idx ? 'Booking...' : '⚡ Block on Calendar'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
