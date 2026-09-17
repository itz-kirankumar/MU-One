'use client';

import React, { useState } from 'react';
import {
  ExternalLink,
  Circle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { MailDrawer } from '@/components/dashboard/MailDrawer';
import {
  extractMailDueDate,
  formatMailDueDate,
  getMailDeadlineStatus,
  toLocalDateIso,
} from '@/lib/mailUtils';
import type { MailSignal } from '@/types';

export { extractMailDueDate, formatMailDueDate, getMailDeadlineStatus, toLocalDateIso };

function getAvatarColor(name: string): string {
  const colors = [
    '#EA4335', // Google Red
    '#1A73E8', // Google Blue
    '#188038', // Google Green
    '#F29900', // Google Yellow/Amber
    '#9334E6', // Purple
    '#12B5CB', // Teal
    '#E52592', // Pink
    '#FA7B17', // Deep Orange
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name?: string): string {
  if (!name || typeof name !== 'string') return 'MU';
  const clean = name.replace(/<[^>]+>/, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MU';
  return parts.map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatReceivedDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const itemDate = new Date(d);
  itemDate.setHours(0, 0, 0, 0);

  if (itemDate.getTime() === today.getTime()) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface MailRowProps {
  mail: MailSignal;
  onClick: () => void;
  onComplete: (mail: MailSignal) => void;
  todayStr: string;
  isCompleted?: boolean;
}

function MailRow({
  mail,
  onClick,
  onComplete,
  todayStr,
  isCompleted = false,
}: MailRowProps) {
  const senderName = mail.sender || mail.from || mail.fromEmail || "Masters' Union";
  const avatarBg = getAvatarColor(senderName);
  const effectiveDueDate =
    mail.dueDate || extractMailDueDate(mail.subject, mail.snippet, mail.receivedAt);
  const deadlineStatus = getMailDeadlineStatus(effectiveDueDate, todayStr);
  const isPassed = deadlineStatus === 'passed';
  const isToday = deadlineStatus === 'today';
  const hasDeadline = Boolean(effectiveDueDate) || Boolean(mail.isDeadlineSignal);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group cursor-pointer flex items-start gap-3 rounded-xl px-3.5 py-3 hover:bg-[#1C1C1C] transition-all border ${
        isCompleted
          ? 'border-transparent bg-[#111] opacity-60'
          : isPassed
          ? 'border-red-900/30 bg-[#140C0E]/50 border-l-2 border-l-red-500 hover:border-red-800/60'
          : isToday
          ? 'border-amber-900/30 bg-[#161208]/50 border-l-2 border-l-[#F59E0B] hover:border-amber-800/60'
          : 'border-transparent hover:border-[#2A2A2A]'
      } focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]`}
      aria-label={`Open email: ${mail.subject}`}
    >
      {/* Interactive Completion Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onComplete(mail);
        }}
        title={isCompleted ? 'Mark as incomplete' : 'Mark as completed (removes from list)'}
        aria-label={isCompleted ? `Restore ${mail.subject}` : `Complete ${mail.subject}`}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-gray-500 hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 transition-colors mt-0.5"
      >
        {isCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <Circle className="h-4 w-4 text-gray-500 group-hover:text-emerald-400 transition-colors" />
        )}
      </button>

      {/* Sender avatar */}
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm transition-transform group-hover:scale-105"
        style={{ backgroundColor: avatarBg }}
      >
        {getInitials(senderName)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
            {senderName}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {effectiveDueDate && (
              <>
                {isPassed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#2A0E10] text-[#F87171] border border-[#EF4444]/40 tabular-nums shadow-xs">
                    <AlertCircle className="h-3 w-3 text-[#EF4444]" />
                    Passed • Due {formatMailDueDate(effectiveDueDate)}
                  </span>
                ) : isToday ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#2A2000] text-[#FBBF24] border border-[#F59E0B]/50 tabular-nums animate-pulse">
                    <Clock className="h-3 w-3 text-[#FBBF24]" />
                    Due Today
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#1C180E] text-amber-300 border border-amber-500/30 tabular-nums">
                    <Calendar className="h-3 w-3 text-amber-400" />
                    Due {formatMailDueDate(effectiveDueDate)}
                  </span>
                )}
              </>
            )}
            <span className="text-[10px] text-gray-500 tabular-nums">
              {formatReceivedDate(mail.receivedAt)}
            </span>
          </div>
        </div>
        <p
          className={`mt-0.5 truncate text-sm font-medium transition-colors ${
            isCompleted
              ? 'line-through text-gray-500'
              : 'text-gray-300 group-hover:text-[#f7d344]'
          }`}
        >
          {mail.subject}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 leading-relaxed">
          {mail.snippet}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {hasDeadline && !effectiveDueDate && <Badge variant="error">Deadline</Badge>}
          {isPassed && <Badge variant="error">Overdue</Badge>}
          {isToday && <Badge variant="warning">Today</Badge>}
        </div>
      </div>

      {/* In-app reader indicator */}
      <div
        className="flex-shrink-0 mt-1 text-gray-600 group-hover:text-[#f7d344] transition-colors p-1"
        aria-hidden="true"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}

export function ImportantMail() {
  const { dashboardData, loading, completedMailIds, markMailCompleted, unmarkMailCompleted } =
    useDashboard();
  const [selectedMail, setSelectedMail] = useState<MailSignal | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const todayStr = toLocalDateIso();

  // Raw mails from dashboard
  const rawActiveMails =
    dashboardData?.mailSignals ??
    (dashboardData as { importantMail?: MailSignal[] })?.importantMail ??
    [];

  // All mails including completed ones for the toggle
  const allMails =
    (dashboardData as { allMailSignals?: MailSignal[] })?.allMailSignals ?? rawActiveMails;

  const completedSet = new Set(completedMailIds ?? []);
  const completedMails = allMails.filter(
    (m) => (m?.id && completedSet.has(m.id)) || (m?.messageId && completedSet.has(m.messageId))
  );

  // Sort active mails: Due Today first -> Upcoming -> Passed (Red) -> No deadline
  const mails = [...rawActiveMails].sort((a, b) => {
    const dueA = a.dueDate || extractMailDueDate(a.subject, a.snippet, a.receivedAt);
    const dueB = b.dueDate || extractMailDueDate(b.subject, b.snippet, b.receivedAt);

    const statusA = getMailDeadlineStatus(dueA, todayStr);
    const statusB = getMailDeadlineStatus(dueB, todayStr);

    const rank = (status: string) => {
      if (status === 'today') return 1;
      if (status === 'upcoming') return 2;
      if (status === 'passed') return 3;
      return 4;
    };

    const rankA = rank(statusA);
    const rankB = rank(statusB);

    if (rankA !== rankB) return rankA - rankB;

    // Both today: sort by receivedAt descending
    if (statusA === 'today' && statusB === 'today') {
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    }

    // Both upcoming: earliest deadline first
    if (statusA === 'upcoming' && statusB === 'upcoming') {
      const diff = (dueA || '').localeCompare(dueB || '');
      if (diff !== 0) return diff;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    }

    // Both passed: closest past date first (most recently expired)
    if (statusA === 'passed' && statusB === 'passed') {
      const diff = (dueB || '').localeCompare(dueA || '');
      if (diff !== 0) return diff;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    }

    // Both without due date: deadline signals first, then newest
    const sigA = Boolean(a.isDeadlineSignal);
    const sigB = Boolean(b.isDeadlineSignal);
    if (sigA && !sigB) return -1;
    if (!sigA && sigB) return 1;

    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  });

  return (
    <>
      <section className="rounded-xl border border-[#222] bg-[#161616] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1A1A1A]">
          <h3 className="text-sm font-semibold text-white">Important MU Mail</h3>
          {mails.length > 0 && (
            <span className="text-[11px] text-gray-500 tabular-nums">
              {mails.length} active
            </span>
          )}
        </div>

        <div className="px-2 py-2 space-y-1">
          {loading ? (
            <div className="space-y-3 px-3 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-[#2A2A2A]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-1/2 animate-pulse rounded bg-[#2A2A2A]" />
                    <div className="h-3 w-3/4 animate-pulse rounded bg-[#222]" />
                    <div className="h-2.5 w-full animate-pulse rounded bg-[#1A1A1A]" />
                  </div>
                </div>
              ))}
            </div>
          ) : mails.length === 0 ? (
            <div className="py-6">
              <EmptyState
                title="All caught up!"
                description="No active pending emails with deadlines"
              />
            </div>
          ) : (
            mails.map((mail, idx) => (
              <MailRow
                key={mail.id || mail.messageId || `mail-${idx}`}
                mail={mail}
                todayStr={todayStr}
                onClick={() => setSelectedMail(mail)}
                onComplete={() => {
                  const id = mail.messageId || mail.id;
                  if (id) markMailCompleted(id);
                }}
              />
            ))
          )}

          {/* Collapsible Completed Section */}
          {completedMails.length > 0 && (
            <div className="mt-3 border-t border-[#1F1F1F] pt-2 px-2">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 font-medium py-1 transition-colors w-full justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>
                    {showCompleted
                      ? 'Hide completed'
                      : `Show completed (${completedMails.length})`}
                  </span>
                </div>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    showCompleted ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {showCompleted && (
                <div className="mt-2 space-y-1">
                  {completedMails.map((mail, idx) => (
                    <MailRow
                      key={`comp-${mail.id || mail.messageId || idx}`}
                      mail={mail}
                      todayStr={todayStr}
                      isCompleted={true}
                      onClick={() => setSelectedMail(mail)}
                      onComplete={() => {
                        const id = mail.messageId || mail.id;
                        if (id) unmarkMailCompleted(id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {selectedMail && (
        <MailDrawer
          mail={selectedMail}
          onClose={() => setSelectedMail(null)}
          onComplete={() => {
            const id = selectedMail.messageId || selectedMail.id;
            if (id) markMailCompleted(id);
            setSelectedMail(null);
          }}
        />
      )}
    </>
  );
}
