'use client';

import React, { useState } from 'react';
import { Plus, CheckCircle2, Circle, CheckSquare, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { updatePersonalTask, createPersonalTask, deletePersonalTask } from '@/lib/firestore';
import { importTodaySuggestion } from '@/lib/functions';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CalendarEventCard } from '@/components/dashboard/CalendarEventCard';
import type { PersonalTask } from '@/types';

function getLocalDateIso(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface ImportConfirmProps {
  title: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

function ImportConfirmModal({ title, onConfirm, onCancel }: ImportConfirmProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add task');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-xl border border-[#2A2A2A] bg-[#161616] p-5 space-y-4">
        <p className="text-sm font-medium text-white">Add to Google Tasks?</p>
        <p className="text-sm text-gray-400 break-words">&quot;{title}&quot;</p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="rounded-md border border-[#2A2A2A] px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-[#f7d344] px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
          >
            {loading ? <LoadingSpinner size="sm" /> : null}
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}

export function TodayPanel() {
  const { user } = useAuth();
  const { dashboardData, personalTasks } = useDashboard();

  const [pendingImport, setPendingImport] = useState<{
    sourceType: 'calendar' | 'mail';
    sourceId: string;
    title: string;
    dueDate?: string;
  } | null>(null);

  const [manualTask, setManualTask] = useState('');
  const [addingManual, setAddingManual] = useState(false);
  const [manualError, setManualError] = useState('');

  const todayDateStr = getLocalDateIso();

  // Personal tasks due today
  const todayPersonalTasks = personalTasks.filter(
    (t) => t.dueDate === todayDateStr || t.dueDate?.slice(0, 10) === todayDateStr
  );

  // Calendar events today, sorted chronologically by start time
  const todayEvents = (dashboardData?.events ?? [])
    .filter((e) => {
      const eDate = e.startIso?.slice(0, 10);
      return eDate === todayDateStr || e.startIso?.startsWith(todayDateStr);
    })
    .sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return a.startIso.localeCompare(b.startIso);
    });

  // Mail with dueDate today
  const todayMail = (dashboardData?.mailSignals ?? []).filter((m) => {
    const due = m.dueDate;
    return due === todayDateStr || due?.slice(0, 10) === todayDateStr;
  });

  const isEmpty = todayPersonalTasks.length === 0 && todayEvents.length === 0 && todayMail.length === 0;

  async function handleToggleTask(task: PersonalTask) {
    if (!user) return;
    await updatePersonalTask(user.uid, task.id, { completed: !task.completed });
  }

  async function handleDeleteTask(taskId: string) {
    if (!user) return;
    await deletePersonalTask(user.uid, taskId);
  }

  async function handleAddManualTask(e: React.FormEvent) {
    e.preventDefault();
    const text = manualTask.trim();
    if (!text || !user || addingManual) return;
    setAddingManual(true);
    setManualError('');
    try {
      await createPersonalTask(user.uid, {
        title: text,
        dueDate: todayDateStr,
        importance: 'normal',
        completed: false,
      });
      setManualTask('');
    } catch (err: unknown) {
      setManualError(err instanceof Error ? err.message : 'Failed to add task');
    } finally {
      setAddingManual(false);
    }
  }

  async function handleImport() {
    if (!pendingImport) return;
    await importTodaySuggestion(pendingImport);
    setPendingImport(null);
  }

  return (
    <>
      <section className="rounded-xl border border-[#222] bg-[#161616] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1A1A1A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Today</h3>
            <span className="text-[10px] text-gray-500 bg-[#202020] px-2 py-0.5 rounded border border-[#2A2A2A]">
              {todayEvents.length + todayPersonalTasks.length + todayMail.length} items
            </span>
          </div>
        </div>

        {/* Manual Quick Add Task for Today */}
        <form onSubmit={handleAddManualTask} className="px-4 pt-3 pb-2 border-b border-[#1A1A1A]/80">
          <div className="flex items-center gap-2 rounded-lg bg-[#111111] border border-[#262626] px-3 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
            <Plus className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
            <input
              type="text"
              value={manualTask}
              onChange={(e) => setManualTask(e.target.value)}
              placeholder="Add task or note for today..."
              className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-500 focus:outline-none"
              disabled={addingManual}
            />
            {manualTask.trim() && (
              <button
                type="submit"
                disabled={addingManual}
                className="flex-shrink-0 rounded bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-500 transition-colors"
              >
                {addingManual ? 'Adding…' : 'Add'}
              </button>
            )}
          </div>
          {manualError && (
            <p className="mt-1 text-[10px] text-red-400 px-1">{manualError}</p>
          )}
        </form>

        <div className="px-4 py-3 space-y-1">
          {isEmpty ? (
            <EmptyState title="Nothing due today — stay ahead!" />
          ) : (
            <>
              {/* Personal tasks */}
              {todayPersonalTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[#1A1A1A] transition-colors group">
                  <button
                    onClick={() => handleToggleTask(task)}
                    aria-label={task.completed ? `Mark "${task.title}" incomplete` : `Complete "${task.title}"`}
                    className="flex-shrink-0 text-gray-500 hover:text-[#f7d344] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344] rounded"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${task.completed ? 'line-through text-gray-600' : 'text-gray-200'}`}>
                      {task.title}
                    </span>
                    <span className="flex-shrink-0 rounded bg-[#202020] border border-[#2A2A2A] px-2 py-0.5 text-[10px] text-gray-400">
                      Task
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    title="Delete task"
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-gray-600 hover:text-red-400 p-1 transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Calendar events today */}
              {todayEvents.map((ev, idx) => {
                const eventId = ev.id || ev.googleEventId || ev.iCalUID || `today-ev-${idx}`;
                return (
                  <CalendarEventCard
                    key={eventId}
                    event={ev}
                    onAddTask={() =>
                        setPendingImport({
                          sourceType: 'calendar',
                          sourceId: eventId,
                          title: ev.title,
                          dueDate: todayDateStr,
                        })
                    }
                  />
                );
              })}

              {/* Mail signals today */}
              {todayMail.map((mail, idx) => {
                const mailKey = mail.id || mail.messageId || `today-mail-${idx}`;
                return (
                  <div key={mailKey} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-[#1A1A1A] transition-colors group">
                    <div className="h-4 w-4 flex-shrink-0 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-gray-200 group-hover:text-white transition-colors" title={mail.subject}>
                        {mail.subject}
                      </span>
                      <span className="flex-shrink-0 rounded bg-blue-950/50 border border-blue-800/50 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                        Due Today
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setPendingImport({
                          sourceType: 'mail',
                          sourceId: mail.messageId || mailKey,
                          title: mail.subject,
                          dueDate: todayDateStr,
                        })
                      }
                      title="Add to Google Tasks"
                      className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold bg-[#0D1E3A] hover:bg-[#152B52] text-[#60A5FA] border border-[#1E3A6B] hover:border-[#2E5899] transition-all shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <CheckSquare className="h-3 w-3 text-[#60A5FA]" aria-hidden="true" />
                      <span>+ Task</span>
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </section>

      {/* Confirm modal */}
      {pendingImport && (
        <ImportConfirmModal
          title={pendingImport.title}
          onConfirm={handleImport}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </>
  );
}
