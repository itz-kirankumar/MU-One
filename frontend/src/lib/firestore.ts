import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  limit,
  orderBy,
  query,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  UserProfile,
  DashboardData,
  PersonalTask,
  WeeklyFocus,
  MailWorkspace,
  NormalizedEvent,
} from '@/types';

// ─── Real-time listeners ─────────────────────────────────────────────────────

/**
 * Subscribe to /users/{uid} — real-time user profile.
 * Returns an unsubscribe function to clean up on component unmount.
 */
export function subscribeToUser(
  uid: string,
  cb: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = doc(db, 'users', uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        cb({ uid, ...snap.data() } as UserProfile);
      } else {
        cb(null);
      }
    },
    (err) => {
      console.warn('Firestore user profile listener:', err.message);
      onError?.(err);
    }
  );
}

/**
 * Subscribe to /users/{uid}/dashboard/current — aggregated dashboard data.
 */
export function subscribeToDashboard(
  uid: string,
  cb: (data: DashboardData | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = doc(db, 'users', uid, 'dashboard', 'current');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        cb({ uid, ...snap.data() } as DashboardData);
      } else {
        cb(null);
      }
    },
    (err) => {
      console.warn('Firestore dashboard listener:', err.message);
      // Do NOT fall through to cb(null): a hard listener failure is not the
      // same as "no dashboard yet", and callers must be able to tell them
      // apart in order to surface a real error to the student.
      onError?.(err);
    }
  );
}

/** Subscribe to sanitized section timetable events for a selected date range. */
export function subscribeToSharedTimetable(
  fromIso: string,
  toIso: string,
  cb: (events: NormalizedEvent[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = query(
    collection(db, 'sharedCalendarEvents'),
    where('startIso', '>=', fromIso),
    where('startIso', '<=', toIso),
    orderBy('startIso', 'asc'),
    limit(1000)
  );
  return onSnapshot(
    ref,
    snapshot => cb(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as NormalizedEvent))),
    error => {
      console.warn('Firestore shared timetable listener:', error.message);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to /users/{uid}/personalTasks — collection of personal tasks.
 */
export function subscribeToPersonalTasks(
  uid: string,
  cb: (tasks: PersonalTask[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = collection(db, 'users', uid, 'personalTasks');
  return onSnapshot(
    ref,
    (snap) => {
      const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PersonalTask));
      cb(tasks);
    },
    (err) => {
      console.warn('Firestore personal tasks listener:', err.message);
      onError?.(err);
    }
  );
}

/**
 * Subscribe to /users/{uid}/focus/current — weekly focus text.
 */
export function subscribeToFocus(
  uid: string,
  cb: (focus: WeeklyFocus | null) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = doc(db, 'users', uid, 'focus', 'current');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        // WeeklyFocus has no uid field — the doc path already scopes it.
        cb(snap.data() as WeeklyFocus);
      } else {
        cb(null);
      }
    },
    (err) => {
      console.warn('Firestore focus listener:', err.message);
      onError?.(err);
    }
  );
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Create a new personal task in Firestore.
 */
export async function createPersonalTask(
  uid: string,
  task: Omit<PersonalTask, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = doc(collection(db, 'users', uid, 'personalTasks'));
  await setDoc(ref, {
    ...task,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return ref.id;
}

/**
 * Update fields on an existing personal task.
 */
export async function updatePersonalTask(
  uid: string,
  taskId: string,
  updates: Partial<Omit<PersonalTask, 'id' | 'createdAt'>>
): Promise<void> {
  const ref = doc(db, 'users', uid, 'personalTasks', taskId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete a personal task from Firestore.
 */
export async function deletePersonalTask(
  uid: string,
  taskId: string
): Promise<void> {
  const ref = doc(db, 'users', uid, 'personalTasks', taskId);
  await deleteDoc(ref);
}

/**
 * Save the user's weekly focus text to /users/{uid}/focus/current.
 */
export async function updateFocus(uid: string, text: string): Promise<void> {
  const ref = doc(db, 'users', uid, 'focus', 'current');
  await setDoc(ref, {
    text,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Save the user's completed mail IDs to /users/{uid}.
 */
export async function updateCompletedMailIds(uid: string, completedMailIds: string[]): Promise<void> {
  const ref = doc(db, 'users', uid);
  await setDoc(ref, { completedMailIds, updatedAt: new Date().toISOString() }, { merge: true });
}

/** Save the user's mail labels, read state, and pins to their profile. */
export async function updateMailWorkspace(uid: string, mailWorkspace: MailWorkspace): Promise<void> {
  const ref = doc(db, 'users', uid);
  await setDoc(ref, { mailWorkspace, updatedAt: new Date().toISOString() }, { merge: true });
}
