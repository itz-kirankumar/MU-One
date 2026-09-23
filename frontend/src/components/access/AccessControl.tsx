'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Eye, RefreshCw, Search, ShieldCheck, UserMinus, UserPlus } from 'lucide-react';
import Link from 'next/link';
import {
  listPlatformAccess,
  updatePlatformAccess,
  type AccessEntry,
} from '@/lib/functions';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function AccessControl() {
  const [granted, setGranted] = useState<AccessEntry[]>([]);
  const [waitlist, setWaitlist] = useState<AccessEntry[]>([]);
  const [adminEmail, setAdminEmail] = useState('');
  const [email, setEmail] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingEmail, setWorkingEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listPlatformAccess();
      setAdminEmail(result.adminEmail);
      setGranted(result.granted);
      setWaitlist(result.waitlist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load access records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void listPlatformAccess()
      .then(result => {
        if (!active) return;
        setAdminEmail(result.adminEmail);
        setGranted(result.granted);
        setWaitlist(result.waitlist);
      })
      .catch(err => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load access records.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function changeAccess(action: 'grant' | 'revoke', target: string) {
    setWorkingEmail(target);
    setError('');
    setNotice('');
    try {
      await updatePlatformAccess(action, target);
      setNotice(action === 'grant' ? `Access granted to ${target}.` : `Access revoked for ${target}.`);
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update access.');
    } finally {
      setWorkingEmail('');
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const target = email.trim().toLowerCase();
    if (target) void changeAccess('grant', target);
  }

  const grantedSet = useMemo(() => new Set(granted.map(item => item.email)), [granted]);
  const visibleWaitlist = waitlist.filter(item => {
    const needle = query.trim().toLowerCase();
    return !needle || item.email.toLowerCase().includes(needle) || item.displayName?.toLowerCase().includes(needle);
  });

  return (
    <main className="min-h-screen bg-[#090909] text-white">
      <header className="border-b border-[#202020] bg-[#0d0d0d]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" aria-label="Back to dashboard" className="grid h-9 w-9 place-items-center rounded-lg border border-[#292929] text-gray-400 hover:bg-[#191919] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div>
              <h1 className="text-base font-semibold">Access control</h1>
              <p className="text-xs text-gray-500">MU One private beta</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/dashboard?preview=user" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-[#3b341a] bg-[#211d0d] px-3 py-2 text-xs font-medium text-[#f7d344] hover:bg-[#2b2510] focus-visible:ring-2 focus-visible:ring-[#f7d344]">
              <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Preview user dashboard
            </Link>
            <button type="button" onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-lg border border-[#292929] px-3 py-2 text-xs text-gray-300 hover:bg-[#191919] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-7 flex items-start gap-3 rounded-xl border border-[#3c3418] bg-[#1d1a0d] p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#f7d344]" aria-hidden="true" />
          <div><p className="text-sm font-medium">Permanent administrator</p><p className="mt-1 text-sm text-gray-400">{adminEmail || 'kiran.kumar2028@mastersunion.org'} always has access and cannot be revoked.</p></div>
        </div>

        <form onSubmit={submit} className="mb-8 rounded-xl border border-[#252525] bg-[#121212] p-5">
          <label htmlFor="grant-email" className="text-sm font-semibold">Grant access by email</label>
          <p className="mt-1 text-xs text-gray-500">Only @mastersunion.org addresses are accepted.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input id="grant-email" type="email" required pattern=".+@mastersunion\.org" value={email} onChange={event => setEmail(event.target.value)} placeholder="student@mastersunion.org" className="min-w-0 flex-1 rounded-lg border border-[#303030] bg-[#0b0b0b] px-3 py-2.5 text-sm outline-none placeholder:text-gray-600 focus:border-white/20 focus:ring-1 focus:ring-white/20" />
            <button type="submit" disabled={Boolean(workingEmail)} className="flex items-center justify-center gap-2 rounded-lg bg-[#f7d344] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#ffe36c] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]">
              <UserPlus className="h-4 w-4" aria-hidden="true" /> Grant access
            </button>
          </div>
        </form>

        {error && <p role="alert" className="mb-5 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300"><Check className="h-4 w-4" aria-hidden="true" />{notice}</p>}

        {loading && !waitlist.length && !granted.length ? (
          <div className="grid min-h-48 place-items-center"><LoadingSpinner label="Loading access records…" /></div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="waitlist-heading" className="overflow-hidden rounded-xl border border-[#252525] bg-[#121212]">
              <div className="border-b border-[#252525] p-4">
                <div className="flex items-center justify-between"><h2 id="waitlist-heading" className="text-sm font-semibold">Waitlist</h2><span className="rounded bg-[#222] px-2 py-0.5 text-xs text-gray-400">{waitlist.length}</span></div>
                <label className="mt-3 flex items-center gap-2 rounded-lg border border-[#2b2b2b] bg-[#0a0a0a] px-3 py-2 focus-within:border-[#f7d344]">
                  <Search className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" /><span className="sr-only">Search waitlist</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people" className="w-full bg-transparent text-sm outline-none placeholder:text-gray-600" />
                </label>
              </div>
              <ul className="max-h-[480px] divide-y divide-[#222] overflow-y-auto">
                {visibleWaitlist.length ? visibleWaitlist.map(item => (
                  <li key={item.email} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{item.displayName || item.email.split('@')[0]}</p><p className="truncate text-xs text-gray-500">{item.email}</p></div>
                    {grantedSet.has(item.email) || item.status === 'approved' ? <span className="text-xs font-medium text-emerald-400">Approved</span> : <button type="button" onClick={() => void changeAccess('grant', item.email)} disabled={workingEmail === item.email} className="rounded-md bg-[#f7d344] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">Approve</button>}
                  </li>
                )) : <li className="p-8 text-center text-sm text-gray-500">No waitlist requests.</li>}
              </ul>
            </section>

            <section aria-labelledby="granted-heading" className="overflow-hidden rounded-xl border border-[#252525] bg-[#121212]">
              <div className="flex items-center justify-between border-b border-[#252525] p-4"><h2 id="granted-heading" className="text-sm font-semibold">Granted access</h2><span className="rounded bg-[#222] px-2 py-0.5 text-xs text-gray-400">{granted.length + 1}</span></div>
              <ul className="max-h-[540px] divide-y divide-[#222] overflow-y-auto">
                <li className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate text-sm font-medium">Administrator</p><p className="truncate text-xs text-gray-500">{adminEmail || 'kiran.kumar2028@mastersunion.org'}</p></div><span className="text-xs font-medium text-[#f7d344]">Permanent</span></li>
                {granted.map(item => <li key={item.email} className="flex items-center justify-between gap-3 p-4"><p className="min-w-0 truncate text-sm">{item.email}</p><button type="button" onClick={() => void changeAccess('revoke', item.email)} disabled={workingEmail === item.email} className="flex items-center gap-1.5 rounded-md border border-red-900/70 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-950/30 disabled:opacity-50"><UserMinus className="h-3.5 w-3.5" aria-hidden="true" />Revoke</button></li>)}
              </ul>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
