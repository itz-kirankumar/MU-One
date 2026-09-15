'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const displayName = profile?.displayName ?? user?.displayName ?? 'Student';
  const email = profile?.email ?? user?.email ?? '';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.push('/');
  }

  const content = (
    <div
      className={`flex h-full flex-col border-r border-[#222] bg-[#0A0A0A] transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo + toggle */}
      <div className="flex h-14 items-center justify-between border-b border-[#1A1A1A] px-3">
        {!collapsed && (
          <span className="text-sm font-bold tracking-tight text-white">
            MU <span className="text-[#f7d344]">One</span>
          </span>
        )}
        {collapsed && (
          <span className="mx-auto text-xs font-bold text-[#f7d344]">MU</span>
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-[#1A1A1A] hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 p-2" aria-label="Main navigation">
        <a
          href="/dashboard"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white bg-[#1A1A1A] border border-[#2A2A2A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
          aria-current="page"
        >
          <LayoutDashboard className="h-4 w-4 flex-shrink-0 text-[#f7d344]" aria-hidden="true" />
          {!collapsed && <span>Dashboard</span>}
        </a>
        <a
          href="https://coach.mastersunion.org"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-400 hover:bg-[#1A1A1A] hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
        >
          <ExternalLink className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {!collapsed && (
            <span className="flex items-center gap-1">
              Coach Portal
              <ExternalLink className="h-3 w-3 opacity-50" aria-hidden="true" />
            </span>
          )}
        </a>
      </nav>

      {/* User + sign out */}
      <div className="border-t border-[#1A1A1A] p-3 space-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#f7d344] text-[10px] font-bold text-black">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">{displayName}</p>
              <p className="truncate text-[10px] text-gray-500">{email}</p>
            </div>
          )}
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-500 hover:bg-[#1A1A1A] hover:text-red-400 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
        >
          <LogOut className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {!collapsed && <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">{content}</div>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/60 md:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-40 flex md:hidden">
            {/* Force expanded on mobile */}
            <div className="flex h-full flex-col border-r border-[#222] bg-[#0A0A0A] w-60">
              <div className="flex h-14 items-center justify-between border-b border-[#1A1A1A] px-3">
                <span className="text-sm font-bold tracking-tight text-white">
                  MU <span className="text-[#f7d344]">One</span>
                </span>
                <button
                  onClick={onMobileClose}
                  aria-label="Close sidebar"
                  className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-[#1A1A1A] hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7d344]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex-1 space-y-0.5 p-2" aria-label="Main navigation">
                <a
                  href="/dashboard"
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white bg-[#1A1A1A] border border-[#2A2A2A]"
                  aria-current="page"
                >
                  <LayoutDashboard className="h-4 w-4 text-[#f7d344]" />
                  Dashboard
                </a>
                <a
                  href="https://coach.mastersunion.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-400 hover:bg-[#1A1A1A]"
                >
                  <ExternalLink className="h-4 w-4" />
                  Coach Portal
                </a>
              </nav>
              <div className="border-t border-[#1A1A1A] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#f7d344] text-[10px] font-bold text-black">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white">{displayName}</p>
                    <p className="truncate text-[10px] text-gray-500">{email}</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-gray-500 hover:text-red-400"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
