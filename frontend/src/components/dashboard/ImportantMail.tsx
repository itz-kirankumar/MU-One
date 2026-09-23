'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  Clock,
  Calendar,
  ChevronDown,
  CheckCircle2,
  Circle,
  ArrowUpRight,
  Mail,
} from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAvatarColor(name: string): string {
  const colors = ['#EA4335', '#1A73E8', '#188038', '#F29900', '#9334E6', '#12B5CB', '#E52592', '#FA7B17'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) { hash = (hash << 5) - hash + name.charCodeAt(i); hash |= 0; }
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
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const itemDate = new Date(d); itemDate.setHours(0, 0, 0, 0);
  if (itemDate.getTime() === today.getTime()) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Deadline pill ───────────────────────────────────────────────────────────

function DeadlinePill({ status, dueDate }: { status: string; dueDate?: string }) {
  if (!dueDate) return null;
  if (status === 'passed') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#2A0E10] text-[#F87171] border border-[#EF4444]/30">
      <AlertCircle className="h-2.5 w-2.5" /> Passed
    </span>
  );
  if (status === 'today') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#2A2000] text-[#FBBF24] border border-[#F59E0B]/40 animate-pulse">
      <Clock className="h-2.5 w-2.5" /> Due Today
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#1C180E] text-amber-300 border border-amber-500/25">
      <Calendar className="h-2.5 w-2.5" /> {formatMailDueDate(dueDate)}
    </span>
  );
}

// ─── Mail Row ────────────────────────────────────────────────────────────────

interface MailRowProps {
  mail: MailSignal;
  onClick: () => void;
  onComplete: () => void;
  todayStr: string;
  isCompleted?: boolean;
}

