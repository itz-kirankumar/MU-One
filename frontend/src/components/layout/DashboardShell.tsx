'use client';

import React, { useState } from 'react';
import { Sidebar, SidebarTab } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { NewEventModal } from '@/components/dashboard/NewEventModal';
import { ComposeMailModal } from '@/components/dashboard/ComposeMailModal';
import { AiDayPrioritizer } from '@/components/dashboard/AiDayPrioritizer';
import { VoiceCopilot } from '@/components/dashboard/VoiceCopilot';
import { PitchCheckpoint } from '@/components/dashboard/PitchCheckpoint';
import { SurveyHub } from '@/components/surveys/SurveyHub';
import { TestmailLab } from '@/components/dashboard/TestmailLab';
import { EmailCenter } from '@/components/dashboard/EmailCenter';
import { AdminAccessControl } from '@/components/dashboard/AdminAccessControl';
import { useAuth } from '@/contexts/AuthContext';

// ─── Main grid sections ───────────────────────────────────────────────────────

// Lazy imports for dashboard panels
import { GreetingPanel } from '@/components/dashboard/GreetingPanel';
import { WeeklyFocus } from '@/components/dashboard/WeeklyFocus';
import { SourceMetrics } from '@/components/dashboard/SourceMetrics';
import { TodayPanel } from '@/components/dashboard/TodayPanel';
import { DeadlinesList } from '@/components/dashboard/DeadlinesList';
import { AgendaList } from '@/components/dashboard/AgendaList';
import { PersonalTasks } from '@/components/dashboard/PersonalTasks';
import { GoogleTasksList } from '@/components/dashboard/GoogleTasksList';
import { ImportantMail } from '@/components/dashboard/ImportantMail';
import { ConnectGoogleBanner } from '@/components/dashboard/ConnectGoogleBanner';
import { useDashboard } from '@/contexts/DashboardContext';
import { AlertTriangle, ExternalLink, Mic } from 'lucide-react';

export function DashboardShell() {
  const { user } = useAuth();
  const { error } = useDashboard();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [composeMailOpen, setComposeMailOpen] = useState(false);
  const [voiceCopilotOpen, setVoiceCopilotOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('dashboard');

  return (
    <div className="flex h-screen overflow-hidden bg-[#0A0A0A]">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
      />

      {/* Main content column */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* TopBar */}
        <TopBar
          onNewEvent={() => setNewEventOpen(true)}
          onComposeMail={() => setComposeMailOpen(true)}
          onMobileMenuOpen={() => setMobileMenuOpen(true)}
          onOpenVoiceCopilot={() => setVoiceCopilotOpen(true)}
        />

        {/* Scrollable dashboard body */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar"
          id="main-content"
        >
          <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
            {activeTab === 'dashboard' ? (
              <>
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

                {/* AI Day Prioritizer Agent */}
                <AiDayPrioritizer />

                {/* Row 1: Greeting + Focus */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <GreetingPanel />
                  </div>
                  <div>
                    <WeeklyFocus />
                  </div>
                </div>

                {/* Row 2: Metrics */}
                <SourceMetrics />

                {/* Row 3: Today + Deadlines */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <TodayPanel />
                  <DeadlinesList />
                </div>

                {/* Row 4: Agenda (full width) */}
                <AgendaList />

                {/* Row 5: Personal Tasks + Google Tasks */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <PersonalTasks />
                  <GoogleTasksList />
                </div>

                {/* Row 6: Mail */}
                <ImportantMail />
              </>
            ) : activeTab === 'email' ? (
              <EmailCenter onCompose={() => setComposeMailOpen(true)} />
            ) : activeTab === 'surveys' ? (
              <SurveyHub key={user?.uid} />
            ) : activeTab === 'email_qa' ? (
              <TestmailLab />
            ) : activeTab === 'admin' ? (
              <AdminAccessControl />
            ) : (
              <PitchCheckpoint />
            )}
          </div>
        </main>
      </div>

      {/* Floating Voice Copilot Trigger Button */}
      <button
        onClick={() => setVoiceCopilotOpen(true)}
        aria-label="Open Voice AI Copilot"
        title="Tap to speak tasks, notes, or prioritize"
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-purple-400/30"
      >
        <Mic className="h-5 w-5" />
      </button>

      {/* Modals */}
      {newEventOpen && <NewEventModal onClose={() => setNewEventOpen(false)} />}
      {composeMailOpen && <ComposeMailModal onClose={() => setComposeMailOpen(false)} />}
      <VoiceCopilot
        open={voiceCopilotOpen}
        onClose={() => setVoiceCopilotOpen(false)}
        onPrioritizeRequested={() => setActiveTab('dashboard')}
      />
    </div>
  );
}
