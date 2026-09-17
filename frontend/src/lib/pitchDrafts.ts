import { collection, doc, getDocs, limit, query, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EMPTY_PITCH_INPUT, type PitchDraft, type PitchInput, type PitchMailContext, type PitchResult } from '@/types/pitch';

export const MAX_PITCH_DRAFTS = 30;
export const MAX_PITCH_DRAFT_BYTES = 100_000;
const MAX_CACHE_BYTES = 2_000_000;
const HYDRATION_TIMEOUT_MS = 5_000;
const SAVE_DELAY_MS = 600;

export const pitchDraftStorageKey = (uid: string) => `mu-one:pitch-drafts:v1:${encodeURIComponent(uid)}`;
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const validDate = (value: unknown): value is string => isString(value) && Number.isFinite(Date.parse(value));
const byteLength = (value: string) => new Blob([value]).size;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Unknown storage error';

function validInput(value: unknown): value is PitchInput {
  return isObject(value) && (value.mode === 'case' || value.mode === 'venture') &&
    ['competition', 'industry', 'idea', 'brief', 'rubric', 'round', 'deadline'].every(key => isString(value[key])) &&
    Number.isInteger(value.slideLimit) && Number(value.slideLimit) >= 1 && Number(value.slideLimit) <= 30;
}

function validResult(value: unknown): value is PitchResult {
  if (!isObject(value)) return false;
  return ['summary', 'recommendation', 'researchNote', 'generatedAt'].every(key => isString(value[key])) &&
    ['complete', 'partial', 'unavailable'].includes(String(value.researchStatus)) &&
    Array.isArray(value.slides) && value.slides.every(slide => isObject(slide) && Number.isInteger(slide.number) &&
      ['title', 'keyMessage', 'judgeQuestion'].every(key => isString(slide[key])) && strings(slide.bullets) && strings(slide.sourceIds)) &&
    Array.isArray(value.critiques) && value.critiques.every(item => isObject(item) &&
      ['id', 'title', 'issue', 'evidenceNeeded', 'actionTitle'].every(key => isString(item[key]))) &&
    Array.isArray(value.assumptions) && value.assumptions.every(item => isObject(item) && isString(item.claim) &&
      ['assumption', 'estimate', 'sourced'].includes(String(item.kind)) && strings(item.sourceIds) && isString(item.calculation)) &&
    Array.isArray(value.requirements) && value.requirements.every(item => isObject(item) && isString(item.criterion) &&
      ['covered', 'partial', 'missing'].includes(String(item.coverage)) && isString(item.feedback)) &&
    Array.isArray(value.sources) && value.sources.every(item => isObject(item) &&
      ['id', 'title', 'url', 'excerpt', 'retrievedAt'].every(key => isString(item[key])));
}

/** Reject malformed data instead of allowing a damaged cache to replace valid cloud work. */
export function parsePitchDraft(value: unknown): PitchDraft {
  if (!isObject(value) || !isString(value.id) || !value.id || value.id.includes('/') || value.id.length > 500 ||
    !validInput(value.input) || !validDate(value.updatedAt) || !strings(value.taskIds) ||
    !Array.isArray(value.bookedSlots) || !value.bookedSlots.every(slot => isObject(slot) &&
      validDate(slot.startIso) && validDate(slot.endIso) && isString(slot.title)) ||
    (value.result !== undefined && !validResult(value.result)) ||
    (value.analyzedInput !== undefined && !validInput(value.analyzedInput)) ||
    (value.sourceMail !== undefined && (!isObject(value.sourceMail) ||
      !['messageId', 'subject', 'body'].every(key => isString((value.sourceMail as Record<string, unknown>)[key])) ||
      (value.sourceMail.deadline !== undefined && !isString(value.sourceMail.deadline)) ||
      (value.sourceMail.gmailUrl !== undefined && !isString(value.sourceMail.gmailUrl))))) {
    throw new Error('A saved pitch draft is malformed. The original stored data has been preserved.');
  }
  if (value.sourceMail && String((value.sourceMail as Record<string, unknown>).body).length > 20_000) {
    throw new Error('Source email text exceeds the 20,000-character limit.');
  }
  const json = JSON.stringify(value);
  if (byteLength(json) > MAX_PITCH_DRAFT_BYTES) throw new Error('This draft exceeds the 100 KB save limit. Shorten the brief or research before saving.');
  return JSON.parse(json) as PitchDraft;
}

