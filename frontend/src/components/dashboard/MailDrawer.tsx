'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  ExternalLink,
  Clock,
  CheckSquare,
  Check,
  AlertCircle,
  Mail as MailIcon,
  Paperclip,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Archive,
  Trash2,
  Star,
  Reply,
  ReplyAll,
  Forward,
  MoreVertical,
  Tag,
  FolderInput,
  Printer,
  ChevronDown,
  ChevronUp,
  AlertOctagon,
  ArrowLeft,
} from 'lucide-react';
import { getFullMailMessage, createGoogleTask } from '@/lib/functions';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
import { extractMailDueDate } from '@/components/dashboard/ImportantMail';
import type { MailSignal } from '@/types';
import type { GetFullMailResult, MailAttachmentInfo } from '@/lib/functions';

interface MailDrawerProps {
  mail: MailSignal;
  onClose: () => void;
}

/**
 * Deterministic avatar color palette matching Gmail / Google Workspace colors.
 */
function getAvatarColor(name: string): string {
  const colors = [
    '#1A73E8', // Google Blue
    '#EA4335', // Google Red
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
  const clean = name.replace(/<[^>]+>/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'MU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function parseSender(fromStr?: string): { name: string; email: string } {
  if (!fromStr) return { name: "Masters' Union", email: '' };
  const match = fromStr.match(/^(.*?)\s*<([^>]+)>/);
  if (match) {
    return {
      name: match[1].replace(/["']/g, '').trim() || match[2],
      email: match[2].trim(),
    };
  }
  if (fromStr.includes('@')) {
    return { name: fromStr.trim(), email: fromStr.trim() };
  }
  return { name: fromStr.trim(), email: '' };
}

function getAttachmentIcon(mimeType: string, filename: string) {
  const lower = (filename + ' ' + mimeType).toLowerCase();
  if (lower.includes('sheet') || lower.includes('excel') || lower.includes('csv') || lower.includes('xls')) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-600 flex-shrink-0" aria-hidden="true" />;
  }
  if (lower.includes('image') || lower.includes('png') || lower.includes('jpg') || lower.includes('jpeg')) {
    return <ImageIcon className="h-4 w-4 text-purple-600 flex-shrink-0" aria-hidden="true" />;
  }
  return <FileText className="h-4 w-4 text-[#1a73e8] flex-shrink-0" aria-hidden="true" />;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    const fullStr = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
    });

    if (diffHours < 1) return `${fullStr} (just now)`;
    if (diffHours < 24) return `${fullStr} (${diffHours}h ago)`;
    if (diffDays === 1) return `${fullStr} (yesterday)`;
    if (diffDays < 7) return `${fullStr} (${diffDays}d ago)`;
    return fullStr;
  } catch {
    return dateStr;
  }
}

/**
 * Intelligent HTML & text formatter that matches authentic Gmail rendering.
 * Preserves bold formatting, paragraphs, spacing, and makes all URLs/emails clickable in Google Blue.
 */
