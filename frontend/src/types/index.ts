// ─── Shared TypeScript interfaces for MU One ────────────────────────────────

// ── Auth / User ────────────────────────────────────────────────────────────

export interface GoogleConnection {
  connected: boolean;
  email?: string;
  connectedAt?: string; // ISO timestamp
  scopes?: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  googleConnection?: GoogleConnection;
  createdAt?: string;
  lastLoginAt?: string;
  mailWorkspace?: MailWorkspace;
}

export interface MailLabel {
  id: string;
  name: string;
  color: string;
}

export interface MailItemState {
  read?: boolean;
  pinned?: boolean;
  labelIds?: string[];
}

export interface MailWorkspace {
  labels: MailLabel[];
  messages: Record<string, MailItemState>;
}

// ── Firestore sync structures ──────────────────────────────────────────────

export interface SourceHealth {
  status: 'ok' | 'warning' | 'error';
  lastSyncedAt?: string; // ISO
  message?: string;
}

export interface SyncStatus {
  syncing: boolean;
  lastSyncedAt?: string; // ISO
  nextSyncAt?: string;   // ISO
  sourceHealth?: {
    calendar?: SourceHealth;
    gmail?: SourceHealth;
    tasks?: SourceHealth;
  };
}

export interface SyncJob {
  jobId: string;
  status: 'pending' | 'running' | 'done' | 'error';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// ── Calendar / Events ──────────────────────────────────────────────────────

export interface NormalizedEvent {
  id?: string;
  googleEventId?: string;
  iCalUID?: string;
  title: string;
  startIso: string;     // ISO datetime
  endIso?: string;      // ISO datetime
  allDay?: boolean;
  isAllDay?: boolean;
  calendarId?: string;
  sourceCalendarId?: string;
  calendarName?: string;
  sourceCalendarName?: string;
  htmlLink?: string | null;
  isDeadline?: boolean;
  activityType?: string;
  subject?: string;
  course?: string;
  sessionDescription?: string;
  mode?: string;
  location?: string;
  faculty?: string;
  organizerName?: string;
  organizerEmail?: string;
  meetingLink?: string;
  description?: string;
  descriptionExcerpt?: string;
  sectionNumber?: number | null;
  sectionCode?: string | null;
  sectionLabel?: string;
  sharedTimetable?: boolean;
}

// ── Mail ───────────────────────────────────────────────────────────────────

export interface MailSignal {
  id?: string;
  messageId: string;
  sender?: string;
  from?: string;
  fromEmail?: string;
  subject: string;
  snippet: string;
  receivedAt: string;   // ISO
  isDeadlineSignal?: boolean;
  dueDate?: string | null;
  deadlineSource?: 'deterministic' | 'jev' | null;
  jevClassification?: {
    model: string;
    category: 'deadline' | 'action' | 'information' | 'spam';
    confidence: number;
    urgency: number;
  };
  importance?: 'high' | 'medium' | 'low';
  labels?: string[];
  threadId?: string;
  gmailLink?: string;
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export interface GoogleTask {
  id?: string;
  taskId?: string;
  title: string;
  taskListId: string;
  taskListTitle?: string;
  taskListName?: string;
  dueDate?: string | null;
  completed?: boolean | string | null;
  status?: string;
  notes?: string;
  updated?: string;
  updatedAt?: string;
}

export interface PersonalTask {
  id: string;
  title: string;
  dueDate?: string;     // ISO date
  importance: 'normal' | 'must_do';
  completed: boolean;
  createdAt: string;    // ISO
  updatedAt?: string;   // ISO
}

// ── Focus ──────────────────────────────────────────────────────────────────

export interface WeeklyFocus {
  text: string;
  updatedAt: string; // ISO
}

// ── Dashboard aggregate ────────────────────────────────────────────────────

export interface DashboardData {
  uid: string;
  syncStatus?: SyncStatus;
  events?: NormalizedEvent[];
  /** Full busy occurrences, independent of the shortened agenda displayed in the dashboard. */
  calendarAvailability?: {
    events: NormalizedEvent[];
    from: string;
    to: string;
    complete: boolean;
    syncedAt: string;
  };
  deadlines?: NormalizedEvent[];
  mailSignals?: MailSignal[];
  googleTasks?: GoogleTask[];
  connectedCalendars?: number;
  syncedAt?: string; // ISO
  error?: string;
}

export interface Announcement {
  id: string;
  title: string;
  deadlineIso: string;
  createdAt: string;
  updatedAt: string;
  authorEmail: string;
  sections: string[]; // ['all'] or subset of ['A','B','C','D','E','F','G','H']
}

