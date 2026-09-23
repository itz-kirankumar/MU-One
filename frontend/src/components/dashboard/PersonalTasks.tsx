'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Circle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePersonalTasks } from '@/hooks/usePersonalTasks';
import { createPersonalTask, updatePersonalTask, deletePersonalTask } from '@/lib/firestore';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export function PersonalTasks() {
  const { user } = useAuth();
  const { tasks, loading } = usePersonalTasks(user?.uid ?? null);

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [importance, setImportance] = useState<'normal' | 'must_do'>('normal');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setFormError('Title is required');
      return;
    }
    if (!user) return;
    setFormError('');
    setCreating(true);
    try {
      await createPersonalTask(user.uid, {
        title: trimmed,
        dueDate: dueDate || undefined,
        importance,
        completed: false,
      });
      setTitle('');
      setDueDate('');
      setImportance('normal');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(taskId: string, completed: boolean) {
    if (!user) return;
    await updatePersonalTask(user.uid, taskId, { completed: !completed });
  }

  async function handleDelete(taskId: string) {
    if (!user) return;
    await deletePersonalTask(user.uid, taskId);
  }

  return (
    <section className="flex flex-col h-full rounded-xl border border-[#222] bg-[#161616] overflow-hidden max-h-[400px] overflow-y-auto custom-scrollbar">
      <div className="sticky top-0 z-10 bg-[#161616] px-5 py-4 border-b border-[#1A1A1A]">
        <h3 className="text-sm font-semibold text-white">Personal Priorities</h3>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Add task form */}
        <form onSubmit={handleCreate} noValidate className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setFormError(''); }}
              placeholder="Add a task…"
              aria-label="New task title"
              className="flex-1 min-w-0 rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            />
            <button
              type="submit"
              disabled={creating}
              aria-label="Add task"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-[#f7d344] text-black disabled:opacity-50 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              aria-label="Due date"
              className="flex-1 min-w-0 rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-1.5 text-sm text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 [color-scheme:dark]"
            />
            <button
              type="button"
              onClick={() => setImportance((i) => (i === 'must_do' ? 'normal' : 'must_do'))}
              aria-pressed={importance === 'must_do'}
              className={`flex-shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                importance === 'must_do'
                  ? 'border-[#f7d344]/40 bg-[#f7d344]/10 text-[#f7d344]'
                  : 'border-[#2A2A2A] bg-[#1A1A1A] text-gray-500 hover:text-gray-300'
              }`}
            >
              {importance === 'must_do' ? '★ Must do' : '☆ Normal'}
            </button>
          </div>

          {formError && (
            <p className="text-xs text-red-400" role="alert">{formError}</p>
          )}
        </form>

        {/* Task list */}
        <div className="space-y-0.5">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded bg-[#2A2A2A]" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState title="No personal tasks" description="Add something to get started" />
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#1A1A1A] transition-colors"
              >
                {/* Checkbox */}
                <button
                  onClick={() => handleToggle(task.id, task.completed)}
                  aria-label={task.completed ? `Mark "${task.title}" incomplete` : `Complete "${task.title}"`}
                  className="flex-shrink-0 text-gray-500 hover:text-[#f7d344] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded"
                >
                  {task.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
                  ) : (
                    <Circle className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>

                {/* Title */}
                <span
                  className={`flex-1 min-w-0 truncate text-sm ${
                    task.completed ? 'line-through text-gray-600' : 'text-gray-200'
                  }`}
                >
                  {task.title}
                </span>

                {/* Importance dot */}
                {task.importance === 'must_do' && !task.completed && (
                  <Badge variant="accent">Must do</Badge>
                )}

                {/* Due date */}
                {task.dueDate && (
                  <span className="text-[10px] text-gray-600 flex-shrink-0">
                    {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                )}

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(task.id)}
                  aria-label={`Delete "${task.title}"`}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded focus:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
