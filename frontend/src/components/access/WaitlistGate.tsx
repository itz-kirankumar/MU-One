'use client';

import { useState, useEffect } from 'react';
import { LogOut, Mail, Sparkles, Check, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { joinPlatformWaitlist, getGoogleAuthUrl } from '@/lib/functions';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Logo } from '@/components/ui/Logo';

const CONFIRMATION = "Thank you! You'll get access once the access slots have been opened.";

export function WaitlistGate() {
  const { user, access, refreshAccess, signOut } = useAuth();
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(() => {
    if (typeof window !== 'undefined') {
      const isPreviewJoined = new URLSearchParams(window.location.search).get('preview') === 'waitlist_joined';
      if (isPreviewJoined) return true;
    }
    return access?.waitlistStatus === 'waiting';
  });
  const [error, setError] = useState('');

  const [program, setProgram] = useState('');
  const [otherProgram, setOtherProgram] = useState('');
  const [section, setSection] = useState('');
  const [requestedFeatures, setRequestedFeatures] = useState('');

  const [consent, setConsent] = useState(() => {
    return Boolean((access as unknown as { calendarConsent?: boolean })?.calendarConsent);
  });
  const [updatingConsent, setUpdatingConsent] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if ((access as unknown as { calendarConsent?: boolean })?.calendarConsent !== undefined) {
      setConsent(Boolean((access as unknown as { calendarConsent?: boolean })?.calendarConsent));
    }
  }, [access]);

  const [googleConnected, setGoogleConnected] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('google') === 'connected' || params.get('google_connect') === 'success';
    }
    return false;
  });

  async function handleToggleConsent(e: React.ChangeEvent<HTMLInputElement>) {
    const nextConsent = e.target.checked;
    setConsent(nextConsent);
    setUpdatingConsent(true);
    setError('');
    try {
      const updateConsentFn = httpsCallable<
        { action: 'updateCalendarConsent'; consent: boolean },
        { success: boolean; calendarConsent: boolean }
      >(functions, 'accessPortal');
      await updateConsentFn({ action: 'updateCalendarConsent', consent: nextConsent });
      await refreshAccess();
    } catch (err) {
      setConsent(!nextConsent);
      setError(err instanceof Error ? err.message : 'Failed to update calendar consent.');
    } finally {
      setUpdatingConsent(false);
    }
  }

  async function handleConnectGoogle() {
    if (!consent) return;
    setConnecting(true);
    setError('');
    try {
      const { authUrl } = await getGoogleAuthUrl();
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        throw new Error('No authorization URL returned.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to connect Google Calendar. Please try again.');
      setConnecting(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!program) {
      setError('Please select your program.');
      return;
    }
    if (program === 'Other' && !otherProgram.trim()) {
      setError('Please specify your program.');
      return;
    }
    if (!section) {
      setError('Please select your section.');
      return;
    }
    
    setJoining(true);
    setError('');
    try {
      const finalProgram = program === 'Other' ? otherProgram : program;
      await joinPlatformWaitlist({ program: finalProgram, section, requestedFeatures });
      setJoined(true);
      await refreshAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to join the waitlist. Please try again.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050505] px-5 py-12 text-white">
      {/* Glossy background effects */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-[#f7d344] opacity-[0.03] blur-[100px]" />
      <div className="pointer-events-none absolute left-1/2 bottom-0 -translate-x-1/2 h-[200px] w-[400px] rounded-full bg-[#446af7] opacity-[0.03] blur-[80px]" />

      <section 
        aria-labelledby="waitlist-title" 
        className="relative z-10 w-full max-w-[460px] rounded-[24px] border border-[#222] bg-[#0A0A0A]/80 p-8 shadow-2xl backdrop-blur-xl sm:p-10"
      >
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <Logo className="h-8 w-8 text-[#f7d344]" />
            <span className="text-gray-200">MU One</span>
          </div>
          <span className="rounded-full border border-[#f7d344]/20 bg-[#f7d344]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f7d344]">
            Beta
          </span>
        </div>

        {joined ? (
          <div aria-live="polite" className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-400 border border-green-500/20">
                <Check className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <h1 id="waitlist-title" className="text-2xl font-semibold tracking-tight text-white mb-2">You're on the waitlist</h1>
              <p className="text-[14px] leading-relaxed text-gray-400">{CONFIRMATION}</p>
            </div>

            <div className="rounded-2xl border border-[#222] bg-[#121212] p-5 space-y-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="calendar-consent"
                  checked={consent}
                  onChange={handleToggleConsent}
                  disabled={updatingConsent}
                  className="mt-1 h-4 w-4 rounded border-[#333] bg-[#1a1a1a] text-[#f7d344] focus:ring-white/20 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="calendar-consent" className="text-sm font-medium text-gray-200 cursor-pointer select-none">
                  Allow MU One to sync my academic timetable for Section A–H
                </label>
              </div>

              <p className="text-xs leading-relaxed text-gray-400">
                Your calendar will be sanitized to share only section timetable events. Personal meetings and reminders are never shared, and your account remains on the waitlist.
              </p>

              {googleConnected && (
                <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-950/20 px-3.5 py-2.5 text-xs font-medium text-green-400">
                  <Check className="h-4 w-4 shrink-0 text-green-400" />
                  <span>Google Calendar connected. Section timetable events will sync automatically.</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={!consent || connecting}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-gray-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {connecting ? (
                  <LoadingSpinner size="sm" label="Connecting..." />
                ) : (
                  <>
                    <Calendar className="h-4 w-4 transition-transform group-hover:scale-110" />
                    {googleConnected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 id="waitlist-title" className="text-[28px] font-semibold tracking-tight text-white leading-tight">
              Join the <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f7d344] to-[#fceb9c]">private waitlist</span>
            </h1>
            <p className="mt-4 text-[14px] leading-relaxed text-gray-400">
              Get exclusive early access to MU One and help shape what we build next.
            </p>

            <form onSubmit={handleJoin} className="mt-8 space-y-4">
              <div className="flex w-full items-center gap-3 rounded-xl border border-[#222] bg-[#141414] px-4 py-3 text-sm text-gray-500 transition-colors">
                <Mail className="h-4 w-4 shrink-0 text-gray-500" />
                <span className="truncate">{user?.email}</span>
              </div>
              
              <div className="space-y-3">
                <select 
                  value={program} 
                  onChange={(e) => setProgram(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-[#222] bg-[#141414] px-4 py-3.5 text-sm text-white transition-colors focus:border-[#444] focus:outline-none"
                >
                  <option value="" disabled>Select your program</option>
                  <option value="TBM">TBM</option>
                  <option value="YLC">YLC</option>
                  <option value="HR & OS">HR & OS</option>
                  <option value="SMG">SMG</option>
                  <option value="Other">Other</option>
                </select>

                {program === 'Other' && (
                  <input 
                    type="text"
                    placeholder="Specify your program"
                    value={otherProgram}
                    onChange={(e) => setOtherProgram(e.target.value)}
                    className="w-full rounded-xl border border-[#222] bg-[#141414] px-4 py-3.5 text-sm text-white transition-colors focus:border-[#444] focus:outline-none placeholder:text-gray-600"
                  />
                )}

                <select 
                  value={section} 
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-[#222] bg-[#141414] px-4 py-3.5 text-sm text-white transition-colors focus:border-[#444] focus:outline-none"
                >
                  <option value="" disabled>Select your section</option>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'None'].map(sec => (
                    <option key={sec} value={sec}>Section {sec}</option>
                  ))}
                </select>

                <textarea
                  placeholder="What features would you like us to develop? (Optional)"
                  value={requestedFeatures}
                  onChange={(e) => setRequestedFeatures(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[#222] bg-[#141414] px-4 py-3.5 text-sm text-white transition-colors focus:border-[#444] focus:outline-none placeholder:text-gray-600"
                />
              </div>
              
              <button
                type="submit"
                disabled={joining}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-black transition-all hover:bg-gray-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 mt-4"
              >
                {joining ? (
                  <LoadingSpinner size="sm" label="Joining..." />
                ) : (
                  <>
                    Join Waitlist
                    <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110" />
                  </>
                )}
              </button>
              
              <p className="text-center text-[11px] leading-relaxed text-gray-500 pt-2">
                Note: MU One is an unofficial student-built project.
              </p>
            </form>
          </div>
        )}

        {error && (
          <div className="mt-4 animate-in fade-in slide-in-from-bottom-2">
            <p role="alert" className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400 text-center">
              {error}
            </p>
          </div>
        )}

        <div className="mt-8 flex justify-center border-t border-[#1A1A1A] pt-6">
          <button 
            type="button" 
            onClick={() => void signOut()} 
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-[#1A1A1A] hover:text-gray-300"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
