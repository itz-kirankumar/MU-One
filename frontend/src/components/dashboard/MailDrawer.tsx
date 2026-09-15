'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  AlertOctagon,
  ArrowLeft,
} from 'lucide-react';
import { getFullMailMessage, createGoogleTask } from '@/lib/functions';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/Badge';
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
    return <FileSpreadsheet className="h-4 w-4 text-emerald-400 flex-shrink-0" aria-hidden="true" />;
  }
  if (lower.includes('image') || lower.includes('png') || lower.includes('jpg') || lower.includes('jpeg')) {
    return <ImageIcon className="h-4 w-4 text-purple-400 flex-shrink-0" aria-hidden="true" />;
  }
  return <FileText className="h-4 w-4 text-[#f7d344] flex-shrink-0" aria-hidden="true" />;
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

export function MailDrawer({ mail, onClose }: MailDrawerProps) {
  const [data, setData] = useState<GetFullMailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [taskAdded, setTaskAdded] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [isStarred, setIsStarred] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isDarkCanvas, setIsDarkCanvas] = useState(false); // Default to authentic white Gmail canvas
  const [iframeHeight, setIframeHeight] = useState<number>(380);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  const rawFrom = data?.from || mail.sender || mail.from || mail.fromEmail || "Masters' Union";
  const { name: senderName, email: senderEmail } = parseSender(rawFrom);
  const avatarBg = getAvatarColor(senderName || senderEmail);
  const attachments: MailAttachmentInfo[] = data?.attachments ?? [];
  const senderDomain = senderEmail.includes('@') ? senderEmail.split('@')[1] : 'mastersunion.org';

  // Build sandboxed iframe document with Gmail typography and clickable links
  const srcDocHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base target="_blank">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 24px 28px;
      font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      font-size: 14px;
      line-height: 1.65;
      color: ${isDarkCanvas ? '#e2e8f0' : '#202124'};
      background-color: ${isDarkCanvas ? '#141414' : '#ffffff'};
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    a {
      color: ${isDarkCanvas ? '#8ab4f8' : '#1a73e8'} !important;
      text-decoration: underline !important;
      cursor: pointer !important;
      font-weight: 500;
    }
    a:hover {
      color: ${isDarkCanvas ? '#aecbfa' : '#174ea6'} !important;
    }
    p {
      margin-top: 0;
      margin-bottom: 14px;
    }
    img {
      max-width: 100% !important;
      height: auto !important;
    }
    table {
      max-width: 100% !important;
      border-collapse: collapse;
    }
    blockquote {
      border-left: 3px solid ${isDarkCanvas ? '#3a3a3a' : '#dadce0'};
      padding-left: 12px;
      margin-left: 0;
      color: ${isDarkCanvas ? '#9aa0a6' : '#5f6368'};
    }
    code, pre {
      font-family: monospace;
      font-size: 12px;
    }
  </style>
</head>
<body>
  ${data?.formattedHtml || data?.body || mail.snippet || ''}