function formatMailContent(html?: string, text?: string, snippet?: string): string {
  if (html && html.trim() && html !== '<p></p>') {
    let result = html;
    // Disarm any dangerous javascript links
    result = result.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
    // Ensure all <a> links open in new tab and have Google Blue clickable styling
    result = result.replace(/<a\b([^>]*)>/gi, (_match, attrs) => {
      const cleanAttrs = attrs
        .replace(/\starget\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '')
        .replace(/\srel\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '');
      return `<a ${cleanAttrs.trim()} target="_blank" rel="noopener noreferrer" style="color: #1a73e8; text-decoration: underline; cursor: pointer; font-weight: 500;">`;
    });
    return result;
  }

  // Fallback: format plain text or snippet into structured Gmail HTML
  const raw = text || snippet || '';
  if (!raw.trim()) {
    return '<p style="color: #5f6368; font-style: italic;">No message content available.</p>';
  }

  // 1. Normalize line endings
  let clean = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Escape HTML special characters
  clean = clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // 3. Convert markdown bold *text* to <strong>text</strong>
  clean = clean.replace(/\*([^*\n]+)\*/g, '<strong style="font-weight: 600; color: #202124;">$1</strong>');

  // 4. Convert markdown italics _text_ to <em>text</em>
  clean = clean.replace(/_([^_\n]+)_/g, '<em>$1</em>');

  // 5. Convert URLs to clickable links opening in new tab
  clean = clean.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #1a73e8; text-decoration: underline; word-break: break-all; cursor: pointer; font-weight: 500;">$1</a>'
  );

  clean = clean.replace(
    /(^|[^\/])(www\.[^\s<>"']+)/g,
    '$1<a href="https://$2" target="_blank" rel="noopener noreferrer" style="color: #1a73e8; text-decoration: underline; word-break: break-all; cursor: pointer; font-weight: 500;">$2</a>'
  );

  // 6. Convert email addresses to mailto links
  clean = clean.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '<a href="mailto:$1" style="color: #1a73e8; text-decoration: underline; cursor: pointer; font-weight: 500;">$1</a>'
  );

  // 7. If clean has genuine newlines, split into clean paragraphs
  if (clean.includes('\n')) {
    const paragraphs = clean.split(/\n{2,}/);
    return paragraphs
      .map((p) => `<p style="margin-bottom: 14px; line-height: 1.65;">${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');
  }

  // 8. If newlines were squashed into spaces (e.g. snippet text), intelligently reconstruct paragraphs
  let structured = clean;
  structured = structured.replace(/(Dear [^,]+,)/g, '$1\n\n');
  structured = structured.replace(/(We will be hosting)/g, '\n\n$1');
  structured = structured.replace(/(This will be an opportunity)/g, '\n\n$1');
  structured = structured.replace(/(The session will be)/g, '\n\n$1');
  structured = structured.replace(/(Please note that)/g, '\n\n$1');
  structured = structured.replace(/(<strong[^>]*>Form:<\/strong>|Form:)/g, '\n\n$1');
  structured = structured.replace(/(Please fill out the form only)/g, '\n\n$1');
  structured = structured.replace(/(<strong[^>]*>Deadline:<\/strong>|Deadline:)/g, '\n\n$1');
  structured = structured.replace(/(Best Regards,)/g, '\n\n$1\n\n');
  structured = structured.replace(/(Site:)/g, '\n\n$1');

  const paras = structured.split(/\n{2,}/);
  return paras
    .map((p) => `<p style="margin-bottom: 14px; line-height: 1.65;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export function MailDrawer({ mail, onClose }: MailDrawerProps) {
  const [data, setData] = useState<GetFullMailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [taskAdded, setTaskAdded] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [isStarred, setIsStarred] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const gmailWebUrl = `https://mail.google.com/mail/u/0/#inbox/${mail.threadId ?? mail.messageId}`;

  const fetchMail = () => {
    setLoading(true);
    setError('');
    getFullMailMessage({ messageId: mail.messageId })
      .then((res) => {
        setData(res);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load email');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMail();
  }, [mail.messageId]);

  // Close on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleCreateTask() {
    if (taskAdded || addingTask) return;
    setAddingTask(true);
    setTaskError('');
    try {
      await createGoogleTask({
        title: mail.subject,
        dueDate: mail.dueDate ?? undefined,
      });
      setTaskAdded(true);
    } catch (err: unknown) {
      setTaskError(err instanceof Error ? err.message : 'Could not add task');
    } finally {
      setAddingTask(false);
    }
  }

  // Intercept any link clicks inside the email body to open cleanly in new tab
  const handleBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      e.preventDefault();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  };

  const rawFrom = data?.from || mail.sender || mail.from || mail.fromEmail || "Masters' Union";
  const { name: senderName, email: senderEmail } = parseSender(rawFrom);
  const avatarBg = getAvatarColor(senderName || senderEmail);
  const attachments: MailAttachmentInfo[] = data?.attachments ?? [];
  const senderDomain = senderEmail.includes('@') ? senderEmail.split('@')[1] : 'mastersunion.org';

  const renderedContentHtml = formatMailContent(
    data?.formattedHtml,
    data?.body,
    mail.snippet
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Email: ${mail.subject}`}
    >
      {/* Scoped CSS to ensure 100% authentic Gmail typography, tables, and links */}
      <style>{`
        .gmail-reading-pane {
          font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
          font-size: 14px;
          line-height: 1.65;
          color: #202124;
          word-break: break-word;
        }
        .gmail-reading-pane p {
          margin-top: 0;
          margin-bottom: 14px;
          line-height: 1.65;
        }
        .gmail-reading-pane b, .gmail-reading-pane strong {
          font-weight: 600;
          color: #202124;
        }
        .gmail-reading-pane a {
          color: #1a73e8 !important;
          text-decoration: underline !important;
          cursor: pointer !important;
          font-weight: 500;
        }
        .gmail-reading-pane a:hover {
          color: #174ea6 !important;
        }
        .gmail-reading-pane ul, .gmail-reading-pane ol {
          margin-top: 6px;
          margin-bottom: 14px;
          padding-left: 24px;
        }
        .gmail-reading-pane li {
          margin-bottom: 6px;
        }
        .gmail-reading-pane table {
          border-collapse: collapse;
          max-width: 100%;
          margin: 14px 0;
        }
        .gmail-reading-pane th, .gmail-reading-pane td {
          padding: 8px 12px;
          border: 1px solid #dadce0;
        }
        .gmail-reading-pane hr {
          border: none;
          border-top: 1px solid #dadce0;
          margin: 20px 0;
        }
        .gmail-reading-pane img {
          max-width: 100%;
          height: auto;
          display: inline-block;
        }
        .gmail-reading-pane blockquote {
          border-left: 3px solid #dadce0;
          padding-left: 14px;
          margin-left: 0;
          color: #5f6368;
        }
      `}</style>

      {/* Gmail Window Container */}
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[94vh] rounded-2xl border border-[#2D2D2D] bg-white shadow-2xl overflow-hidden text-[#202124]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Gmail Top Toolbar (Standard Gmail Actions) */}
        <div className="flex items-center justify-between border-b border-[#E0E0E0] bg-[#F6F8FC] px-3 sm:px-4 py-2 select-none text-[#5F6368]">
          {/* Left Toolbar Icons */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={onClose}
              title="Back to list (Esc)"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#E8EAED] hover:text-[#202124] transition-colors focus:outline-none"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="h-4 w-[1px] bg-[#DADCE0] mx-1 hidden sm:block" />

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Archive in Gmail"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#E8EAED] hover:text-[#202124] transition-colors"
            >
              <Archive className="h-4 w-4" />
            </a>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Report spam"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#E8EAED] hover:text-[#202124] transition-colors"
            >
              <AlertOctagon className="h-4 w-4" />
            </a>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Delete in Gmail"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#E8EAED] hover:text-[#202124] transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </a>

            <div className="h-4 w-[1px] bg-[#DADCE0] mx-1 hidden sm:block" />

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Mark as unread"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#E8EAED] hover:text-[#202124] transition-colors hidden sm:flex"
            >
              <MailIcon className="h-4 w-4" />
            </a>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Snooze"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#E8EAED] hover:text-[#202124] transition-colors hidden sm:flex"
            >
              <Clock className="h-4 w-4" />
            </a>

            {/* Quick Add to Tasks action */}
            <button
              onClick={handleCreateTask}
              disabled={addingTask || taskAdded}
              title={taskAdded ? 'Added to Google Tasks' : 'Add to Google Tasks'}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                taskAdded
                  ? 'bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333]'
                  : 'hover:bg-[#E8EAED] text-[#3C4043] border border-[#DADCE0]'
              }`}
            >
              {addingTask ? (
                <LoadingSpinner size="sm" />
              ) : taskAdded ? (
                <Check className="h-3.5 w-3.5 text-[#137333]" />
              ) : (
                <CheckSquare className="h-3.5 w-3.5 text-[#1a73e8]" />
              )}
              <span className="hidden md:inline">{taskAdded ? 'Added to Tasks' : 'Add to Tasks'}</span>
            </button>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Move to folder"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#E8EAED] hover:text-[#202124] transition-colors hidden md:flex"
            >
              <FolderInput className="h-4 w-4" />
            </a>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Labels"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#E8EAED] hover:text-[#202124] transition-colors hidden md:flex"
            >
              <Tag className="h-4 w-4" />
            </a>
          </div>

          {/* Right Toolbar Icons */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => window.print()}
              title="Print email"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#E8EAED] hover:text-[#202124] transition-colors hidden sm:flex"
            >
              <Printer className="h-4 w-4" />
            </button>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open full thread in Gmail"
              className="flex items-center gap-1.5 rounded-full border border-[#DADCE0] bg-white px-3 py-1 text-xs font-medium text-[#1a73e8] hover:bg-[#F8FAFD] transition-colors shadow-xs"
            >
              <span>Open in Gmail</span>
              <ExternalLink className="h-3 w-3" />
            </a>

            <button
              onClick={onClose}
              title="Close window (Esc)"
              aria-label="Close email window"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#E8EAED] hover:text-[#202124] transition-colors ml-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 2. Email Subject Line Header (Identical to Image 1) */}
        <div className="border-b border-[#ECEFF1] bg-white px-6 sm:px-8 pt-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <h1 className="text-xl sm:text-[22px] font-normal text-[#202124] leading-snug tracking-tight">
              {mail.subject}
            </h1>

            {/* Badges */}
            {(() => {
              const effectiveDueDate = mail.dueDate || extractMailDueDate(mail.subject, mail.snippet, mail.receivedAt);
              const hasDeadline = Boolean(effectiveDueDate) || Boolean(mail.isDeadlineSignal);
              return (
                <div className="flex flex-wrap items-center gap-2 flex-shrink-0 pt-0.5">
                  <span className="inline-flex items-center rounded-md bg-[#1E1E1E] text-gray-200 text-xs font-medium px-2.5 py-1 border border-[#333333]">
                    Inbox
                  </span>
                  {hasDeadline && (
                    <Badge variant="error" className="px-2.5 py-1 text-xs font-semibold shadow-xs">
                      Deadline Signal
                    </Badge>
                  )}
                  {effectiveDueDate && (
                    <Badge variant="warning" className="px-2.5 py-1 text-xs font-semibold shadow-xs tabular-nums">
                      Due:{' '}
                      {new Date(effectiveDueDate + 'T00:00:00').toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Badge>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* 3. Sender Details & Recipient Row (Identical to Image 1) */}
        <div className="border-b border-[#F1F3F4] bg-white px-6 sm:px-8 py-3.5">
          <div className="flex items-start justify-between gap-3">
            {/* Sender Avatar & Identity */}
            <div className="flex items-start gap-3.5 min-w-0">
              {/* Google Workspace Colored Circle Avatar */}
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white font-medium text-sm shadow-xs"
                style={{ backgroundColor: avatarBg }}
              >
                {getInitials(senderName)}
              </div>

              {/* Sender Name, Address & "to me" dropdown */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-semibold text-sm text-[#202124]">
                    {senderName}
                  </span>
                  {senderEmail && (
                    <span className="text-xs text-[#5F6368]">
                      &lt;{senderEmail}&gt;
                    </span>
                  )}
                </div>

                {/* "to me" chevron */}
                <div className="relative mt-0.5">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1 text-xs text-[#5F6368] hover:text-[#202124] transition-colors focus:outline-none"
                    aria-expanded={showDetails}
                  >
                    <span>to {data?.to ? (data.to.includes('<') ? data.to.split('<')[0].trim() : 'me') : 'me'}</span>
                    {showDetails ? (
                      <ChevronUp className="h-3 w-3 text-[#5F6368]" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-[#5F6368]" />
                    )}
                  </button>

                  {/* Authentic Gmail Details Popover */}
                  {showDetails && (
                    <div className="absolute top-6 left-0 z-30 w-80 sm:w-96 rounded-xl border border-[#DADCE0] bg-white p-4 shadow-xl text-xs space-y-2 text-[#3C4043]">
                      <div className="flex items-start justify-between pb-1.5 border-b border-[#ECEFF1]">
                        <span className="font-semibold text-[#202124]">Email Details</span>
                        <button
                          onClick={() => setShowDetails(false)}
                          className="text-[#5F6368] hover:text-[#202124]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-[70px_1fr] gap-1.5 pt-1">
                        <span className="text-[#5F6368]">from:</span>
                        <span className="text-[#202124] font-medium break-all">{rawFrom}</span>

                        <span className="text-[#5F6368]">to:</span>
                        <span className="text-[#202124] break-all">{data?.to || 'me'}</span>

                        <span className="text-[#5F6368]">date:</span>
                        <span className="text-[#202124]">
                          {new Date(mail.receivedAt).toLocaleString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>

                        <span className="text-[#5F6368]">subject:</span>
                        <span className="text-[#202124]">{mail.subject}</span>

                        <span className="text-[#5F6368]">mailed-by:</span>
                        <span className="text-[#202124]">{senderDomain}</span>

                        <span className="text-[#5F6368]">signed-by:</span>
                        <span className="text-[#202124]">{senderDomain}</span>

                        <span className="text-[#5F6368]">security:</span>
                        <span className="text-[#137333] font-medium flex items-center gap-1">
                          🔒 Standard encryption (TLS)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side: Timestamp, Star, Reply, More */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 text-[#5F6368]">
              <span className="text-xs text-[#5F6368] whitespace-nowrap hidden sm:inline">
                {formatRelativeTime(mail.receivedAt)}
              </span>

              <button
                onClick={() => setIsStarred(!isStarred)}
                title={isStarred ? 'Starred' : 'Not starred'}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1F3F4] transition-colors"
              >
                <Star
                  className={`h-4 w-4 ${
                    isStarred
                      ? 'text-[#F4B400] fill-[#F4B400]'
                      : 'text-[#5F6368] hover:text-[#202124]'
                  }`}
                />
              </button>

              <a
                href={gmailWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Reply"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1F3F4] hover:text-[#202124] transition-colors"
              >
                <Reply className="h-4 w-4" />
              </a>

              <a
                href={gmailWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="More options"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1F3F4] hover:text-[#202124] transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* 4. Email Body Canvas (Pure White Gmail Canvas matching Image 1) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-8 py-6 bg-white min-h-[360px]">
          {loading ? (
            <div className="space-y-4 py-8 max-w-2xl">
              <div className="flex items-center gap-2.5 text-xs text-[#5F6368]">
                <LoadingSpinner size="sm" />
                <span>Loading formatted email from Gmail...</span>
              </div>
              <div className="h-4 w-5/6 animate-pulse rounded bg-[#F1F3F4]" />
              <div className="h-4 w-full animate-pulse rounded bg-[#F1F3F4]" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-[#F1F3F4]" />
              <div className="h-4 w-4/6 animate-pulse rounded bg-[#F1F3F4]" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50/60 p-5">
              <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                <AlertCircle className="h-4 w-4" />
                <span>Could not load full message from Gmail</span>
              </div>
              <p className="mt-1 text-xs text-red-600">{error}</p>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={fetchMail}
                  className="rounded-lg bg-white border border-red-200 px-3.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                >
                  Retry
                </button>
                <a
                  href={gmailWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#1a73e8] hover:underline"
                >
                  Open directly in Gmail &rarr;
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Formatted HTML Message Body with clickable links and authentic styling */}
              <div
                className="gmail-reading-pane select-text"
                dangerouslySetInnerHTML={{ __html: renderedContentHtml }}
                onClick={handleBodyClick}
              />

              {/* Attachments Section (Exact Gmail attachment card style) */}
              {attachments.length > 0 && (
                <div className="pt-4 border-t border-[#ECEFF1]">
                  <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-[#5F6368]">
                    <Paperclip className="h-4 w-4 text-[#1a73e8]" aria-hidden="true" />
                    <span>Attachments ({attachments.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="group flex items-center justify-between rounded-xl border border-[#DADCE0] bg-[#F8FAFD] p-3 text-xs text-[#202124] hover:border-[#1a73e8]/50 hover:bg-white transition-colors shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 rounded-lg bg-white border border-[#E0E0E0] group-hover:border-[#1a73e8]/30 transition-colors">
                            {getAttachmentIcon(att.mimeType, att.filename)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[160px] text-[#202124]" title={att.filename}>
                              {att.filename}
                            </p>
                            {att.size > 0 && (
                              <p className="text-[11px] text-[#5F6368]">
                                {att.size > 1048576
                                  ? `${(att.size / 1048576).toFixed(1)} MB`
                                  : `${Math.round(att.size / 1024)} KB`}
                              </p>
                            )}
                          </div>
                        </div>

                        <a
                          href={gmailWebUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open attachment in Gmail"
                          className="p-1.5 text-[#5F6368] hover:text-[#1a73e8] transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. Bottom Gmail Reply / Forward / Tasks Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEFF1] bg-[#F8FAFD] px-6 sm:px-8 py-4">
          {/* Gmail Action Pills: Reply, Reply All, Forward */}
          <div className="flex items-center gap-2">
            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-[#DADCE0] bg-white px-5 py-2 text-xs font-medium text-[#3C4043] hover:bg-[#F1F3F4] hover:border-[#C6C8CC] transition-colors shadow-2xs"
            >
              <Reply className="h-3.5 w-3.5 text-[#5F6368]" />
              <span>Reply</span>
            </a>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-[#DADCE0] bg-white px-5 py-2 text-xs font-medium text-[#3C4043] hover:bg-[#F1F3F4] hover:border-[#C6C8CC] transition-colors hidden sm:flex shadow-2xs"
            >
              <ReplyAll className="h-3.5 w-3.5 text-[#5F6368]" />
              <span>Reply all</span>
            </a>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-[#DADCE0] bg-white px-5 py-2 text-xs font-medium text-[#3C4043] hover:bg-[#F1F3F4] hover:border-[#C6C8CC] transition-colors hidden sm:flex shadow-2xs"
            >
              <Forward className="h-3.5 w-3.5 text-[#5F6368]" />
              <span>Forward</span>
            </a>
          </div>

          {/* Add to Google Tasks Integration */}
          <div className="flex items-center gap-3">
            {taskError && <span className="text-xs text-red-500">{taskError}</span>}

            <button
              onClick={handleCreateTask}
              disabled={addingTask || taskAdded}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold transition-all shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8] ${
                taskAdded
                  ? 'bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333]'
                  : 'bg-[#1a73e8] text-white hover:bg-[#1557bf] active:scale-95'
              }`}
            >
              {addingTask ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Adding to Tasks...</span>
                </>
              ) : taskAdded ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#137333]" />
                  <span>Added to Google Tasks</span>
                </>
              ) : (
                <>
                  <CheckSquare className="h-3.5 w-3.5" />
                  <span>Add to Google Tasks</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
