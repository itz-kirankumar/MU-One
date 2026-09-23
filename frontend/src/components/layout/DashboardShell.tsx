'use client';

import React, { useEffect, useState } from 'react';
import { Sidebar, SidebarTab } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { NewEventModal } from '@/components/dashboard/NewEventModal';
import { ComposeMailModal } from '@/components/dashboard/ComposeMailModal';
import { AiDayPrioritizer } from '@/components/dashboard/AiDayPrioritizer';
import { VoiceCopilot } from '@/components/dashboard/VoiceCopilot';
import { PitchCheckpoint } from '@/components/dashboard/PitchCheckpoint';
import { SurveyHub } from '@/components/surveys/SurveyHub';
import { FounderConnectHub } from '@/components/founder/FounderConnectHub';
import { TestmailLab } from '@/components/dashboard/TestmailLab';
import { EmailCenter } from '@/components/dashboard/EmailCenter';
import { AdminAccessControl } from '@/components/dashboard/AdminAccessControl';
import { DevelopmentNotice } from '@/components/dashboard/DevelopmentNotice';
import { AnnouncementsManager } from '@/components/dashboard/AnnouncementsManager';
import { useAuth } from '@/contexts/AuthContext';

// ─── Main grid sections ───────────────────────────────────────────────────────

// Lazy imports for dashboard panels
import { GreetingPanel } from '@/components/dashboard/GreetingPanel';
import { WeeklyFocus } from '@/components/dashboard/WeeklyFocus';
import { AnnouncementsWidget } from '@/components/dashboard/AnnouncementsWidget';
import { TodayPanel } from '@/components/dashboard/TodayPanel';
import { DeadlinesList } from '@/components/dashboard/DeadlinesList';
import { AgendaList } from '@/components/dashboard/AgendaList';
import { GoogleTasksList } from '@/components/dashboard/GoogleTasksList';
import { ImportantMail } from '@/components/dashboard/ImportantMail';
import { ConnectGoogleBanner } from '@/components/dashboard/ConnectGoogleBanner';
import { useDashboard } from '@/contexts/DashboardContext';
import { AlertTriangle, ExternalLink, Mic, Calendar, LayoutDashboard, Mail, ClipboardList, Users, Eye } from 'lucide-react';