/** Last modified wins; equal timestamps retain the existing local version. */
export function mergePitchDrafts(local: PitchDraft[], remote: PitchDraft[]): PitchDraft[] {
  const merged = new Map(local.map(draft => [draft.id, draft]));
  for (const draft of remote) {
    const current = merged.get(draft.id);
    if (!current || Date.parse(draft.updatedAt) > Date.parse(current.updatedAt)) merged.set(draft.id, draft);
  }
  return [...merged.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export interface PitchDraftSnapshot {
  draft: PitchDraft | null;
  drafts: PitchDraft[];
  saveStatus: string;
  saveError?: string;
}

export interface PitchDraftDependencies {
  storage: () => Pick<Storage, 'getItem' | 'setItem'>;
  readRemote: (uid: string) => Promise<PitchDraft[]>;
  writeRemote: (uid: string, draft: PitchDraft) => Promise<PitchDraft>;
  newId: () => string;
  now: () => number;
}

const browserDependencies: PitchDraftDependencies = {
  storage: () => window.localStorage,
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
  readRemote: async uid => {
    const snapshot = await getDocs(query(collection(db, 'users', uid, 'pitchDrafts'), limit(MAX_PITCH_DRAFTS + 1)));
    if (snapshot.docs.length > MAX_PITCH_DRAFTS) throw new Error(`More than ${MAX_PITCH_DRAFTS} cloud drafts exist. Cloud documents were preserved; loading is paused.`);
    return snapshot.docs.map(item => parsePitchDraft({ ...item.data(), id: item.id }));
  },
  writeRemote: async (uid, draft) => runTransaction(db, async transaction => {
    const ref = doc(db, 'users', uid, 'pitchDrafts', draft.id);
    const snapshot = await transaction.get(ref);
    if (snapshot.exists()) {
      const existing = parsePitchDraft({ ...snapshot.data(), id: snapshot.id });
      // A late network write must never replace a newer draft from another tab/device.
      if (Date.parse(existing.updatedAt) >= Date.parse(draft.updatedAt)) return existing;
    }
    transaction.set(ref, draft);
    return draft;
  }),
};

/** One controller per signed-in user. No module-level draft cache can leak across accounts. */
export class PitchDraftStore {
  private snapshot: PitchDraftSnapshot = { draft: null, drafts: [], saveStatus: 'Loading saved pitches…' };
  private listeners = new Set<() => void>();
  private selectedId: string | null = null;
  private pending = new Map<string, PitchDraft>();
  private hydrated = false;
  private active = false;
  private generation = 0;
  private writing = false;
  private localBlocked = false;
  private localError?: string;
  private cloudError?: string;
  private validationError?: string;
  private queuedCreate: { context?: PitchMailContext } | null = null;
  private saveTimer?: ReturnType<typeof setTimeout>;
  private hydrationTimer?: ReturnType<typeof setTimeout>;

  constructor(private uid: string | undefined, private dependencies: PitchDraftDependencies = browserDependencies) {
    if (!uid) this.snapshot = { draft: null, drafts: [], saveStatus: 'Sign in to save pitches' };
  }

  getSnapshot = (): PitchDraftSnapshot => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private emit(drafts = this.snapshot.drafts) {
    const errors = [this.validationError, this.localError, this.cloudError].filter(Boolean);
    let saveStatus = !this.hydrated ? 'Loading saved pitches…' : 'Saved';
    if (this.hydrated && (this.pending.size || this.writing)) saveStatus = this.localError ? 'Saving to cloud…' : 'Saved on this device · syncing…';
    if (this.hydrated && this.cloudError) saveStatus = this.localError ? 'Unsaved changes' : 'Saved on this device only';
    else if (this.hydrated && this.localError && !this.pending.size && !this.writing) saveStatus = 'Saved to cloud · local backup unavailable';
    if (this.validationError) saveStatus = 'Changes could not be saved';
    this.snapshot = { drafts, draft: drafts.find(draft => draft.id === this.selectedId) ?? drafts[0] ?? null,
      saveStatus, ...(errors.length ? { saveError: errors.join(' ') } : {}) };
    this.listeners.forEach(listener => listener());
  }

  private persistLocal(drafts = this.snapshot.drafts) {
    if (!this.uid || this.localBlocked) return;
    try {
      const json = JSON.stringify({ version: 1, selectedId: this.selectedId, drafts });
      if (byteLength(json) > MAX_CACHE_BYTES) throw new Error('The 2 MB device backup limit was reached.');
      this.dependencies.storage().setItem(pitchDraftStorageKey(this.uid), json);
      this.localError = undefined;
    } catch (error) {
      this.localError = `Device backup failed: ${errorMessage(error)} Cloud saving will still be attempted.`;
    }
  }

  start = () => {
    if (!this.uid || this.active) return;
    this.active = true;
    const generation = ++this.generation;
    try {
      const raw = this.dependencies.storage().getItem(pitchDraftStorageKey(this.uid));
      if (raw) {
        if (byteLength(raw) > MAX_CACHE_BYTES) throw new Error('Saved device data exceeds the 2 MB limit.');
        const envelope: unknown = JSON.parse(raw);
        if (!isObject(envelope) || envelope.version !== 1 || !Array.isArray(envelope.drafts) || envelope.drafts.length > MAX_PITCH_DRAFTS) {
          throw new Error('Saved pitch data has an unsupported or corrupt format.');
        }
        const drafts = envelope.drafts.map(parsePitchDraft);
        if (new Set(drafts.map(draft => draft.id)).size !== drafts.length) throw new Error('Saved pitch data contains duplicate draft IDs.');
        this.selectedId = isString(envelope.selectedId) ? envelope.selectedId : drafts[0]?.id ?? null;
        this.emit(mergePitchDrafts(this.snapshot.drafts, drafts));
      }
    } catch (error) {
      this.localBlocked = true;
      this.localError = `Device backup could not be read: ${errorMessage(error)} Existing device data will not be overwritten.`;
    }
    this.emit();
    this.hydrationTimer = setTimeout(() => {
      if (!this.active || generation !== this.generation || this.hydrated) return;
      this.cloudError = 'Cloud loading timed out. Changes are kept on this device while cloud saving is retried.';
      this.finishHydration();
    }, HYDRATION_TIMEOUT_MS);
    void this.dependencies.readRemote(this.uid).then(remote => {
      if (!this.active || generation !== this.generation) return;
      clearTimeout(this.hydrationTimer);
      const combined = mergePitchDrafts(this.snapshot.drafts, remote);
      if (combined.length > MAX_PITCH_DRAFTS) throw new Error(`Combining device and cloud drafts exceeds ${MAX_PITCH_DRAFTS} drafts. Neither copy has been deleted.`);
      this.cloudError = undefined;
      for (const local of combined) {
        const cloud = remote.find(draft => draft.id === local.id);
        if (!cloud || Date.parse(local.updatedAt) > Date.parse(cloud.updatedAt)) this.pending.set(local.id, local);
        else this.pending.delete(local.id);
      }
      this.emit(combined);
      this.persistLocal(combined);
      this.finishHydration();
    }).catch(error => {
      if (!this.active || generation !== this.generation) return;
      clearTimeout(this.hydrationTimer);
      this.cloudError = `Cloud loading failed: ${errorMessage(error)}`;
      this.finishHydration();
    });
  };

  private finishHydration() {
    this.hydrated = true;
    const request = this.queuedCreate;
    this.queuedCreate = null;
    if (request || !this.snapshot.drafts.length) this.createDraft(request?.context);
    this.emit();
    this.scheduleSave();
  }

  stop = () => {
    this.active = false;
    ++this.generation;
    clearTimeout(this.hydrationTimer);
    clearTimeout(this.saveTimer);
    // Edits are already durable locally; attempt the remaining cloud write on navigation too.
    void this.flush();
  };

  private scheduleSave() {
    clearTimeout(this.saveTimer);
    if (this.hydrated && this.pending.size) this.saveTimer = setTimeout(() => { void this.flush(); }, SAVE_DELAY_MS);
  }

  private async flush() {
    if (!this.uid || !this.hydrated || this.writing || !this.pending.size) return;
    this.writing = true;
    this.emit();
    try {
      // Serialize writes and read the live queue after each await, preserving rapid edits and every draft.
      while (this.pending.size) {
        const next = this.pending.values().next().value as PitchDraft;
        const saved = await this.dependencies.writeRemote(this.uid, next);
        const queued = this.pending.get(next.id);
        if (queued && Date.parse(queued.updatedAt) <= Date.parse(saved.updatedAt)) this.pending.delete(next.id);
        const combined = mergePitchDrafts(this.snapshot.drafts, [saved]);
        this.cloudError = undefined;
        this.emit(combined);
        this.persistLocal(combined);
      }
    } catch (error) {
      this.cloudError = `Cloud save failed: ${errorMessage(error)} Edits will retry when you next change a draft or reopen Pitch.`;
    } finally {
      this.writing = false;
      this.emit();
    }
  }

  updateDraft = (draft: PitchDraft) => {
    if (!this.uid || !this.active) return;
    if (!this.snapshot.drafts.some(existing => existing.id === draft.id)) {
      this.validationError = 'This draft does not belong to the current workspace. Reopen it before editing.';
      this.emit();
      return;
    }
    try {
      const current = this.snapshot.drafts.find(existing => existing.id === draft.id)!;
      const next = parsePitchDraft({ ...draft, updatedAt: new Date(Math.max(this.dependencies.now(), Date.parse(current.updatedAt) + 1)).toISOString() });
      this.validationError = undefined;
      this.pending.set(next.id, next);
      const drafts = mergePitchDrafts(this.snapshot.drafts, [next]);
      this.persistLocal(drafts);
      this.emit(drafts);
      this.scheduleSave();
    } catch (error) { this.validationError = errorMessage(error); this.emit(); }
  };

  createDraft = (context?: PitchMailContext) => {
    if (!this.uid || !this.active) return;
    const existing = context && this.snapshot.drafts.find(draft => draft.sourceMail?.messageId === context.messageId);
    if (existing) { this.selectDraft(existing.id); return; }
    if (!this.hydrated) { this.queuedCreate = { context }; return; }
    if (this.snapshot.drafts.length >= MAX_PITCH_DRAFTS) {
      this.validationError = `The ${MAX_PITCH_DRAFTS}-draft limit has been reached. Existing drafts are preserved; open one to continue.`;
      this.emit();
      return;
    }
    try {
      // Source is supplied as plaintext by the mail integration. Never interpret it as HTML.
      const sourceMail = context ? { ...context, body: context.body.slice(0, 20_000) } : undefined;
      const draft = parsePitchDraft({ id: this.dependencies.newId(), input: { ...EMPTY_PITCH_INPUT,
        ...(sourceMail ? { mode: 'case', competition: sourceMail.subject, brief: sourceMail.body, deadline: sourceMail.deadline ?? '' } : {}) },
      ...(sourceMail ? { sourceMail } : {}), taskIds: [], bookedSlots: [], updatedAt: new Date(this.dependencies.now()).toISOString() });
      this.validationError = undefined;
      this.selectedId = draft.id;
      this.pending.set(draft.id, draft);
      const drafts = mergePitchDrafts(this.snapshot.drafts, [draft]);
      this.persistLocal(drafts);
      this.emit(drafts);
      this.scheduleSave();
    } catch (error) { this.validationError = errorMessage(error); this.emit(); }
  };

  selectDraft = (id: string) => {
    if (!this.uid || !this.active || !this.snapshot.drafts.some(draft => draft.id === id)) return;
    this.selectedId = id;
    this.validationError = undefined;
    this.persistLocal();
    this.emit();
  };
}
