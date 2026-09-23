'use client';

import React, { useEffect, useState } from 'react';
import { listPlatformAccess, updatePlatformAccess, type AccessListResult } from '@/lib/functions';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { UserCheck, Clock, Shield, Check, X, ShieldAlert, Eye, LayoutDashboard } from 'lucide-react';

export function AdminAccessControl() {
  const [data, setData] = useState<AccessListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const result = await listPlatformAccess();
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load access list.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void listPlatformAccess()
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Failed to load access list.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function handleGrant(email: string) {
    setProcessing(email);
    try {
      await updatePlatformAccess('grant', email);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to grant access');
    } finally {
      setProcessing(null);
    }
  }

  async function handleRevoke(email: string) {
    if (email === data?.adminEmail) {
      alert('Cannot revoke permanent administrator.');
      return;
    }
    setProcessing(email);
    try {
      await updatePlatformAccess('revoke', email);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to revoke access');
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <LoadingSpinner size="md" label="Loading access controls..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-400" />
        <h3 className="mb-1 font-semibold text-white">Access Denied or Error</h3>
        <p className="text-sm text-gray-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2 flex items-center gap-2">
            <Shield className="h-6 w-6 text-[#f7d344]" />
            Platform Access Control
          </h1>
          <p className="text-gray-400 text-sm">
            Manage who can access the MU One private beta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.open('/dashboard?preview=user', '_blank', 'noopener,noreferrer')}
            className="flex items-center gap-2 rounded-lg border border-[#3b341a] bg-[#211d0d] px-3 py-2 text-xs font-medium text-[#f7d344] transition-colors hover:bg-[#2b2510]"
          >
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            Preview: User dashboard
          </button>
          <button 
            type="button"
            onClick={() => window.open('?preview=waitlist', '_blank')}
            className="flex items-center gap-2 rounded-lg border border-[#333] bg-[#1a1a1a] px-3 py-2 text-xs font-medium text-gray-300 hover:bg-[#252525] hover:text-white transition-colors"
          >
            <Eye className="h-4 w-4" />
            Preview: Unjoined
          </button>
          <button 
            type="button"
            onClick={() => window.open('?preview=waitlist_joined', '_blank')}
            className="flex items-center gap-2 rounded-lg border border-[#333] bg-[#1a1a1a] px-3 py-2 text-xs font-medium text-gray-300 hover:bg-[#252525] hover:text-white transition-colors"
          >
            <Check className="h-4 w-4 text-green-500" />
            Preview: Joined
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waitlist */}
        <section className="rounded-xl border border-[#222] bg-[#121212] flex flex-col h-[500px]">
          <div className="border-b border-[#222] p-4 flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Waitlist ({data?.waitlist.filter(u => u.status !== 'approved').length ?? 0})
            </h2>
            <button
              onClick={() => {
                if (!data) return;
                const headers = ['Email', 'Name', 'Joined At', 'Program', 'Section', 'Requested Features'];
                const pendingUsers = data.waitlist.filter(u => u.status !== 'approved');
                const rows = pendingUsers.map(u => [
                  u.email,
                  u.displayName || '',
                  u.joinedAt || '',
                  u.program || '',
                  u.section || '',
                  (u.requestedFeatures || '').replace(/"/g, '""') // escape quotes
                ]);
                const csvContent = [
                  headers.join(','),
                  ...rows.map(r => r.map(f => `"${f}"`).join(','))
                ].join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', 'waitlist.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="rounded bg-[#333] px-2 py-1 text-xs text-white hover:bg-[#444]"
            >
              Export CSV
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {!data?.waitlist || data.waitlist.filter(u => u.status !== 'approved').length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No users on the waitlist.</p>
            ) : (
              <ul className="space-y-3">
                {data.waitlist.filter(u => u.status !== 'approved').map((user) => (
                  <li key={user.email} className="flex flex-col gap-2 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] p-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{user.displayName || user.email}</p>
                        {user.displayName && <p className="truncate text-xs text-gray-400">{user.email}</p>}
                        {(user.program || user.section) && (
                          <div className="mt-1 flex gap-2 text-xs text-[#f7d344]">
                            {user.program && <span>{user.program}</span>}
                            {user.section && <span>Sec {user.section}</span>}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleGrant(user.email)}
                        disabled={processing === user.email}
                        className="ml-4 flex items-center gap-1.5 rounded-md bg-[#f7d344] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#ffe36c] disabled:opacity-50"
                      >
                        {processing === user.email ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </>
                        )}
                      </button>
                    </div>
                    {user.requestedFeatures && (
                      <div className="mt-2 rounded-md bg-[#111] p-2 text-xs text-gray-400">
                        <strong>Feedback:</strong> {user.requestedFeatures}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Granted Access */}
        <section className="rounded-xl border border-[#222] bg-[#121212] flex flex-col h-[500px]">
          <div className="border-b border-[#222] p-4 flex items-center justify-between">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-500" />
              Approved Access ({data?.granted.length ?? 0})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {data?.granted.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No approved users.</p>
            ) : (
              <ul className="space-y-3">
                {data?.granted.map((user) => {
                  const isAdmin = user.email === data.adminEmail;
                  return (
                    <li key={user.email} className="flex items-center justify-between rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">{user.email}</p>
                          {isAdmin && (
                            <span className="rounded-full bg-blue-900/50 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                      {!isAdmin && (
                        <button
                          onClick={() => handleRevoke(user.email)}
                          disabled={processing === user.email}
                          className="ml-4 flex items-center gap-1.5 rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          {processing === user.email ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <>
                              <X className="h-3.5 w-3.5" />
                              Revoke
                            </>
                          )}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
