'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Circle, CheckCircle2, Calendar as CalendarIcon } from 'lucide-react';
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
  
  // Optimistic UI states for instant perceived performance
  const [optimisticCompleted, setOptimisticCompleted] = useState<Set<string>>(new Set());
  const [optimisticAdded, setOptimisticAdded] = useState<GoogleTask[]>([]);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  // Clean up optimistic additions when real data catches up
  const realTasksLength = dashboardData?.googleTasks?.length || 0;
  useEffect(() => {
    if (optimisticAdded.length > 0) {
      setOptimisticAdded([]);
    }
  }, [realTasksLength]); // Re-evaluate when real tasks update

  const realTasks = (dashboardData?.googleTasks ?? []).filter(
    (t) => !t.completed && !optimisticCompleted.has(t.id || t.taskId || '')
  );
  
  const tasks = [...optimisticAdded, ...realTasks];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    
    // Optimistic Add
    const tempId = `optimistic-${Date.now()}`;
    const newTask: GoogleTask = {
      id: tempId,
      taskId: tempId,
      taskListId: '',
      title: trimmed,
      dueDate: newDue || undefined,
      completed: false,
    };
    
    setOptimisticAdded((prev) => [newTask, ...prev]);
    setNewTitle('');
    setNewDue('');
    setCreating(true);
    
    try {
      await createGoogleTask({ title: trimmed, dueDate: newDue || undefined });
      // The listener will pull the real task and trigger the useEffect to clear optimisticAdded
    } catch (err: unknown) {
      setOptimisticAdded((prev) => prev.filter(t => t.id !== tempId));
      alert(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setCreating(false);
    }
  }

  async function handleComplete(task: GoogleTask) {
    const taskId = (task.id || task.taskId || '').trim();
    if (!taskId || taskId.startsWith('optimistic-')) return;
    
    // Optimistic Complete (hides it instantly)
    setOptimisticCompleted((prev) => new Set(prev).add(taskId));
    
    try {
      await completeGoogleTask({ taskId, taskListId: task.taskListId });
    } catch (err: unknown) {
      // Revert if failed
      setOptimisticCompleted((prev) => {
        const n = new Set(prev);
        n.delete(taskId);
        return n;
      });
      const msg = err instanceof Error ? err.message : 'Failed to complete task';
      setActionErrors((prev) => ({ ...prev, [taskId]: msg }));
      setTimeout(() => setActionErrors((prev) => { const n = {...prev}; delete n[taskId]; return n; }), 3000);
    }
  }

  return (
    <section className="flex-1 flex flex-col min-h-[600px] rounded-xl border border-[#222] bg-[#161616] overflow-hidden">
      <div className="sticky top-0 z-10 bg-[#161616] px-5 py-4 border-b border-[#1A1A1A] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white tracking-wide">Google Tasks</h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[#222] text-gray-400 font-medium">
          {tasks.length} active
        </span>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Modern New Task Input */}
        <div className="p-4 border-b border-[#1A1A1A]">
          <form onSubmit={handleCreate} className="relative flex flex-col gap-3 p-3 bg-[#111] border border-[#2A2A2A] rounded-lg focus-within:border-[#444] transition-colors shadow-inner">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none w-full"
            />
            <div className="flex items-center justify-between pt-1 border-t border-[#1A1A1A]">
              <div className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 transition-colors">
                <CalendarIcon className="h-3.5 w-3.5" />
                <input
                  type="date"
                  value={newDue}
                  onChange={(e) => setNewDue(e.target.value)}
                  className="bg-transparent text-xs focus:outline-none [color-scheme:dark] cursor-pointer"
                />
              </div>
              <button
                type="submit"
                disabled={!newTitle.trim() || creating}
                className="text-xs font-medium bg-white text-black px-3 py-1.5 rounded-md hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-white transition-colors"
              >
                Add Task
              </button>
            </div>
          </form>
        </div>

        {/* Task list scrollable area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {loading && tasks.length === 0 ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-[#222]" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="mt-8">
              <EmptyState title="All caught up!" description="No active tasks in your Google account." />
            </div>
          ) : (
            tasks.map((task, idx) => {
              const taskId = task.id || task.taskId || `gtask-${idx}`;
              const isOptimistic = taskId.startsWith('optimistic-');
              const listTitle = task.taskListName || task.taskListTitle;
              
              return (
                <div key={taskId} className={`group flex flex-col gap-0.5 transition-all duration-300 ${isOptimistic ? 'opacity-50' : 'opacity-100'}`}>
                  <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-[#1A1A1A] border border-transparent hover:border-[#222] transition-colors">
                    <button
                      onClick={() => handleComplete(task)}
                      disabled={isOptimistic}
                      className="mt-0.5 flex-shrink-0 text-gray-500 hover:text-emerald-400 disabled:opacity-40 transition-colors"
                    >
                      <Circle className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="text-sm text-gray-200 leading-snug">{task.title}</span>
                      
                      {/* Meta info row */}
                      {(listTitle || task.dueDate) && (
                        <div className="flex items-center gap-2 mt-1">
                          {task.dueDate && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#222] text-yellow-500/80 font-medium">
                              {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          )}
                          {listTitle && (
                            <span className="text-[10px] text-gray-500 truncate">
                              {listTitle}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {actionErrors[taskId] && (
                    <p className="pl-10 text-xs text-red-400" role="alert">
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