export function DashboardShell({ userPreview = false }: { userPreview?: boolean }) {
  const { user, access } = useAuth();
  const { error, loading, syncStatus } = useDashboard();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [composeMailOpen, setComposeMailOpen] = useState(false);
  const [voiceCopilotOpen, setVoiceCopilotOpen] = useState(false);
  const [focusPlannerOpen, setFocusPlannerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('dashboard');
  const [tabLoading, setTabLoading] = useState(true);
  const canUseEmailQa = access?.isAdmin === true && !userPreview;
  const visibleTab = activeTab === 'email_qa' && !canUseEmailQa ? 'dashboard' : activeTab;
  useEffect(() => {
    const timer = window.setTimeout(() => setTabLoading(false), 650);
    return () => window.clearTimeout(timer);
  }, [activeTab]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('founder_connect')) {
      queueMicrotask(() => setActiveTab('founder'));
    }
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#0A0A0A]">
      {(loading || syncStatus?.syncing || tabLoading) && (
        <div role="progressbar" aria-label="Loading workspace" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px] overflow-hidden bg-[#f7d344]/10">
          <div className="h-full w-2/5 bg-gradient-to-r from-transparent via-[#f7d344] to-[#ffe989] shadow-[0_0_10px_#f7d344] motion-safe:animate-[mu-loading-bar_1.35s_ease-in-out_infinite]" />
        </div>
      )}
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        activeTab={visibleTab}
        userPreview={userPreview}
        onSelectTab={(tab) => {
          if (tab === 'email_qa' && !canUseEmailQa) return;
          setTabLoading(true);
          setActiveTab(tab);
        }}
      />

      {/* Main content column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* TopBar */}
        <TopBar
          userPreview={userPreview}
          onNewEvent={() => setNewEventOpen(true)}
          onComposeMail={() => setComposeMailOpen(true)}
          onMobileMenuOpen={() => setMobileMenuOpen(true)}
          onOpenVoiceCopilot={() => setVoiceCopilotOpen(true)}
        />

        {userPreview && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3b341a] bg-[#211d0d] px-4 py-2 text-xs text-[#e9d789]">
            <span className="flex items-center gap-2"><Eye className="h-3.5 w-3.5" aria-hidden="true" />User dashboard preview — showing your account’s data with admin controls hidden.</span>
            <a href="/dashboard" className="font-semibold text-[#f7d344] hover:underline">Exit preview</a>
          </div>
        )}

        {/* Scrollable dashboard body */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pb-16 md:pb-0"
          id="main-content"
        >
          <div className={`mx-auto px-3 sm:px-4 py-4 sm:py-6 ${
            visibleTab === 'email' ? 'max-w-[1600px] w-full h-full' :
            visibleTab === 'dashboard' ? 'max-w-[1600px] w-full' :
            'max-w-5xl w-full'
          }`}>
            {visibleTab === 'dashboard' ? (
              <div className="flex flex-col xl:flex-row gap-4 sm:gap-6">
                {/* Left Main Content */}
                <div className="flex-1 min-w-0 space-y-4 sm:space-y-6">
                  {error && /not found|NOT_FOUND/i.test(error) && (
                    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-200">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-400 mt-0.5" />
                        <div className="flex-1 text-sm space-y-1">
                          <p className="font-semibold text-white">Firestore Database Needs Activation</p>
                          <p className="text-gray-300">
                            Cloud Firestore has not been provisioned yet for project <code className="bg-[#222] px-1.5 py-0.5 rounded text-yellow-400">mu-one-508502</code>.
                          </p>
                          <a
                            href="https://console.firebase.google.com/u/0/project/mu-one-508502/firestore"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-medium text-yellow-400 hover:text-yellow-300 hover:underline pt-1"
                          >
                            Open Firebase Console to Create Firestore Database
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Any other listener failure must be visible rather than silently
                      rendering as an empty dashboard. */}
                  {error && !/not found|NOT_FOUND/i.test(error) && (
                    <div
                      className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"
                      role="alert"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-400 mt-0.5" />
                        <div className="flex-1 text-sm space-y-1">
                          <p className="font-semibold text-white">
                            Couldn&rsquo;t load your dashboard data
                          </p>
                          <p className="text-gray-300">{error}</p>
                          <p className="text-xs text-gray-500">
                            Any previously loaded information is still shown below.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Google authorization — the dashboard cannot sync without it */}
                  <ConnectGoogleBanner />

                  {/* Row 1: Greeting */}
                  <GreetingPanel />

                  {/* Row 3: Today + Deadlines */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <TodayPanel />
                    <DeadlinesList />
                  </div>

                  {/* Row 4: Agenda (full width) */}
                  <AgendaList />

                  {/* Row 5: Mail */}
                  <ImportantMail onOpenEmailCenter={() => { setTabLoading(true); setActiveTab('email'); }} />
                </div>
                
                {/* Right Sidebar: Weekly Focus + Google Tasks */}
                <div className="w-full xl:w-[350px] 2xl:w-[400px] flex-shrink-0 space-y-4 sm:space-y-6 flex flex-col">
                  <AnnouncementsWidget userPreview={userPreview} />
                  <WeeklyFocus />
                  <GoogleTasksList />
                </div>
              </div>
            ) : visibleTab === 'email' ? (
              <EmailCenter onCompose={() => setComposeMailOpen(true)} />
            ) : visibleTab === 'surveys' ? (
              <SurveyHub key={user?.uid} />
            ) : visibleTab === 'founder' ? (
              <FounderConnectHub key={user?.uid} />
            ) : visibleTab === 'email_qa' ? (
              <TestmailLab />
            ) : visibleTab === 'announcements' ? (
              <AnnouncementsManager />
            ) : visibleTab === 'admin' ? (
              <AdminAccessControl />
            ) : (
              <PitchCheckpoint />
            )}
          </div>
        </main>
      </div>

      {/* Floating Focus Planner Trigger Button */}
      <button
        onClick={() => setFocusPlannerOpen(true)}
        aria-label="Open Focus Planner"
        title="Find open time blocks on your calendar"
        className="fixed bottom-[100px] right-4 sm:bottom-[84px] sm:right-6 z-40 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-[#161616] text-gray-300 shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-[#333] hover:text-white"
      >
        <Calendar className="h-4 w-4" />
      </button>

      {/* Floating Voice Copilot Trigger Button */}
      <button
        onClick={() => setVoiceCopilotOpen(true)}
        aria-label="Open Voice AI Copilot"
        title="Tap to speak tasks, notes, or prioritize"
        className="fixed bottom-[54px] right-4 sm:bottom-6 sm:right-6 z-40 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-purple-400/30"
      >
        <Mic className="h-5 w-5" />
      </button>

      {/* Mobile bottom nav bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-[#1A1A1A] bg-[#0A0A0A]/95 backdrop-blur-sm px-2 py-2 md:hidden"
      >
        {(
          [
            { tab: 'dashboard' as SidebarTab, icon: LayoutDashboard, label: 'Home' },
            { tab: 'email' as SidebarTab, icon: Mail, label: 'Mail' },
            { tab: 'surveys' as SidebarTab, icon: ClipboardList, label: 'Surveys' },
            { tab: 'founder' as SidebarTab, icon: Users, label: 'Founders' },
          ] as Array<{ tab: SidebarTab; icon: React.ComponentType<{ className?: string }>; label: string }>
        ).map(({ tab, icon: Icon, label }) => (
          <button
            key={tab}
            onClick={() => { setTabLoading(true); setActiveTab(tab); }}
            aria-label={label}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
              visibleTab === tab ? 'text-[#f7d344]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[9px] font-medium">{label}</span>
          </button>
        ))}
      </nav>

      {/* Modals */}
      {newEventOpen && <NewEventModal onClose={() => setNewEventOpen(false)} />}
      {composeMailOpen && <ComposeMailModal onClose={() => setComposeMailOpen(false)} />}
      <VoiceCopilot
        open={voiceCopilotOpen}
        onClose={() => setVoiceCopilotOpen(false)}
        onPrioritizeRequested={() => { setTabLoading(true); setActiveTab('dashboard'); }}
      />
      <AiDayPrioritizer open={focusPlannerOpen} onClose={() => setFocusPlannerOpen(false)} />
      <DevelopmentNotice userId={user?.uid} enabled={Boolean(access?.hasAccess && (!access.isAdmin || userPreview))} preview={userPreview} />
    </div>
  );
}