function MailRow({ mail, onClick, onComplete, todayStr, isCompleted = false }: MailRowProps) {
  const senderRaw = mail.sender || mail.from || mail.fromEmail || "Masters' Union";
  const senderName = senderRaw.replace(/\s*<[^>]+>/, '').trim() || senderRaw;
  const avatarBg = getAvatarColor(senderRaw);
  const effectiveDueDate = mail.dueDate || extractMailDueDate(mail.subject, mail.snippet, mail.receivedAt);
  const deadlineStatus = getMailDeadlineStatus(effectiveDueDate, todayStr);
  const isPassed = deadlineStatus === 'passed';
  const isToday = deadlineStatus === 'today';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={`group cursor-pointer flex items-center gap-3 px-4 py-3 transition-all ${
        isCompleted
          ? 'opacity-40 hover:opacity-60'
          : isPassed
          ? 'bg-red-950/20 hover:bg-red-950/30'
          : isToday
          ? 'bg-amber-950/15 hover:bg-amber-950/25'
          : 'hover:bg-[#1C1C1C]'
      } focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20`}
      aria-label={`Open email: ${mail.subject}`}
    >
      {/* Completion checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onComplete(); }}
        title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        aria-label={isCompleted ? `Restore ${mail.subject}` : `Complete ${mail.subject}`}
        className="flex-shrink-0 text-gray-600 hover:text-emerald-400 focus:outline-none transition-colors"
      >
        {isCompleted
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          : <Circle className="h-4 w-4 group-hover:text-emerald-400 transition-colors" />
        }
      </button>

      {/* Avatar */}
      <div
        className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[#222] ring-offset-1 ring-offset-[#161616]"
        style={{ backgroundColor: avatarBg }}
      >
        {getInitials(senderRaw)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium truncate ${isCompleted ? 'line-through text-gray-600' : 'text-gray-400'}`}>
            {senderName}
          </span>
          {effectiveDueDate && (
            <DeadlinePill status={deadlineStatus} dueDate={effectiveDueDate} />
          )}
        </div>
        <p className={`text-[13px] font-semibold truncate leading-5 mt-0.5 ${isCompleted ? 'line-through text-gray-600' : 'text-gray-100 group-hover:text-white transition-colors'}`}>
          {mail.subject}
        </p>
        {mail.snippet && (
          <p className="text-[11px] text-gray-600 truncate leading-4 mt-0.5">{mail.snippet}</p>
        )}
      </div>

      {/* Meta: date + open link */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1.5 ml-2">
        <span className="text-[10px] text-gray-500 tabular-nums whitespace-nowrap">
          {formatReceivedDate(mail.receivedAt)}
        </span>
        <ArrowUpRight className="h-3 w-3 text-gray-700 group-hover:text-[#f7d344] transition-colors" />
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ImportantMail({ onOpenEmailCenter }: { onOpenEmailCenter?: () => void }) {
  const { dashboardData, loading, completedMailIds, markMailCompleted, unmarkMailCompleted } = useDashboard();
  const [selectedMail, setSelectedMail] = useState<MailSignal | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const todayStr = toLocalDateIso();

  const rawActiveMails =
    dashboardData?.mailSignals ??
    (dashboardData as { importantMail?: MailSignal[] })?.importantMail ??
    [];

  const allMails =
    (dashboardData as { allMailSignals?: MailSignal[] })?.allMailSignals ?? rawActiveMails;

  const completedSet = new Set(completedMailIds ?? []);
  const completedMails = allMails.filter(
    (m) => (m?.id && completedSet.has(m.id)) || (m?.messageId && completedSet.has(m.messageId))
  );

  const mails = [...rawActiveMails].sort((a, b) => {
    const dueA = a.dueDate || extractMailDueDate(a.subject, a.snippet, a.receivedAt);
    const dueB = b.dueDate || extractMailDueDate(b.subject, b.snippet, b.receivedAt);
    const statusA = getMailDeadlineStatus(dueA, todayStr);
    const statusB = getMailDeadlineStatus(dueB, todayStr);
    const rank = (s: string) => s === 'today' ? 1 : s === 'upcoming' ? 2 : s === 'passed' ? 3 : 4;
    if (rank(statusA) !== rank(statusB)) return rank(statusA) - rank(statusB);
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  });

  return (
    <>
      <section className="flex flex-col rounded-xl border border-[#222] bg-[#161616] overflow-hidden max-h-[460px]">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#1F1F1F] bg-[#161616]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
              <Mail className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Important MU Mail</h3>
          </div>
          <div className="flex items-center gap-2.5">
            {onOpenEmailCenter && (
              <button
                onClick={onOpenEmailCenter}
                className="text-xs bg-[#1F1F1F] hover:bg-[#2A2A2A] text-gray-300 hover:text-white px-2.5 py-1 rounded-md transition-colors font-medium flex items-center gap-1 border border-[#333]"
              >
                Open in Email Center
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
            {mails.length > 0 && (
              <span className="text-[10px] text-gray-500 tabular-nums bg-[#1A1A1A] border border-[#282828] px-2 py-0.5 rounded-full font-medium">
                {mails.length} active
              </span>
            )}
          </div>
        </div>

        {/* Mail list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[#1C1C1C]">
          {loading ? (
            <div className="space-y-1 px-4 py-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 items-center py-2.5">
                  <div className="h-4 w-4 flex-shrink-0 animate-pulse rounded-full bg-[#2A2A2A]" />
                  <div className="h-8 w-8 flex-shrink-0 animate-pulse rounded-full bg-[#2A2A2A]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/4 animate-pulse rounded bg-[#2A2A2A]" />
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#222]" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-[#1E1E1E]" />
                  </div>
                </div>
              ))}
            </div>
          ) : mails.length === 0 ? (
            <div className="py-10">
              <EmptyState title="All caught up!" description="No pending emails with deadlines" />
            </div>
          ) : (
            mails.map((mail, idx) => (
              <MailRow
                key={mail.id || mail.messageId || `mail-${idx}`}
                mail={mail}
                todayStr={todayStr}
                onClick={() => setSelectedMail(mail)}
                onComplete={() => { const id = mail.messageId || mail.id; if (id) markMailCompleted(id); }}
              />
            ))
          )}

          {/* Completed section */}
          {completedMails.length > 0 && (
            <div className="border-t border-[#1F1F1F]">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] text-gray-500 hover:text-gray-300 hover:bg-[#1A1A1A] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-medium">{showCompleted ? 'Hide completed' : `${completedMails.length} completed`}</span>
                </span>
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showCompleted ? 'rotate-180' : ''}`} />
              </button>

              {showCompleted && (
                <div className="divide-y divide-[#1C1C1C]">
                  {completedMails.map((mail, idx) => (
                    <MailRow
                      key={`comp-${mail.id || mail.messageId || idx}`}
                      mail={mail}
                      todayStr={todayStr}
                      isCompleted
                      onClick={() => setSelectedMail(mail)}
                      onComplete={() => { const id = mail.messageId || mail.id; if (id) unmarkMailCompleted(id); }}
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
