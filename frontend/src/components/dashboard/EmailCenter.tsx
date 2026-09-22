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
    <section className="flex flex-col h-[calc(100vh-130px)] overflow-hidden rounded-xl border border-[#252525] bg-[#0A0A0A]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#252525] px-4 py-3 bg-[#131313]">
        <div><h1 className="text-base font-semibold text-white">Email Center</h1><p className="mt-0.5 text-xs text-gray-500">Organize MU mail with labels, pins and read status.</p></div>
        <button type="button" onClick={onCompose} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#f7d344] px-4 text-xs font-semibold text-black hover:bg-[#ffe36c]"><PenLine className="h-3.5 w-3.5" />Compose</button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-[220px] shrink-0 overflow-y-auto border-r border-[#252525] p-3 md:block custom-scrollbar">
          <div className="space-y-1">
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

        <div className="flex flex-1 flex-col min-w-0 bg-[#0F0F0F]">
          <div className="shrink-0 border-b border-[#252525] p-2 bg-[#131313] flex items-center justify-between">
            <label className="relative block w-full max-w-md"><Search className="pointer-events-none absolute left-3 top-2 h-4 w-4 text-gray-500" /><span className="sr-only">Search mail</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search mail" className="h-8 w-full rounded-md bg-[#222] pl-9 pr-3 text-xs text-white outline-none focus:bg-[#2a2a2a] focus:ring-1 focus:ring-[#f7d344]" /></label>
            {saveError && <p role="alert" className="ml-4 text-xs text-red-400">{saveError}</p>}
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[#1e1e1e]">
            {loading ? <p className="p-8 text-center text-xs text-gray-500">Loading mail…</p> : visibleMails.length === 0 ? <div className="grid h-full place-items-center px-4 text-center"><div><Inbox className="mx-auto h-7 w-7 text-gray-700" /><p className="mt-2 text-sm text-gray-400">No mail in this view</p></div></div> : visibleMails.map(mail => {
              const id = mailId(mail);
              const state = workspace.messages[id] ?? {};
              const assigned = workspace.labels.filter(label => state.labelIds?.includes(label.id));
              
              return <article key={id} onClick={() => setSelectedMail(mail)} className={`group flex items-center gap-3 px-3 py-2 transition-colors cursor-pointer ${state.read ? 'bg-[#0A0A0A] text-gray-400 hover:bg-[#121212]' : 'bg-[#151515] text-gray-100 font-medium hover:bg-[#1a1a1a]'}`}>
                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={(e) => { e.stopPropagation(); patchMessage(id, { pinned: !state.pinned }); }} aria-label={state.pinned ? 'Unpin' : 'Pin'} className={`grid h-6 w-6 place-items-center rounded-md ${state.pinned ? 'text-[#f7d344] opacity-100' : 'text-gray-500 hover:text-[#f7d344]'}`}><Pin className="h-3.5 w-3.5" fill={state.pinned ? 'currentColor' : 'none'} /></button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); patchMessage(id, { read: !state.read }); }} title={state.read ? 'Mark as unread' : 'Mark as read'} className="grid h-6 w-6 place-items-center rounded-md text-gray-500 hover:text-white">{state.read ? <Mail className="h-3.5 w-3.5" /> : <MailOpen className="h-3.5 w-3.5" />}</button>
                </div>
                
                {/* Sender */}
                <div className="w-[140px] md:w-[180px] shrink-0 truncate text-[13px]">{sender(mail)}</div>
                
                {/* Subject & Snippet */}
                <div className="flex-1 truncate text-[13px]">
                  <span className={state.read ? 'text-gray-300' : 'text-white'}>{mail.subject || '(No subject)'}</span>
                  <span className="mx-2 text-gray-600">-</span>
                  <span className="text-gray-500">{mail.snippet}</span>
                </div>
                
                {/* Labels & Tags (Hover) */}
                <div className="hidden md:flex items-center gap-1.5 shrink-0">
                  {assigned.map(label => <button key={label.id} type="button" onClick={(e) => { e.stopPropagation(); toggleLabel(id, label.id); }} title={`Remove ${label.name}`} className="rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap hover:opacity-75 transition-opacity" style={{ color: label.color, borderColor: `${label.color}44`, backgroundColor: `${label.color}11`, borderWidth: 1 }}>{label.name}</button>)}
                  
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                    <select aria-label="Add label" value="" onClick={(e) => e.stopPropagation()} onChange={event => { if (event.target.value) toggleLabel(id, event.target.value); }} className="w-6 h-6 opacity-0 absolute cursor-pointer"><option value="">+ Label</option>{workspace.labels.filter(label => !state.labelIds?.includes(label.id)).map(label => <option key={label.id} value={label.id}>{label.name}</option>)}</select>
                    <button type="button" className="grid h-6 w-6 place-items-center rounded-md text-gray-500 hover:bg-[#2a2a2a] hover:text-white pointer-events-none"><Tag className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                
                {/* Date */}
                <div className="w-[60px] shrink-0 text-right text-[11px] text-gray-500 group-hover:hidden md:group-hover:block">{formatReceived(mail.receivedAt)}</div>
              </article>;
            })}
          </div>
        </div>
      </div>

      {selectedMail && <MailDrawer mail={selectedMail} onClose={() => setSelectedMail(null)} onComplete={() => { const id = mailId(selectedMail); patchMessage(id, { read: true }); setSelectedMail(null); }} />}
    </section>
  );
}
