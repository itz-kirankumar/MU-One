'use client';

import React, { useState } from 'react';
import { Plus, Circle, CheckCircle2 } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { createGoogleTask, completeGoogleTask } from '@/lib/functions';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { GoogleTask } from '@/types';

export function GoogleTasksList() {
  const { dashboardData, loading } = useDashboard();
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const tasks = (dashboardData?.googleTasks ?? []).filter((t) => !t.completed);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setCreateError('Task title is required');
      return;
    }
    setCreateError('');
    setCreating(true);
    try {
      await createGoogleTask({ title: trimmed, dueDate: newDue || undefined });
      setNewTitle('');
      setNewDue('');
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setCreating(false);
    }
  }

  async function handleComplete(task: GoogleTask) {
    const taskId = (task.id || task.taskId || '').trim();
    if (!taskId) return;
    setCompletingIds((prev) => new Set(prev).add(taskId));
    setActionErrors((prev) => { const n = { ...prev }; delete n[taskId]; return n; });
    try {
      await completeGoogleTask({ taskId, taskListId: task.taskListId });
      // UI will update via Firestore real-time listener only
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to complete task';
      setActionErrors((prev) => ({ ...prev, [taskId]: msg }));
    } finally {
      setCompletingIds((prev) => {
        const n = new Set(prev);
        n.delete(taskId);
        return n;
      });
    }
  }

  return (
    <section className="rounded-xl border border-[#222] bg-[#161616] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1A1A1A]">
        <h3 className="text-sm font-semibold text-white">Google Tasks</h3>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* New task form */}
        <form onSubmit={handleCreate} noValidate className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => { setNewTitle(e.target.value); setCreateError(''); }}
              placeholder="New task…"
              aria-label="New Google task title"
              className="flex-1 min-w-0 rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
            />
            <button
              type="submit"
              disabled={creating}
              aria-label="Add Google task"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-[#f7d344] text-black disabled:opacity-50 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
            >
              {creating ? <LoadingSpinner size="sm" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          <input
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            aria-label="Task due date"
            className="w-full rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-1.5 text-sm text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344] [color-scheme:dark]"
          />
          {createError && (
            <p className="text-xs text-red-400" role="alert">{createError}</p>
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
            <EmptyState title="No active Google Tasks" />
          ) : (
            tasks.map((task, idx) => {
              const taskId = task.id || task.taskId || `gtask-${idx}`;
              const isCompleting = completingIds.has(taskId);
              const listTitle = task.taskListName || task.taskListTitle;
              return (
                <div key={taskId} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#1A1A1A] transition-colors">
                    <button
                      onClick={() => handleComplete(task)}
                      disabled={isCompleting}
                      aria-label={`Complete "${task.title}"`}
                      className="flex-shrink-0 text-gray-500 hover:text-green-400 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344] rounded"
                    >
                      {isCompleting ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Circle className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                    <span className="flex-1 min-w-0 truncate text-sm text-gray-200">{task.title}</span>
                    {listTitle && (
                      <span className="hidden sm:block text-[10px] text-gray-600 flex-shrink-0">
                        {listTitle}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="text-[10px] text-gray-600 flex-shrink-0">
                        {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    )}
                  </div>
                  {actionErrors[taskId] && (
                    <p className="pl-8 text-xs text-red-400" role="alert">
                      {actionErrors[taskId]}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
