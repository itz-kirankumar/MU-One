'use client';

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { MailDrawer } from '@/components/dashboard/MailDrawer';
import type { MailSignal } from '@/types';

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

const MONTHS_MAP: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_REGEX_PART = Object.keys(MONTHS_MAP).join('|');

function toIsoDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function extractMailDueDate(
  subject?: string,
  snippet?: string,
  receivedAt?: string
): string | null {
  const text = `${subject || ''}\n${snippet || ''}`;
  if (!text.trim()) return null;

  const baseDate = receivedAt ? new Date(receivedAt) : new Date();
  const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const currentYear = validBase.getFullYear();
  const lower = text.toLowerCase();

  const triggerPattern =
    /\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\b/i;
  if (!triggerPattern.test(text)) {
    return null;
  }

  // "due today"
  if (
    /\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\b[^.]{0,35}\btoday\b/i.test(
      lower
    )
  ) {
    return toIsoDateStr(validBase.getFullYear(), validBase.getMonth() + 1, validBase.getDate());
  }

  // "due tomorrow"
  if (
    /\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\b[^.]{0,35}\btomorrow\b/i.test(
      lower
    )
  ) {
    const tom = new Date(validBase);
    tom.setDate(tom.getDate() + 1);
    return toIsoDateStr(tom.getFullYear(), tom.getMonth() + 1, tom.getDate());
  }

  // "due YYYY-MM-DD"
  const isoMatch = text.match(
    /\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\b[^.\d]{0,35}(\d{4}-\d{2}-\d{2})\b/i
  );
  if (isoMatch) {
    const d = new Date(isoMatch[2]);
    if (!isNaN(d.getTime())) return isoMatch[2];
  }

  // "due dd/mm/yyyy" or "due dd-mm-yyyy"
  const dmyMatch = text.match(
    /\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\b[^\d]{0,35}(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/i
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[2], 10);
    const month = parseInt(dmyMatch[3], 10);
    let year = parseInt(dmyMatch[4], 10);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return toIsoDateStr(year, month, day);
    }
  }

  // "due 15 September [2026]" or "Deadline: 15th Sept 2026"
  const dayMonthYearMatch = text.match(
    new RegExp(
      `\\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\\b[^.\\d]{0,35}(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTH_REGEX_PART})(?:,?\\s*(\\d{4}))?\\b`,
      'i'
    )
  );
  if (dayMonthYearMatch) {
    const day = parseInt(dayMonthYearMatch[2], 10);
    const monthName = dayMonthYearMatch[3].toLowerCase();
    const month = MONTHS_MAP[monthName];
    const year = dayMonthYearMatch[4] ? parseInt(dayMonthYearMatch[4], 10) : currentYear;
    if (month && day >= 1 && day <= 31) {
      return toIsoDateStr(year, month, day);
    }
  }

  // "due September 15 [, 2026]" or "Deadline: Sept 15th, 2026"
  const monthDayYearMatch = text.match(
    new RegExp(
      `\\b(due|deadline|submit(?: by)?|submission(?: by)?|conclude(?:s)?(?: on)?|ends?(?: on)?|last date|closes?(?: on)?|apply by|complete by)\\b[^.\\d]{0,35}(${MONTH_REGEX_PART})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`,
      'i'
    )
  );
  if (monthDayYearMatch) {
    const monthName = monthDayYearMatch[2].toLowerCase();
    const month = MONTHS_MAP[monthName];
    const day = parseInt(monthDayYearMatch[3], 10);
    const year = monthDayYearMatch[4] ? parseInt(monthDayYearMatch[4], 10) : currentYear;
    if (month && day >= 1 && day <= 31) {
      return toIsoDateStr(year, month, day);
    }
  }

  return null;
}

function formatMailDueDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, monthIndex, day);
    if (!isNaN(d.getTime())) {
      const currentYear = new Date().getFullYear();
      const monthStr = d.toLocaleDateString('en-GB', { month: 'short' });
      if (year !== currentYear) {
        return `${day} ${monthStr} ${year}`;
      }
      return `${day} ${monthStr}`;
    }
  }
  return isoDate;
}

function MailRow({
  mail,
  onClick,
}: {
  mail: MailSignal;
  onClick: () => void;
}) {
  const senderName = mail.sender || mail.from || mail.fromEmail || 'Masters\' Union';
  const avatarBg = getAvatarColor(senderName);
  const effectiveDueDate = mail.dueDate || extractMailDueDate(mail.subject, mail.snippet, mail.receivedAt);
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
      className="group cursor-pointer flex items-start gap-3 rounded-xl px-3.5 py-3 hover:bg-[#1C1C1C] transition-colors border border-transparent hover:border-[#2A2A2A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
      aria-label={`Open email: ${mail.subject}`}
    >
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
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 tabular-nums">
                Due {formatMailDueDate(effectiveDueDate)}
              </span>
            )}
            <span className="text-[10px] text-gray-500">
              {formatReceivedDate(mail.receivedAt)}
            </span>
          </div>
        </div>
        <p className="mt-0.5 truncate text-sm text-gray-300 font-medium group-hover:text-[#f7d344] transition-colors">
          {mail.subject}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 leading-relaxed">
          {mail.snippet}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {hasDeadline && <Badge variant="error">Deadline</Badge>}
          {effectiveDueDate && (
            <Badge variant="warning">
              Due {formatMailDueDate(effectiveDueDate)}
            </Badge>
          )}
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
  const { dashboardData, loading } = useDashboard();
  const [selectedMail, setSelectedMail] = useState<MailSignal | null>(null);

  const rawMails =
    dashboardData?.mailSignals ??
    (dashboardData as { importantMail?: MailSignal[] })?.importantMail ??
    [];

  const mails = [...rawMails].sort((a, b) => {
    const dueA = a.dueDate || extractMailDueDate(a.subject, a.snippet, a.receivedAt);
    const dueB = b.dueDate || extractMailDueDate(b.subject, b.snippet, b.receivedAt);

    // Both have due dates: sort by due date ascending (top to bottom chronological order)
    if (dueA && dueB) {
      const diff = dueA.localeCompare(dueB);
      if (diff !== 0) return diff;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    }

    // A has a due date, B does not: A comes first (top)
    if (dueA && !dueB) return -1;
    // B has a due date, A does not: B comes first (top)
    if (!dueA && dueB) return 1;

    // Next: emails with deadline signals (but no date) come before regular mail
    const sigA = Boolean(a.isDeadlineSignal);
    const sigB = Boolean(b.isDeadlineSignal);
    if (sigA && !sigB) return -1;
    if (!sigA && sigB) return 1;

    // Regular emails: sort by receivedAt descending (newest first)
    return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
  });

  return (
    <>
      <section className="rounded-xl border border-[#222] bg-[#161616] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1A1A1A]">
          <h3 className="text-sm font-semibold text-white">Important MU Mail</h3>
        </div>

        <div className="px-2 py-2 space-y-0.5">
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
            <EmptyState title="No important mail" description="MU emails will appear here after syncing" />
          ) : (
            mails.map((mail, idx) => (
              <MailRow
                key={mail.id || mail.messageId || `mail-${idx}`}
                mail={mail}
                onClick={() => setSelectedMail(mail)}
              />
            ))
          )}
        </div>
      </section>

      {selectedMail && (
        <MailDrawer mail={selectedMail} onClose={() => setSelectedMail(null)} />
      )}
    </>
  );
}