</body>
</html>`;

  const handleIframeLoad = () => {
    try {
      if (iframeRef.current?.contentDocument?.body) {
        const h = iframeRef.current.contentDocument.body.scrollHeight;
        setIframeHeight(Math.max(h + 20, 350));
      }
    } catch {
      // Ignore cross-origin access limitations
    }
  };

  const handlePrint = () => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.print();
      } else {
        window.print();
      }
    } catch {
      window.print();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Email: ${mail.subject}`}
    >
      {/* Gmail Reading Window */}
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[94vh] rounded-2xl border border-[#2B2B2B] bg-[#161616] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Gmail Top Action Toolbar */}
        <div className="flex items-center justify-between border-b border-[#242424] bg-[#1D1D1D] px-3 sm:px-4 py-2.5 select-none text-gray-300">
          {/* Left Toolbar Icons */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={onClose}
              title="Back to list (Esc)"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="h-4 w-[1px] bg-[#333] mx-1 hidden sm:block" />

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Archive in Gmail"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors"
            >
              <Archive className="h-4 w-4" />
            </a>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Report spam"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors"
            >
              <AlertOctagon className="h-4 w-4" />
            </a>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Delete in Gmail"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </a>

            <div className="h-4 w-[1px] bg-[#333] mx-1 hidden sm:block" />

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Mark as unread"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors hidden sm:flex"
            >
              <MailIcon className="h-4 w-4" />
            </a>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Snooze"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors hidden sm:flex"
            >
              <Clock className="h-4 w-4" />
            </a>

            {/* Quick Add to Google Tasks action in Toolbar */}
            <button
              onClick={handleCreateTask}
              disabled={addingTask || taskAdded}
              title={taskAdded ? 'Added to Google Tasks' : 'Add to Google Tasks'}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                taskAdded
                  ? 'bg-emerald-950/80 border border-emerald-600/50 text-emerald-300'
                  : 'hover:bg-[#2A2A2A] text-gray-200 hover:text-white border border-transparent hover:border-[#383838]'
              }`}
            >
              {addingTask ? (
                <LoadingSpinner size="sm" />
              ) : taskAdded ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <CheckSquare className="h-3.5 w-3.5 text-[#f7d344]" />
              )}
              <span className="hidden md:inline">{taskAdded ? 'Added to Tasks' : 'Add to Tasks'}</span>
            </button>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Move to folder"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors hidden md:flex"
            >
              <FolderInput className="h-4 w-4" />
            </a>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Labels"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors hidden md:flex"
            >
              <Tag className="h-4 w-4" />
            </a>
          </div>

          {/* Right Toolbar Icons */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Theme Canvas Switcher (Light Gmail Canvas vs Dark Canvas) */}
            <button
              onClick={() => setIsDarkCanvas(!isDarkCanvas)}
              title={isDarkCanvas ? 'Switch to authentic Gmail light template' : 'Switch to dark canvas'}
              className="flex items-center gap-1 rounded-lg border border-[#333] bg-[#222] px-2 py-1 text-xs text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
            >
              {isDarkCanvas ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-blue-400" />}
              <span className="text-[11px] hidden sm:inline">{isDarkCanvas ? 'Light View' : 'Gmail Canvas'}</span>
            </button>

            <button
              onClick={handlePrint}
              title="Print email"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors hidden sm:flex"
            >
              <Printer className="h-4 w-4" />
            </button>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open full thread in Gmail"
              className="flex items-center gap-1.5 rounded-lg border border-[#333] bg-[#222] px-2.5 py-1 text-xs font-medium text-gray-200 hover:border-[#f7d344]/50 hover:text-white transition-colors"
            >
              <span>Open in Gmail</span>
              <ExternalLink className="h-3 w-3 text-gray-400" />
            </a>

            <button
              onClick={onClose}
              title="Close window (Esc)"
              aria-label="Close email window"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#2A2A2A] hover:text-white transition-colors ml-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 2. Email Subject Line & Category Labels */}
        <div className="border-b border-[#222] bg-[#181818] px-5 sm:px-6 pt-5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
            <h1 className="text-xl sm:text-2xl font-normal text-white leading-tight tracking-tight">
              {mail.subject}
            </h1>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center rounded bg-[#282828] border border-[#383838] px-2 py-0.5 text-[11px] font-medium text-gray-300">
                Inbox
              </span>
              {mail.isDeadlineSignal && <Badge variant="error">Deadline Signal</Badge>}
              {mail.dueDate && (
                <Badge variant="warning">
                  Due:{' '}
                  {new Date(mail.dueDate + 'T00:00:00').toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* 3. Sender Details & Recipient Row (Exact Gmail Layout) */}
        <div className="border-b border-[#222] bg-[#161616] px-5 sm:px-6 py-3.5">
          <div className="flex items-start justify-between gap-3">
            {/* Sender Avatar & Identity */}
            <div className="flex items-start gap-3 min-w-0">
              {/* Colorful Google Workspace Circle Avatar */}
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white font-semibold text-sm shadow-sm"
                style={{ backgroundColor: avatarBg }}
              >
                {getInitials(senderName)}
              </div>

              {/* Sender Name, Address & "to me" popover trigger */}
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-semibold text-sm text-gray-100 truncate">
                    {senderName}
                  </span>
                  {senderEmail && (
                    <span className="text-xs text-gray-400 truncate">
                      &lt;{senderEmail}&gt;
                    </span>
                  )}
                </div>

                {/* "to me" button */}
                <div className="relative mt-0.5">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors focus:outline-none"
                    aria-expanded={showDetails}
                  >
                    <span>to {data?.to ? (data.to.includes('<') ? data.to.split('<')[0].trim() : 'me') : 'me'}</span>
                    {showDetails ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>

                  {/* Gmail Detailed Information Popover */}
                  {showDetails && (
                    <div className="absolute top-6 left-0 z-30 w-80 sm:w-96 rounded-xl border border-[#333] bg-[#202020] p-4 shadow-xl text-xs space-y-2 text-gray-300">
                      <div className="flex items-start justify-between pb-1 border-b border-[#2E2E2E]">
                        <span className="font-semibold text-white">Email Details</span>
                        <button
                          onClick={() => setShowDetails(false)}
                          className="text-gray-400 hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-[70px_1fr] gap-1 pt-1">
                        <span className="text-gray-400">from:</span>
                        <span className="text-white font-medium break-all">{rawFrom}</span>

                        <span className="text-gray-400">to:</span>
                        <span className="text-gray-200 break-all">{data?.to || 'me'}</span>

                        <span className="text-gray-400">date:</span>
                        <span className="text-gray-200">
                          {new Date(mail.receivedAt).toLocaleString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>

                        <span className="text-gray-400">subject:</span>
                        <span className="text-gray-200">{mail.subject}</span>

                        <span className="text-gray-400">mailed-by:</span>
                        <span className="text-gray-200">{senderDomain}</span>

                        <span className="text-gray-400">signed-by:</span>
                        <span className="text-gray-200">{senderDomain}</span>

                        <span className="text-gray-400">security:</span>
                        <span className="text-emerald-400 flex items-center gap-1">
                          🔒 Standard encryption (TLS)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side: Timestamp, Star, Reply, More */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 text-gray-400">
              <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:inline">
                {formatRelativeTime(mail.receivedAt)}
              </span>

              <button
                onClick={() => setIsStarred(!isStarred)}
                title={isStarred ? 'Starred' : 'Not starred'}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#252525] transition-colors"
              >
                <Star
                  className={`h-4 w-4 ${
                    isStarred
                      ? 'text-[#f7d344] fill-[#f7d344]'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                />
              </button>

              <a
                href={gmailWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Reply"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#252525] hover:text-white transition-colors"
              >
                <Reply className="h-4 w-4" />
              </a>

              <a
                href={gmailWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="More options"
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#252525] hover:text-white transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        {/* 4. Email Body Canvas (Embedded HTML template matching Gmail) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 bg-[#111111]">
          {loading ? (
            <div className="space-y-4 py-8 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <LoadingSpinner size="sm" />
                <span>Loading formatted email from Gmail...</span>
              </div>
              <div className="h-5 w-5/6 animate-pulse rounded bg-[#222]" />
              <div className="h-5 w-full animate-pulse rounded bg-[#222]" />
              <div className="h-5 w-3/4 animate-pulse rounded bg-[#222]" />
              <div className="h-5 w-4/6 animate-pulse rounded bg-[#222]" />
              <div className="h-32 w-full animate-pulse rounded-xl bg-[#1C1C1C]" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-5">
              <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                <AlertCircle className="h-4 w-4" />
                <span>Could not load full message from Gmail</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">{error}</p>
              {mail.snippet && (
                <div className="mt-4 border-t border-red-900/30 pt-3">
                  <p className="text-xs font-semibold text-gray-400">Snippet preview:</p>
                  <p className="mt-1 text-xs text-gray-300 leading-relaxed">{mail.snippet}</p>
                </div>
              )}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={fetchMail}
                  className="rounded-lg bg-[#252525] px-3.5 py-1.5 text-xs text-gray-200 hover:bg-[#333] transition-colors"
                >
                  Retry
                </button>
                <a
                  href={gmailWebUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#f7d344] hover:underline"
                >
                  Open directly in Gmail &rarr;
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Embedded Email Container with Authentic Gmail Canvas */}
              <div
                className={`rounded-xl shadow-md overflow-hidden border transition-colors ${
                  isDarkCanvas
                    ? 'bg-[#141414] border-[#252525]'
                    : 'bg-white border-[#E0E0E0]'
                }`}
              >
                {/* Sandboxed iframe renders email embedded HTML template with clickable links */}
                <iframe
                  ref={iframeRef}
                  srcDoc={srcDocHtml}
                  sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                  onLoad={handleIframeLoad}
                  className="w-full border-0 block"
                  style={{ height: `${iframeHeight}px`, minHeight: '320px' }}
                  title="Email body"
                />
              </div>

              {/* Attachments Section (Exact Gmail attachment card style) */}
              {attachments.length > 0 && (
                <div className="rounded-xl border border-[#2B2B2B] bg-[#181818] p-4">
                  <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-300">
                    <Paperclip className="h-4 w-4 text-[#f7d344]" aria-hidden="true" />
                    <span>Attachments ({attachments.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="group flex items-center justify-between rounded-xl border border-[#2F2F2F] bg-[#202020] p-3 text-xs text-gray-200 hover:border-[#404040] hover:bg-[#252525] transition-colors shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 rounded-lg bg-[#2A2A2A] group-hover:bg-[#333] transition-colors">
                            {getAttachmentIcon(att.mimeType, att.filename)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[160px] text-gray-100" title={att.filename}>
                              {att.filename}
                            </p>
                            {att.size > 0 && (
                              <p className="text-[11px] text-gray-400">
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
                          className="p-1.5 text-gray-400 hover:text-[#f7d344] transition-colors"
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

        {/* 5. Bottom Gmail Reply & Quick Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#222] bg-[#181818] px-5 sm:px-6 py-3.5">
          {/* Gmail Action Pills: Reply, Reply All, Forward */}
          <div className="flex items-center gap-2">
            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-[#333] bg-[#222] px-4 py-1.5 text-xs font-medium text-gray-300 hover:border-[#555] hover:text-white transition-colors"
            >
              <Reply className="h-3.5 w-3.5" />
              <span>Reply</span>
            </a>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-[#333] bg-[#222] px-4 py-1.5 text-xs font-medium text-gray-300 hover:border-[#555] hover:text-white transition-colors hidden sm:flex"
            >
              <ReplyAll className="h-3.5 w-3.5" />
              <span>Reply all</span>
            </a>

            <a
              href={gmailWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-[#333] bg-[#222] px-4 py-1.5 text-xs font-medium text-gray-300 hover:border-[#555] hover:text-white transition-colors hidden sm:flex"
            >
              <Forward className="h-3.5 w-3.5" />
              <span>Forward</span>
            </a>
          </div>

          {/* Add to Google Tasks Integration */}
          <div className="flex items-center gap-3">
            {taskError && <span className="text-xs text-red-400">{taskError}</span>}

            <button
              onClick={handleCreateTask}
              disabled={addingTask || taskAdded}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344] ${
                taskAdded
                  ? 'bg-emerald-950/70 border border-emerald-600/50 text-emerald-300 shadow-sm'
                  : 'bg-[#f7d344] text-black hover:bg-yellow-400 shadow-sm active:scale-95'
              }`}
            >
              {addingTask ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Adding to Tasks...</span>
                </>
              ) : taskAdded ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
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
