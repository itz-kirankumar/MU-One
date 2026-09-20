import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import type {
  NormalizedEvent,
  GoogleTask,
} from '@/types';

// ─── Result types ────────────────────────────────────────────────────────────

export interface SyncDashboardResult {
  success: boolean;
  syncedAt?: string;
}

export interface GoogleAuthUrlResult {
  /** Matches the `{ authUrl }` shape returned by the getGoogleAuthUrl function. */
  authUrl: string;
}

export interface DisconnectResult {
  success: boolean;
}

export interface CreateTaskResult {
  task: GoogleTask;
}

export interface CompleteTaskResult {
  success: boolean;
  taskId: string;
}

export interface ImportSuggestionResult {
  success: boolean;
  taskId: string;
}

export interface CreateEventResult {
  event: NormalizedEvent;
  htmlLink?: string;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  messageIds?: string[];
  sentCount?: number;
}

export interface OutgoingMailAttachment {
  filename: string;
  mimeType: string;
  dataBase64: string;
}

export interface MailAttachmentInfo {
  filename: string;
  mimeType: string;
  size: number;
}

export interface GetFullMailResult {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  bodyText?: string;
  formattedHtml?: string;
  attachments?: MailAttachmentInfo[];
  extractedDueDate?: string;
}

export interface ResearchMailTopicResult {
  topicType: 'company' | 'competition' | 'speaker' | 'general';
  summary: string;
  keyPoints: string[];
  suggestedQuestions: string[];
  sources: Array<{ title: string; url: string }>;
}

export interface PlatformAccessStatus {
  email: string;
  isAdmin: boolean;
  hasAccess: boolean;
  waitlistStatus: 'waiting' | 'approved' | null;
}

export interface AccessEntry {
  email: string;
  displayName?: string;
  status?: string;
  joinedAt?: string | null;
  grantedAt?: string | null;
}

export interface AccessListResult {
  adminEmail: string;
  granted: AccessEntry[];
  waitlist: AccessEntry[];
}

// ─── Typed Cloud Function wrappers ───────────────────────────────────────────

export async function getPlatformAccess(): Promise<PlatformAccessStatus> {
  const fn = httpsCallable<{ action: 'status' }, PlatformAccessStatus>(functions, 'accessPortal');
  const result = await fn({ action: 'status' });
  return result.data;
}

/**
 * Join the platform waitlist.
 */
export async function joinPlatformWaitlist(params?: {
  program?: string;
  section?: string;
  requestedFeatures?: string;
}): Promise<{ success: boolean; message: string; status: string }> {
  const fn = httpsCallable<
    { action: 'join'; program?: string; section?: string; requestedFeatures?: string },
    { success: boolean; message: string; status: string }
  >(functions, 'accessPortal');
  
  const result = await fn({ 
    action: 'join',
    ...params
  });
  return result.data;
}

export async function listPlatformAccess(): Promise<AccessListResult> {
  const fn = httpsCallable<{ action: 'list' }, AccessListResult>(functions, 'accessPortal');
  const result = await fn({ action: 'list' });
  return result.data;
}

export async function updatePlatformAccess(action: 'grant' | 'revoke', email: string): Promise<void> {
  const fn = httpsCallable<{ action: 'grant' | 'revoke'; email: string }, { success: boolean }>(functions, 'accessPortal');
  await fn({ action, email });
}

/**
 * Trigger a full dashboard sync (calendar, gmail, tasks).
 * Has a 3-minute server-side debounce.
 */
export async function syncDashboard(): Promise<SyncDashboardResult> {
  const fn = httpsCallable<void, SyncDashboardResult>(functions, 'syncDashboard');
  const result = await fn();
  return result.data;
}

/**
 * Get the Google OAuth URL for connecting a Google account.
 */
export async function getGoogleAuthUrl(): Promise<GoogleAuthUrlResult> {
  const fn = httpsCallable<void, GoogleAuthUrlResult>(functions, 'getGoogleAuthUrl');
  const result = await fn();
  return result.data;
}

/**
 * Disconnect the user's linked Google account and revoke tokens.
 */
export async function disconnectGoogleAccount(): Promise<DisconnectResult> {
  const fn = httpsCallable<void, DisconnectResult>(functions, 'disconnectGoogleAccount');
  const result = await fn();
  return result.data;
}

/**
 * Create a new task in Google Tasks.
 */
export async function createGoogleTask(data: {
  title: string;
  dueDate?: string; // ISO date
  taskListId?: string;
}): Promise<CreateTaskResult> {
  const fn = httpsCallable<typeof data, CreateTaskResult>(functions, 'createGoogleTask');
  const result = await fn(data);
  return result.data;
}

/**
 * Mark a Google Task as complete.
 */
export async function completeGoogleTask(data: {
  taskId: string;
  taskListId: string;
}): Promise<CompleteTaskResult> {
  const fn = httpsCallable<typeof data, CompleteTaskResult>(functions, 'completeGoogleTask');
  const result = await fn(data);
  return result.data;
}

/**
 * Import a calendar event or mail signal as a Google Task.
 * Always requires explicit user confirmation before calling.
 */
export async function importTodaySuggestion(data: {
  sourceType: 'calendar' | 'mail';
  sourceId: string;
  title: string;
  dueDate?: string; // ISO date
}): Promise<ImportSuggestionResult> {
  const fn = httpsCallable<typeof data, ImportSuggestionResult>(
    functions,
    'importTodaySuggestionToGoogleTask'
  );
  const result = await fn(data);
  return result.data;
}

/**
 * Create a Google Calendar event.
 */
export async function createCalendarEvent(data: {
  title: string;
  start: string;   // ISO datetime
  end: string;     // ISO datetime
  description?: string;
}): Promise<CreateEventResult> {
  const fn = httpsCallable<typeof data, CreateEventResult>(functions, 'createCalendarEvent');
  const result = await fn(data);
  return result.data;
}

/**
 * Send an email via Gmail.
 */
export async function sendMail(data: {
  recipients: string[];
  subject: string;
  body: string;
  html?: string;
  attachments?: OutgoingMailAttachment[];
  bulkMode?: boolean;
}): Promise<SendMailResult> {
  const fn = httpsCallable<typeof data, SendMailResult>(functions, 'sendMail');
  const result = await fn(data);
  return result.data;
}

/**
 * Retrieve the full plain-text body of a Gmail message.
 */
export async function getFullMailMessage(data: {
  messageId: string;
}): Promise<GetFullMailResult> {
  const fn = httpsCallable<typeof data, GetFullMailResult>(functions, 'getFullMailMessage');
  const result = await fn(data);
  return result.data;
}

/**
 * Research the topic of an email using Tavily AI search.
 */
export async function researchMailTopic(params: {
  subject?: string;
  body?: string;
  snippet?: string;
  query?: string;
  type?: 'company' | 'competition' | 'speaker' | 'general';
}): Promise<ResearchMailTopicResult> {
  try {
    const res = await fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fall back to Cloud Functions if local API route fails
  }

  const fn = httpsCallable<typeof params, ResearchMailTopicResult>(
    functions,
    'researchMailTopic'
  );
  const result = await fn(params);
  return result.data;
}
