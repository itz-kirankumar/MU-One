'use client';

import { useMemo, useState } from 'react';
import { Inbox, Mail, MailOpen, PenLine, Pin, Plus, Search, Tag, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { updateMailWorkspace } from '@/lib/firestore';
import { MailDrawer } from '@/components/dashboard/MailDrawer';
import type { MailLabel, MailSignal, MailWorkspace } from '@/types';

const LABEL_COLORS = ['#F87171', '#FB923C', '#FACC15', '#4ADE80', '#38BDF8', '#A78BFA', '#F472B6'];
const DEFAULT_WORKSPACE: MailWorkspace = {
  labels: [
    { id: 'important', name: 'Important', color: '#F87171' },
    { id: 'assignment', name: 'Assignment', color: '#FACC15' },
    { id: 'follow-up', name: 'Follow up', color: '#38BDF8' },
  ],
  messages: {},
};

type MailFilter = 'inbox' | 'pinned' | 'all' | string;

function mailId(mail: MailSignal): string {
  return mail.messageId || mail.id || '';
}

function sender(mail: MailSignal): string {
  return mail.sender || mail.from || mail.fromEmail || "Masters' Union";
}

function formatReceived(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface EmailCenterProps {
  onCompose: () => void;
}

export function EmailCenter({ onCompose }: EmailCenterProps) {
  const { user, profile } = useAuth();
  const { dashboardData, loading } = useDashboard();
  const [localWorkspace, setLocalWorkspace] = useState<MailWorkspace | null>(null);
  const [filter, setFilter] = useState<MailFilter>('inbox');
  const [query, setQuery] = useState('');
  const [selectedMail, setSelectedMail] = useState<MailSignal | null>(null);
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[4]);
  const [saveError, setSaveError] = useState('');

  const workspace = localWorkspace ?? profile?.mailWorkspace ?? DEFAULT_WORKSPACE;
  const mails = useMemo(() => dashboardData?.mailSignals ?? (dashboardData as { importantMail?: MailSignal[] } | null)?.importantMail ?? [], [dashboardData]);

  const saveWorkspace = (next: MailWorkspace) => {
    setLocalWorkspace(next);
    setSaveError('');
    if (user) updateMailWorkspace(user.uid, next).catch(() => setSaveError('Could not save mail changes. Please retry.'));
  };

  const patchMessage = (id: string, patch: Partial<MailWorkspace['messages'][string]>) => {
    if (!id) return;
    const current = workspace.messages[id] ?? {};
    saveWorkspace({ ...workspace, messages: { ...workspace.messages, [id]: { ...current, ...patch } } });
  };

  const toggleLabel = (id: string, labelId: string) => {
    const current = workspace.messages[id] ?? {};
    const labels = new Set(current.labelIds ?? []);
    if (labels.has(labelId)) labels.delete(labelId); else labels.add(labelId);
    patchMessage(id, { labelIds: [...labels] });
  };

  const createLabel = () => {
    const name = newLabelName.trim();
    if (!name || workspace.labels.some(label => label.name.toLowerCase() === name.toLowerCase())) return;
    const label: MailLabel = { id: `${Date.now()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`, name, color: newLabelColor };
    saveWorkspace({ ...workspace, labels: [...workspace.labels, label] });
    setNewLabelName('');
    setShowNewLabel(false);
  };

  const deleteLabel = (labelId: string) => {
    const messages = Object.fromEntries(Object.entries(workspace.messages).map(([id, state]) => [id, { ...state, labelIds: (state.labelIds ?? []).filter(value => value !== labelId) }]));
    saveWorkspace({ labels: workspace.labels.filter(label => label.id !== labelId), messages });
    if (filter === labelId) setFilter('inbox');
  };

  const visibleMails = useMemo(() => {
    const search = query.trim().toLowerCase();
    return [...mails]
      .filter(mail => {
        const id = mailId(mail);
        const state = workspace.messages[id] ?? {};
        if (filter === 'inbox' && state.read && !(state.labelIds?.length)) return false;
        if (filter === 'pinned' && !state.pinned) return false;
        if (filter !== 'inbox' && filter !== 'pinned' && filter !== 'all' && !state.labelIds?.includes(filter)) return false;
        if (!search) return true;
        return `${sender(mail)} ${mail.subject} ${mail.snippet}`.toLowerCase().includes(search);
      })
      .sort((a, b) => {
        const pinDiff = Number(Boolean(workspace.messages[mailId(b)]?.pinned)) - Number(Boolean(workspace.messages[mailId(a)]?.pinned));
        return pinDiff || b.receivedAt.localeCompare(a.receivedAt);
      });
  }, [filter, mails, query, workspace.messages]);

  const filterButton = (id: MailFilter, label: string, count?: number) => (
    <button type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs ${filter === id ? 'bg-[#2b2716] font-semibold text-[#f7d344]' : 'text-gray-400 hover:bg-[#1d1d1d] hover:text-white'}`}>
      <span>{label}</span>{typeof count === 'number' && <span className="text-[10px] tabular-nums text-gray-500">{count}</span>}
    </button>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-[#252525] bg-[#131313]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#252525] px-4 py-3">
        <div><h1 className="text-base font-semibold text-white">Email Center</h1><p className="mt-0.5 text-xs text-gray-500">Organize MU mail with labels, pins and read status.</p></div>
        <button type="button" onClick={onCompose} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#f7d344] px-4 text-xs font-semibold text-black hover:bg-[#ffe36c]"><PenLine className="h-3.5 w-3.5" />Compose</button>
      </header>

      <div className="grid min-h-[600px] md:grid-cols-[190px_1fr]">
        <aside className="border-b border-[#252525] p-3 md:border-b-0 md:border-r">
          <div className="grid grid-cols-3 gap-1 md:block md:space-y-1">
            {filterButton('inbox', 'Inbox', mails.filter(mail => !workspace.messages[mailId(mail)]?.read || workspace.messages[mailId(mail)]?.labelIds?.length).length)}
            {filterButton('pinned', 'Pinned', mails.filter(mail => workspace.messages[mailId(mail)]?.pinned).length)}
            {filterButton('all', 'All mail', mails.length)}
          </div>
          <div className="mt-4 border-t border-[#252525] pt-3">
            <div className="mb-2 flex items-center justify-between px-2"><span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Labels</span><button type="button" onClick={() => setShowNewLabel(value => !value)} aria-label="Create label" className="grid h-7 w-7 place-items-center rounded-md text-gray-500 hover:bg-[#222] hover:text-white"><Plus className="h-3.5 w-3.5" /></button></div>
            {showNewLabel && <div className="mb-3 space-y-2 rounded-lg border border-[#303030] bg-[#181818] p-2">
              <input value={newLabelName} onChange={event => setNewLabelName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') createLabel(); }} maxLength={30} placeholder="Label name" aria-label="Label name" className="h-8 w-full rounded-md border border-[#303030] bg-[#101010] px-2 text-xs text-white outline-none focus:border-[#f7d344]" />
              <div className="flex flex-wrap gap-1">{LABEL_COLORS.map(color => <button key={color} type="button" onClick={() => setNewLabelColor(color)} aria-label={`Use ${color} label color`} className={`h-5 w-5 rounded-full ${newLabelColor === color ? 'ring-2 ring-white ring-offset-1 ring-offset-[#181818]' : ''}`} style={{ backgroundColor: color }} />)}</div>
              <button type="button" onClick={createLabel} aria-label="Save label" className="h-7 w-full rounded-md bg-[#f7d344] text-[11px] font-semibold text-black">Create label</button>
            </div>}
            <div className="space-y-1">{workspace.labels.map(label => <div key={label.id} className="group flex items-center gap-1"><button type="button" onClick={() => setFilter(label.id)} aria-pressed={filter === label.id} className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-xs ${filter === label.id ? 'bg-[#202020] text-white' : 'text-gray-400 hover:bg-[#1d1d1d]'}`}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: label.color }} /><span className="truncate">{label.name}</span></button><button type="button" onClick={() => deleteLabel(label.id)} aria-label={`Delete ${label.name} label`} className="hidden h-7 w-7 place-items-center rounded text-gray-600 hover:text-red-400 group-hover:grid"><X className="h-3 w-3" /></button></div>)}</div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="border-b border-[#252525] p-3"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-600" /><span className="sr-only">Search mail</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search sender, subject or message" className="h-9 w-full rounded-lg border border-[#2d2d2d] bg-[#101010] pl-9 pr-3 text-xs text-white outline-none focus:border-[#f7d344]" /></label>{saveError && <p role="alert" className="mt-2 text-xs text-red-400">{saveError}</p>}</div>
          <div className="divide-y divide-[#222]">
            {loading ? <p className="p-8 text-center text-xs text-gray-500">Loading mail…</p> : visibleMails.length === 0 ? <div className="grid min-h-64 place-items-center px-4 text-center"><div><Inbox className="mx-auto h-7 w-7 text-gray-700" /><p className="mt-2 text-sm text-gray-400">No mail in this view</p></div></div> : visibleMails.map(mail => {
              const id = mailId(mail);
              const state = workspace.messages[id] ?? {};
              const assigned = workspace.labels.filter(label => state.labelIds?.includes(label.id));
              return <article key={id} className={`group px-3 py-3 transition-colors hover:bg-[#181818] ${state.read ? 'bg-[#101010] opacity-75' : 'bg-[#151515]'}`}>
                <div className="flex items-start gap-2">
                  <button type="button" onClick={() => patchMessage(id, { pinned: !state.pinned })} aria-label={state.pinned ? `Unpin ${mail.subject}` : `Pin ${mail.subject}`} className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${state.pinned ? 'text-[#f7d344]' : 'text-gray-600 hover:text-[#f7d344]'}`}><Pin className="h-3.5 w-3.5" fill={state.pinned ? 'currentColor' : 'none'} /></button>
                  <button type="button" onClick={() => setSelectedMail(mail)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#f7d344]"><div className="flex items-center justify-between gap-3"><span className={`truncate text-xs ${state.read ? 'text-gray-400' : 'font-semibold text-white'}`}>{sender(mail)}</span><span className="shrink-0 text-[10px] text-gray-600">{formatReceived(mail.receivedAt)}</span></div><h2 className={`mt-0.5 truncate text-sm ${state.read ? 'text-gray-400' : 'font-semibold text-gray-100'}`}>{mail.subject || '(No subject)'}</h2><p className="mt-0.5 line-clamp-1 text-xs text-gray-600">{mail.snippet}</p></button>
                  <button type="button" onClick={() => patchMessage(id, { read: !state.read })} title={state.read ? 'Mark as unread' : 'Mark as read'} aria-label={state.read ? `Mark ${mail.subject} as unread` : `Mark ${mail.subject} as read`} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-gray-500 hover:bg-[#222] hover:text-white">{state.read ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}</button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-10">
                  {assigned.map(label => <button key={label.id} type="button" onClick={() => toggleLabel(id, label.id)} title={`Remove ${label.name}`} className="rounded-full border px-2 py-0.5 text-[10px]" style={{ color: label.color, borderColor: `${label.color}66`, backgroundColor: `${label.color}12` }}>{label.name} ×</button>)}
                  <label className="inline-flex items-center gap-1 text-[10px] text-gray-600"><Tag className="h-3 w-3" /><span className="sr-only">Add label</span><select aria-label={`Add label to ${mail.subject}`} value="" onChange={event => { if (event.target.value) toggleLabel(id, event.target.value); }} className="h-6 cursor-pointer rounded-md border border-[#303030] bg-[#171717] px-1.5 text-[10px] text-gray-400 outline-none hover:text-white focus:border-[#f7d344]"><option value="">+ Label</option>{workspace.labels.filter(label => !state.labelIds?.includes(label.id)).map(label => <option key={label.id} value={label.id}>{label.name}</option>)}</select></label>
                </div>
              </article>;
            })}
          </div>
        </div>
      </div>

      {selectedMail && <MailDrawer mail={selectedMail} onClose={() => setSelectedMail(null)} onComplete={() => { const id = mailId(selectedMail); patchMessage(id, { read: true }); setSelectedMail(null); }} />}
    </section>
  );
}
