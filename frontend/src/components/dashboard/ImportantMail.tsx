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

function MailRow({
  mail,
  onClick,
}: {
  mail: MailSignal;
  onClick: () => void;
}) {
  const senderName = mail.sender || mail.from || mail.fromEmail || 'Masters\' Union';
  const avatarBg = getAvatarColor(senderName);

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
          <span className="flex-shrink-0 text-[10px] text-gray-500">
            {formatReceivedDate(mail.receivedAt)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-gray-300 font-medium group-hover:text-[#f7d344] transition-colors">
          {mail.subject}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 leading-relaxed">
          {mail.snippet}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {mail.isDeadlineSignal && <Badge variant="error">Deadline</Badge>}
          {mail.dueDate && (
            <Badge variant="warning">
              Due{' '}
              {new Date(mail.dueDate + 'T00:00:00').toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}
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
  const mails = [...rawMails].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );

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
