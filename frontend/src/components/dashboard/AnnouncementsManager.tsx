'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Megaphone, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { subscribeToAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '@/lib/firestore';
import type { Announcement } from '@/types';

const ALL_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

function formatDeadlineDate(isoDate: string): { day: string; month: string; time: string; isPast: boolean } {
  const d = new Date(isoDate);
  const now = new Date();
  return {
    day: d.toLocaleDateString('en-GB', { day: '2-digit' }),
    month: d.toLocaleDateString('en-GB', { month: 'short' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    isPast: d < now,
  };
}

/* ── Section multi-select chip group ─────────────────────────────────────── */
function SectionSelector({ selected, onChange }: { selected: string[]; onChange: (s: string[]) => void }) {
  const isAll = selected.includes('all');

  const toggleAll = () => {
    onChange(isAll ? [] : ['all']);
  };

  const toggleSection = (s: string) => {
    if (isAll) {
      onChange(ALL_SECTIONS.filter(sec => sec !== s));
      return;
    }
    const next = selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s];
    if (ALL_SECTIONS.every(sec => next.includes(sec))) {
      onChange(['all']);
    } else {
      onChange(next);
    }
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-300">Target Sections</label>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        <button
          type="button"
          onClick={toggleAll}
          className={`relative flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium border transition-all ${
            isAll
              ? 'bg-[#f7d344]/15 border-[#f7d344]/50 text-[#f7d344]'
              : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-gray-500 hover:text-gray-300'
          }`}
        >
          {isAll && <Check className="h-3 w-3" />}
          All Sections
        </button>
        {ALL_SECTIONS.map(s => {
          const active = isAll || selected.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleSection(s)}
              className={`relative flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium border transition-all ${
                active
                  ? 'bg-[#f7d344]/15 border-[#f7d344]/50 text-[#f7d344]'
                  : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              {active && <Check className="h-3 w-3" />}
              Sec {s}
            </button>
          );
        })}
      </div>
      {!isAll && selected.length === 0 && (
        <p className="mt-1 text-[10px] text-red-400">Select at least one section</p>
      )}
    </div>
  );
}

/* ── Section badges ──────────────────────────────────────────────────────── */
function SectionBadges({ sections }: { sections?: string[] }) {
  if (!sections || sections.length === 0 || sections.includes('all')) {
    return <Badge variant="default" className="bg-gray-800 text-gray-400">All Sections</Badge>;
  }
  return (
    <>
      {sections.map(s => (
        <Badge key={s} variant="default" className="bg-gray-800 text-gray-400">Sec {s}</Badge>
      ))}
    </>
  );
}

export function AnnouncementsManager() {
  const { access } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);

  // Modal form states
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [sections, setSections] = useState<string[]>(['all']);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!access?.hasAccess) return;
    return subscribeToAnnouncements((data) => {
      // Show ALL announcements here (sort by deadline desc)
      const sorted = [...data].sort((a, b) => b.deadlineIso.localeCompare(a.deadlineIso));
      setAnnouncements(sorted);
    });
  }, [access?.hasAccess]);

  const isAdmin = access?.isAdmin === true;

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState title="Access Denied" description="You must be an administrator to manage announcements." />
      </div>
    );
  }

  const openAddModal = () => {
    setEditingAnn(null);
    setTitle('');
    const d = new Date();
    setDateStr(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setTimeStr(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setSections(['all']);
    setModalOpen(true);
  };

  const openEditModal = (ann: Announcement) => {
    setEditingAnn(ann);
    setTitle(ann.title);
    const d = new Date(ann.deadlineIso);
    setDateStr(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setTimeStr(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    setSections(ann.sections?.length ? ann.sections : ['all']);
    setModalOpen(true);
  };

  const canSave = title.trim() && dateStr && timeStr && (sections.includes('all') || sections.length > 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setLoading(true);
    try {
      const deadlineIso = new Date(`${dateStr}T${timeStr}`).toISOString();
      if (editingAnn) {
        await updateAnnouncement(editingAnn.id, { title, deadlineIso, sections });
      } else {
        await createAnnouncement({ title, deadlineIso, authorEmail: access?.email || '', sections });
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#222] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-[#f7d344]/10">
            <Megaphone className="h-4 w-4 text-[#f7d344]" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Announcements Manager</h1>
            <p className="text-xs text-gray-500">Manage all active and past platform announcements</p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-md bg-[#f7d344] px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-[#0A0A0A] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Announcement
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {announcements.length === 0 ? (
          <div className="mt-12">
            <EmptyState title="No announcements found" description="Create an announcement to broadcast to all students." />
          </div>
        ) : (
          <div className="grid gap-3">
            {announcements.map((ann) => {
              const { day, month, time, isPast } = formatDeadlineDate(ann.deadlineIso);
              return (
                <div key={ann.id} className={`flex items-start gap-4 rounded-xl border p-4 transition-colors group ${isPast ? 'border-[#222] bg-[#111] opacity-70' : 'border-[#333] bg-[#161616]'}`}>
                  <div className={`flex w-14 flex-shrink-0 flex-col items-center justify-center rounded-lg border py-2 ${isPast ? 'border-[#2A2A2A] bg-[#1A1A1A] text-gray-500' : 'border-[#f7d344]/30 bg-[#f7d344]/10 text-[#f7d344]'}`}>
                    <span className="text-xs font-semibold uppercase">{month}</span>
                    <span className="text-xl font-bold leading-none">{day}</span>
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <h3 className={`text-base font-medium truncate ${isPast ? 'text-gray-400' : 'text-gray-100'}`}>{ann.title}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500">Deadline: {time}</span>
                      {isPast ? (
                        <Badge variant="default" className="bg-gray-800 text-gray-400">Past</Badge>
                      ) : (
                        <Badge variant="accent">Active</Badge>
                      )}
                      <SectionBadges sections={ann.sections} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 py-2">
                    <button onClick={() => openEditModal(ann)} className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => deleteAnnouncement(ann.id)} className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-[#333] bg-[#161616] p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-semibold text-white">
              {editingAnn ? 'Edit Announcement' : 'New Announcement'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-[#333] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                  placeholder="E.g., Placement Drive Tomorrow"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">Deadline Date</label>
                  <input
                    type="date"
                    required
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full rounded-md border border-[#333] bg-[#0A0A0A] px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">Deadline Time</label>
                  <input
                    type="time"
                    required
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    className="w-full rounded-md border border-[#333] bg-[#0A0A0A] px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                  />
                </div>
              </div>
              <SectionSelector selected={sections} onChange={setSections} />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !canSave}
                  className="rounded-md bg-[#f7d344] px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
