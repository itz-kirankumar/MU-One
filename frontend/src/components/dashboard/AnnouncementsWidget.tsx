'use client';

import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, Plus, Megaphone, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { subscribeToAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '@/lib/firestore';
import type { Announcement } from '@/types';

const ALL_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

function isUrgent(isoDate: string): boolean {
  const eventDate = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return eventDate <= tomorrow;
}

function formatDeadlineDate(isoDate: string): { day: string; month: string; time: string } {
  const d = new Date(isoDate);
  return {
    day: d.toLocaleDateString('en-GB', { day: '2-digit' }),
    month: d.toLocaleDateString('en-GB', { month: 'short' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

function cleanText(text?: string): string {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function SectionSelector({ selected, onChange }: { selected: string[]; onChange: (s: string[]) => void }) {
  const isAll = selected.includes('all');
  const toggleAll = () => onChange(isAll ? [] : ['all']);
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
      <label className="block text-xs text-gray-400 mb-2">Target Sections</label>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={toggleAll} className={`relative flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium border transition-all ${isAll ? 'bg-[#f7d344]/15 border-[#f7d344]/50 text-[#f7d344]' : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-gray-500 hover:text-gray-300'}`}>
          {isAll && <Check className="h-3 w-3" />} All
        </button>
        {ALL_SECTIONS.map(s => {
          const active = isAll || selected.includes(s);
          return (
            <button key={s} type="button" onClick={() => toggleSection(s)} className={`relative flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium border transition-all ${active ? 'bg-[#f7d344]/15 border-[#f7d344]/50 text-[#f7d344]' : 'bg-[#1A1A1A] border-[#333] text-gray-400 hover:border-gray-500 hover:text-gray-300'}`}>
              {active && <Check className="h-3 w-3" />} {s}
            </button>
          );
        })}
      </div>
      {!isAll && selected.length === 0 && <p className="mt-1 text-[10px] text-red-400">Select at least one section</p>}
    </div>
  );
}

function AnnouncementModal({ onClose, onSave, initialData }: { onClose: () => void; onSave: (title: string, date: string, time: string, sections: string[]) => Promise<void>; initialData?: Announcement | null }) {
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [dateStr, setDateStr] = useState(() => {
    const d = initialData ? new Date(initialData.deadlineIso) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [timeStr, setTimeStr] = useState(() => {
    const d = initialData ? new Date(initialData.deadlineIso) : new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [sections, setSections] = useState<string[]>(initialData?.sections?.length ? initialData.sections : ['all']);
  const [loading, setLoading] = useState(false);

  const canSave = title.trim() && dateStr && timeStr && (sections.includes('all') || sections.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setLoading(true);
    await onSave(title, dateStr, timeStr, sections);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[#333] bg-[#111] p-5 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-white">{initialData ? 'Edit' : 'Add'} Announcement</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Title</label>
            <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-md bg-[#222] border border-[#333] px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20" placeholder="E.g., Placement Drive Tomorrow" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Date</label>
              <input required type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className="w-full rounded-md bg-[#222] border border-[#333] px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Time</label>
              <input required type="time" value={timeStr} onChange={e => setTimeStr(e.target.value)} className="w-full rounded-md bg-[#222] border border-[#333] px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20" />
            </div>
          </div>
          <SectionSelector selected={sections} onChange={setSections} />
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !canSave} className="px-4 py-2 text-sm font-semibold text-black bg-[#f7d344] rounded-md hover:bg-yellow-400 disabled:opacity-50 transition-colors">{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectionBadges({ sections }: { sections?: string[] }) {
  if (!sections || sections.length === 0) return null;
  if (sections.includes('all')) {
    return <Badge variant="default" className="bg-[#1A1A1A] text-gray-400 border border-[#333]">All Sections</Badge>;
  }
  return (
    <>
      {sections.map(s => (
        <Badge key={s} variant="default" className="bg-[#1A1A1A] text-gray-400 border border-[#333]">Sec {s}</Badge>
      ))}
    </>
  );
}

function AnnouncementRow({ ann, isAdmin, onEdit, onDelete }: { ann: Announcement; isAdmin: boolean; onEdit: (ann: Announcement) => void; onDelete: (id: string) => void }) {
  const urgent = isUrgent(ann.deadlineIso);
  const { day, month, time } = formatDeadlineDate(ann.deadlineIso);
  const title = cleanText(ann.title);

  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-[#1A1A1A] transition-colors group">
      <div className={`flex w-10 flex-shrink-0 flex-col items-center rounded border px-1 py-1 ${urgent ? 'border-red-800/40 bg-red-900/20 text-red-400' : 'border-[#2A2A2A] bg-[#1A1A1A] text-gray-400'}`}>
        <span className="text-[10px] font-semibold uppercase">{month}</span>
        <span className="text-base font-bold leading-none">{day}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-gray-200">{title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-gray-500">{time}</span>
          <Badge variant="accent">Announcement</Badge>
          <SectionBadges sections={ann.sections} />
        </div>
      </div>
      {isAdmin && (
        <div className="flex-shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
          <button onClick={() => onEdit(ann)} className="text-gray-500 hover:text-blue-400">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => onDelete(ann.id)} className="text-gray-500 hover:text-red-400">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function AnnouncementsWidget({ userPreview = false }: { userPreview?: boolean }) {
  const { access } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);

  const userSection = String(access?.section || '').toUpperCase();
  const isAdmin = access?.isAdmin === true && !userPreview;

  useEffect(() => {
    if (!access?.hasAccess) return;
    return subscribeToAnnouncements((data) => {
      const now = new Date();
      const active = data.filter(a => new Date(a.deadlineIso) > now);
      setAnnouncements(active);
    });
  }, [access?.hasAccess]);

  const visibleAnnouncements = isAdmin
    ? announcements
    : announcements.filter(a => {
        const sections = a.sections ?? ['all'];
        return sections.includes('all') || sections.includes(userSection);
      });

  const handleSaveAnnouncement = async (title: string, date: string, time: string, sections: string[]) => {
    const deadlineIso = new Date(`${date}T${time}`).toISOString();
    if (editingAnn) {
      await updateAnnouncement(editingAnn.id, { title, deadlineIso, sections });
    } else {
      await createAnnouncement({ title, deadlineIso, authorEmail: access?.email || '', sections });
    }
  };

  return (
    <>
      <section className="flex flex-col flex-shrink-0 rounded-xl border border-[#222] bg-[#161616] overflow-hidden max-h-[240px] overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 z-10 bg-[#161616] px-5 py-4 border-b border-[#1A1A1A] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Megaphone className="h-3.5 w-3.5 text-[#f7d344]" />
            <h3 className="text-sm font-semibold text-white">Announcements</h3>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setEditingAnn(null); setModalOpen(true); }}
              className="flex items-center gap-1 text-xs text-[#00E599] hover:text-[#00c580] focus:outline-none transition-colors"
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          )}
        </div>

        <div className="px-2 py-2 space-y-0.5">
          {visibleAnnouncements.length === 0 ? (
            <EmptyState title="No active announcements" />
          ) : (
            visibleAnnouncements.map((ann) => (
              <AnnouncementRow
                key={ann.id}
                ann={ann}
                isAdmin={isAdmin}
                onEdit={(a) => { setEditingAnn(a); setModalOpen(true); }}
                onDelete={deleteAnnouncement}
              />
            ))
          )}
        </div>
      </section>

      {modalOpen && <AnnouncementModal
        onClose={() => setModalOpen(false)}
        onSave={handleSaveAnnouncement}
        initialData={editingAnn}
      />}
    </>
  );
}
