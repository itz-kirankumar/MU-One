'use client';

import { useEffect, useState } from 'react';
import { subscribeToPersonalTasks } from '@/lib/firestore';
import type { PersonalTask } from '@/types';

const importanceOrder = { must_do: 0, normal: 1 };

function sortTasks(tasks: PersonalTask[]): PersonalTask[] {
  return [...tasks].sort((a, b) => {
    // Completed tasks sink to bottom
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    // Among incomplete: must_do first
    const impA = importanceOrder[a.importance] ?? 1;
    const impB = importanceOrder[b.importance] ?? 1;
    if (impA !== impB) return impA - impB;
    // Then by dueDate ascending (no date = last)
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

/**
 * Real-time Firestore listener for /users/{uid}/personalTasks.
 * Sorted: incomplete first, then must_do, then by dueDate ascending.
 */
export function usePersonalTasks(uid: string | null): {
  tasks: PersonalTask[];
  loading: boolean;
  error: string | null;
} {
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubscribed = false;

    const unsub = subscribeToPersonalTasks(uid, (raw) => {
      if (!unsubscribed) {
        setTasks(sortTasks(raw));
        setLoading(false);
        setError(null);
      }
    });

    return () => {
      unsubscribed = true;
      unsub();
    };
  }, [uid]);

  return { tasks, loading, error };
}
