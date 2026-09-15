'use client';

import React, { useState } from 'react';
import { Plus, CheckCircle2, Circle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { updatePersonalTask } from '@/lib/firestore';
import { importTodaySuggestion } from '@/lib/functions';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { NormalizedEvent, MailSignal, PersonalTask } from '@/types';

const TODAY_ISO = new Date().toISOString().slice(0, 10);

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

  // Personal tasks due today
  const todayPersonalTasks = personalTasks.filter(
    (t) => t.dueDate === TODAY_ISO
  );

  // Calendar events today
  const todayEvents = (dashboardData?.events ?? []).filter((e) =>
    e.startIso.startsWith(TODAY_ISO)
  );

  // Mail with dueDate today
  const todayMail = (dashboardData?.mailSignals ?? []).filter(
    (m) => m.dueDate === TODAY_ISO
  );

  const isEmpty = todayPersonalTasks.length === 0 && todayEvents.length === 0 && todayMail.length === 0;

  async function handleToggleTask(task: PersonalTask) {
    if (!user) return;
    await updatePersonalTask(user.uid, task.id, { completed: !task.completed });
  }

  async function handleImport() {
    if (!pendingImport) return;
    await importTodaySuggestion(pendingImport);
    setPendingImport(null);
  }

  return (
    <>
      <section className="rounded-xl border border-[#222] bg-[#161616] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1A1A1A]">
          <h3 className="text-sm font-semibold text-white">Today</h3>
        </div>

        <div className="px-4 py-3 space-y-1">
          {isEmpty ? (
            <EmptyState title="Nothing due today — stay ahead!" />
          ) : (
            <>
              {/* Personal tasks */}
              {todayPersonalTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#1A1A1A] transition-colors">
                  <button
                    onClick={() => handleToggleTask(task)}
                    aria-label={task.completed ? `Mark "${task.title}" incomplete` : `Complete "${task.title}"`}
                    className="flex-shrink-0 text-gray-500 hover:text-[#f7d344] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344] rounded"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
                    ) : (
                      <Circle className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${task.completed ? 'line-through text-gray-600' : 'text-gray-200'}`}>
                    {task.title}
                  </span>
                </div>
              ))}

              {/* Calendar events today */}
              {todayEvents.map((ev, idx) => {
                const eventId = ev.id || ev.googleEventId || ev.iCalUID || `today-ev-${idx}`;
                return (
                  <div key={eventId} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#1A1A1A] transition-colors">
                    <div className="h-4 w-4 flex-shrink-0 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-[#f7d344]" />
                    </div>
                    <span className="flex-1 min-w-0 truncate text-sm text-gray-200">{ev.title}</span>
                    <button
                      onClick={() =>
                        setPendingImport({
                          sourceType: 'calendar',
                          sourceId: eventId,
                          title: ev.title,
                          dueDate: TODAY_ISO,
                        })
                      }
                      className="flex-shrink-0 text-[10px] text-gray-500 hover:text-[#f7d344] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344] rounded"
                    >
                      + Task
                    </button>
                  </div>
                );
              })}

              {/* Mail signals today */}
              {todayMail.map((mail, idx) => {
                const mailKey = mail.id || mail.messageId || `today-mail-${idx}`;
                return (
                  <div key={mailKey} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-[#1A1A1A] transition-colors">
                    <div className="h-4 w-4 flex-shrink-0 flex items-center justify-center">
                      <div className="h-2 w-2 rounded-full bg-blue-400" />
                    </div>
                    <span className="flex-1 min-w-0 truncate text-sm text-gray-200">{mail.subject}</span>
                    <button
                      onClick={() =>
                        setPendingImport({
                          sourceType: 'mail',
                          sourceId: mail.messageId || mailKey,
                          title: mail.subject,
                          dueDate: TODAY_ISO,
                        })
                      }
                      className="flex-shrink-0 text-[10px] text-gray-500 hover:text-[#f7d344] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344] rounded"
                    >
                      + Task
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
