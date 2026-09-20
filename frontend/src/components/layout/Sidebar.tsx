'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  FlaskConical,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  LogOut,
  X,
  Briefcase,
  Trophy,
  Mic,
  BookOpen,
  Bot,
  Sparkles,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Mail,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ConnectedSources } from '@/components/dashboard/ConnectedSources';

export type SidebarTab =
  | 'dashboard'
  | 'email'
  | 'surveys'
  | 'email_qa'
  | 'pitch'
  | 'placement'
  | 'competition'
  | 'speaker'
  | 'case_study'
  | 'copilot';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  activeTab?: SidebarTab;
  onSelectTab?: (tab: SidebarTab) => void;
}

const AI_TOOLS: Array<{
  id: SidebarTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}> = [
  { id: 'pitch', label: 'Pitch & Case Studio', shortLabel: 'Pitch', icon: Trophy, badge: 'STUDIO' },
  { id: 'placement', label: 'Placement Intel', shortLabel: 'Placement', icon: Briefcase, badge: 'AI' },
  { id: 'competition', label: 'Case Comp Radar', shortLabel: 'Compete', icon: Sparkles, badge: 'AI' },
  { id: 'speaker', label: 'Speaker & CXO Prep', shortLabel: 'Speaker', icon: Mic, badge: 'AI' },
  { id: 'case_study', label: 'Case Study Explainer', shortLabel: 'Cases', icon: BookOpen, badge: 'AI' },
  { id: 'copilot', label: 'AI Student Copilot', shortLabel: 'Copilot', icon: Bot, badge: 'PRO' },
];

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  activeTab = 'dashboard',
  onSelectTab,
}: SidebarProps) {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

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

  function handleTabClick(tab: SidebarTab) {
    if (onSelectTab) {
      onSelectTab(tab);
    }
  }

  const renderNavItems = (isMobile = false) => (
    <div className="space-y-4">
      {/* Core Nav */}
      <div className="space-y-1">
        <button
          onClick={() => {
            handleTabClick('dashboard');
            if (isMobile) onMobileClose();
          }}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === 'dashboard'
              ? 'bg-[#1E1E1E] text-white border border-[#2E2E2E] shadow-sm'
              : 'text-gray-400 hover:bg-[#141414] hover:text-white'
          }`}
        >
          <LayoutDashboard
            className={`h-4 w-4 flex-shrink-0 ${
              activeTab === 'dashboard' ? 'text-[#f7d344]' : 'text-gray-400'
            }`}
          />
          {(!collapsed || isMobile) && <span>Dashboard</span>}
        </button>
        <button
          title="Email Center"
          aria-label="Email Center"
          onClick={() => { handleTabClick('email'); if (isMobile) onMobileClose(); }}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${activeTab === 'email' ? 'bg-[#1E1E1E] text-white border border-[#2E2E2E]' : 'text-gray-400 hover:bg-[#141414] hover:text-white'}`}
        >
          <Mail className={`h-4 w-4 flex-shrink-0 ${activeTab === 'email' ? 'text-[#f7d344]' : 'text-gray-400'}`} />
          {(!collapsed || isMobile) && <span>Email Center</span>}
        </button>
        <button
          title="Testmail Email QA"
          aria-label="Testmail Email QA"
          onClick={() => { handleTabClick('email_qa'); if (isMobile) onMobileClose(); }}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${activeTab === 'email_qa' ? 'bg-[#1E1E1E] text-white border border-[#2E2E2E]' : 'text-gray-400 hover:bg-[#141414] hover:text-white'}`}
        >
          <FlaskConical className={`h-4 w-4 flex-shrink-0 ${activeTab === 'email_qa' ? 'text-[#f7d344]' : 'text-gray-400'}`} />
          {(!collapsed || isMobile) && <span>Email QA</span>}
        </button>
        <button
          title="Community surveys"
          aria-label="Community surveys"
          onClick={() => { handleTabClick('surveys'); if (isMobile) onMobileClose(); }}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${activeTab === 'surveys' ? 'bg-[#1E1E1E] text-white border border-[#2E2E2E]' : 'text-gray-400 hover:bg-[#141414] hover:text-white'}`}
        >
          <ClipboardList className={`h-4 w-4 flex-shrink-0 ${activeTab === 'surveys' ? 'text-[#f7d344]' : 'text-gray-400'}`} />
          {(!collapsed || isMobile) && <span>Surveys</span>}
        </button>
      </div>

      {/* Dedicated AI Student Tools Section */}
      <div className="space-y-1">
        {(!collapsed || isMobile) && (
          <div className="flex items-center justify-between px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            <span className="flex items-center gap-1 text-purple-400">
              <Sparkles className="h-3 w-3" />
              AI Tools
            </span>
            <span className="rounded bg-purple-900/40 text-purple-300 px-1.5 py-0.2 text-[9px] border border-purple-500/30">
              Tavily
            </span>
          </div>
        )}

        {AI_TOOLS.map((tool) => {
          const ToolIcon = tool.icon;
          const isActive = activeTab === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => {
                handleTabClick(tool.id);
                if (isMobile) onMobileClose();
              }}
              title={tool.label}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-gradient-to-r from-purple-950/40 to-indigo-950/40 text-white border border-purple-500/40 shadow-sm'
                  : 'text-gray-400 hover:bg-[#141414] hover:text-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ToolIcon
                  className={`h-4 w-4 flex-shrink-0 ${
                    isActive ? 'text-purple-400' : 'text-gray-400'
                  }`}
                />
                {(!collapsed || isMobile) && (
                  <span className="truncate">{tool.label}</span>
                )}
              </div>
              {(!collapsed || isMobile) && tool.badge && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    tool.badge === 'PRO'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-purple-500/20 text-purple-300'
                  }`}
                >
                  {tool.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* External Links */}
      <div className="space-y-1 pt-2 border-t border-[#1A1A1A]">
        <a
          href="https://coach.mastersunion.org"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs text-gray-400 hover:bg-[#141414] hover:text-gray-200"
        >
          <ExternalLink className="h-4 w-4 flex-shrink-0 opacity-70" />
          {(!collapsed || isMobile) && (
            <span className="flex items-center gap-1">
              Coach Portal
              <ExternalLink className="h-2.5 w-2.5 opacity-40" />
            </span>
          )}
        </a>
      </div>
    </div>
  );

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
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav with Dedicated AI Tools */}
      <nav className="flex-1 overflow-y-auto p-2 custom-scrollbar" aria-label="Main navigation">
        {renderNavItems(false)}
      </nav>

      {/* Connected Sources (Moved to bottom, right above user details) */}
      <div className="border-t border-[#1A1A1A] bg-[#0D0D0D]">
        {!collapsed && (
          <button
            onClick={() => setSourcesOpen(!sourcesOpen)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-gray-500" />
              <span>Connected Sources</span>
            </div>
            {sourcesOpen ? (
              <ChevronUp className="h-3 w-3 text-gray-500" />
            ) : (
              <ChevronDown className="h-3 w-3 text-gray-500" />
            )}
          </button>
        )}

        {/* Expandable or compact sources */}
        {(sourcesOpen || collapsed) && (
          <div className="max-h-48 overflow-y-auto px-2 py-2 border-t border-[#181818] custom-scrollbar">
            <ConnectedSources inSidebar collapsed={collapsed} />
          </div>
        )}
      </div>

      {/* User profile + sign out */}
      <div className="border-t border-[#1A1A1A] p-3 space-y-2 bg-[#0A0A0A]">
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
          <div
            className="fixed inset-0 z-30 bg-black/60 md:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-40 flex md:hidden">
            <div className="flex h-full flex-col border-r border-[#222] bg-[#0A0A0A] w-60">
              <div className="flex h-14 items-center justify-between border-b border-[#1A1A1A] px-3">
                <span className="text-sm font-bold tracking-tight text-white">
                  MU <span className="text-[#f7d344]">One</span>
                </span>
                <button
                  onClick={onMobileClose}
                  aria-label="Close sidebar"
                  className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-[#1A1A1A] hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-2 custom-scrollbar" aria-label="Mobile navigation">
                {renderNavItems(true)}
              </nav>

              {/* Connected Sources at bottom */}
              <div className="border-t border-[#1A1A1A] bg-[#0D0D0D]">
                <button
                  onClick={() => setSourcesOpen(!sourcesOpen)}
                  className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-200"
                >
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-gray-500" />
                    <span>Connected Sources</span>
                  </div>
                  {sourcesOpen ? (
                    <ChevronUp className="h-3 w-3 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-gray-500" />
                  )}
                </button>
                {sourcesOpen && (
                  <div className="max-h-48 overflow-y-auto px-2 py-2 border-t border-[#181818] custom-scrollbar">
                    <ConnectedSources inSidebar collapsed={false} />
                  </div>
                )}
              </div>

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
