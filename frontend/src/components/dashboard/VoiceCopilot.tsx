'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  X,
  Volume2,
  VolumeX,
  Send,
  Calendar,
  FileText,
  ListTodo,
  Zap,
  Clock,
  Trash2,
  CalendarPlus,
  Mail,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import {
  executeAgentAction,
  AgentActionType,
  parseDateAndDuration,
  findAllFocusSlots,
  FocusSlot,
} from '@/lib/agentTools';
import { toLocalDateIso } from '@/lib/mailUtils';

interface VoiceCopilotProps {
  open: boolean;
  onClose: () => void;
  onPrioritizeRequested?: () => void;
}

export function VoiceCopilot({ open, onClose, onPrioritizeRequested }: VoiceCopilotProps) {
  const { user } = useAuth();
  const { dashboardData } = useDashboard();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [bookingSlotIdx, setBookingSlotIdx] = useState<number | null>(null);
  const [discoveredSlots, setDiscoveredSlots] = useState<{
    dateLabel: string;
    slots: FocusSlot[];
    targetTitle?: string;
  } | null>(null);
  const [recentActions, setRecentActions] = useState<
    Array<{
      id: string;
      type: 'task' | 'note' | 'prioritize' | 'calendar' | 'email';
      text: string;
      time: string;
    }>
  >([]);

  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
          setFeedbackMsg('Listening... Speak your command or note');
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setFeedbackMsg('Microphone access denied. Please enable mic permissions.');
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        setFeedbackMsg('Speech recognition not supported in this browser. You can type commands below.');
      }
    }
  }, []);

  function speakResponse(text: string) {
    if (voiceMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  function toggleListening() {
    if (!recognitionRef.current) {
      setFeedbackMsg('Voice recognition not available. Please type commands.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      if (transcript.trim()) {
        processCommand(transcript.trim());
      }
    } else {
      setTranscript('');
      setFeedbackMsg('Starting microphone...');
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Error starting speech recognition:', err);
      }
    }
  }

  async function handleBlockSpecificSlot(slot: FocusSlot, idx: number) {
    if (bookingSlotIdx !== null) return;
    setBookingSlotIdx(idx);
    const nowTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    try {
      const title = discoveredSlots?.targetTitle || 'Deep Work: Protected Focus';
      const res = await executeAgentAction('auto_block_focus', {
        slot,
        title,
      });
      setFeedbackMsg(res.message);
      speakResponse(res.message);
      setRecentActions((prev) => [
        {
          id: Date.now().toString(),
          type: 'calendar',
          text: `Blocked: ${slot.formattedTime} (${slot.dateLabel})`,
          time: nowTime,
        },
        ...prev,
      ]);
    } catch (err: any) {
      setFeedbackMsg(`Error booking slot: ${err.message}`);
    } finally {
      setBookingSlotIdx(null);
    }
  }

  async function processCommand(commandText: string) {
    if (!commandText.trim() || isExecuting) return;

    setIsExecuting(true);
    const lower = commandText.toLowerCase();
    const nowTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const parsed = parseDateAndDuration(commandText);

    try {
      // 1. Check if user asked to find focus slots or check availability
      const isFindingSlots =
        (lower.includes('find') && (lower.includes('slot') || lower.includes('focus') || lower.includes('availability'))) ||
        lower.includes('free slot') ||
        lower.includes('available slot') ||
        lower.includes('check availability') ||
        lower.includes('show availability') ||
        lower.includes('open slot');

      // Check if user also wanted to block calendar
      const isBlockingCalendar =
        lower.includes('block') ||
        lower.includes('schedule focus') ||
        lower.includes('reserve slot') ||
        lower.includes('deep work');

      // Compound query: Block calendar AND find slots
      // (e.g. "Block calendar 90 minutes tomorrow or find me the focus slots for today")
      if (isBlockingCalendar && isFindingSlots) {
        const blockTargetDate = lower.includes('tomorrow')
          ? new Date(Date.now() + 86400000)
          : parsed.targetDate;

        const res = await executeAgentAction('auto_block_focus', {
          events: dashboardData?.events || [],
          targetDate: blockTargetDate,
          duration: parsed.durationMinutes || 90,
          title: parsed.title,
        });

        const slotsDate = lower.includes('today') ? new Date() : blockTargetDate;
        const slots = findAllFocusSlots(
          dashboardData?.events || [],
          slotsDate,
          parsed.durationMinutes || 90
        );
        const dateLabel = slotsDate.toDateString() === new Date().toDateString() ? 'Today' : 'Tomorrow';
        setDiscoveredSlots({
          dateLabel,
          slots,
          targetTitle: parsed.title,
        });

        const combinedMsg = `${res.message} Also identified ${slots.length} focus window${slots.length === 1 ? '' : 's'} for ${dateLabel}.`;
        setFeedbackMsg(combinedMsg);
        speakResponse(combinedMsg);
        setRecentActions((prev) => [
          {
            id: Date.now().toString(),
            type: 'calendar',
            text: `Blocked calendar (${parsed.durationMinutes}m) & checked ${dateLabel}`,
            time: nowTime,
          },
          ...prev,
        ]);
        setTranscript('');
        setInputText('');
        return;
      }

      // Standalone Find Focus Slots / Check Availability
      if (isFindingSlots) {
        const slots = findAllFocusSlots(
          dashboardData?.events || [],
          parsed.targetDate,
          parsed.durationMinutes
        );
        setDiscoveredSlots({
          dateLabel: parsed.dateLabel,
          slots,
          targetTitle: parsed.title,
        });

        let reply = '';
        if (slots.length > 0) {
          reply = `Found ${slots.length} available focus slot${slots.length === 1 ? '' : 's'} on ${parsed.dateLabel} for ${parsed.durationMinutes} minutes. Tap any slot to block it on Google Calendar.`;
        } else {
          reply = `No open ${parsed.durationMinutes}-minute gaps found on ${parsed.dateLabel} between classes.`;
        }
        setFeedbackMsg(reply);
        speakResponse(reply);
        setTranscript('');
        setInputText('');
        return;
      }

      // Standalone Calendar Focus Block on specified date and duration
      if (isBlockingCalendar) {
        const res = await executeAgentAction('auto_block_focus', {
          events: dashboardData?.events || [],
          targetDate: parsed.targetDate,
          duration: parsed.durationMinutes,
          title: parsed.title,
        });

        setFeedbackMsg(res.message);
        speakResponse(res.message);

        // Also discover any additional remaining slots on that date
        const remainingSlots = findAllFocusSlots(
          dashboardData?.events || [],
          parsed.targetDate,
          parsed.durationMinutes
        );
        if (remainingSlots.length > 0) {
          setDiscoveredSlots({
            dateLabel: parsed.dateLabel,
            slots: remainingSlots,
            targetTitle: parsed.title,
          });
        }

        setRecentActions((prev) => [
          {
            id: Date.now().toString(),
            type: 'calendar',
            text: `Calendar: ${parsed.title} (${parsed.dateLabel})`,
            time: nowTime,
          },
          ...prev,
        ]);
        setTranscript('');
        setInputText('');
        return;
      }

      // 2. Day Prioritization
      if (lower.includes('prioritize') || lower.includes('plan my day') || lower.includes('focus today')) {
        setFeedbackMsg('Prioritizing your schedule and deadlines for today...');
        const reply = 'Prioritizing your schedule. Evaluating calendar sessions and urgent email deadlines.';
        speakResponse(reply);
        onPrioritizeRequested?.();
        setRecentActions((prev) => [
          { id: Date.now().toString(), type: 'prioritize', text: 'Ran Day Prioritizer Agent', time: nowTime },
          ...prev,
        ]);
        setTranscript('');
        setInputText('');
        return;
      }

      // 3. Email Sending / Outreach
      if (lower.startsWith('send email') || lower.includes('email to') || lower.includes('mail to')) {
        const match = commandText.match(/to\s+([^\s@]+@[^\s@]+\.[^\s@]+)\s*(?:with\s+subject\s+([^,]+))?(?:,\s*(.*))?/i);
        const toEmail = match ? match[1] : '';
        const subject = match && match[2] ? match[2].trim() : "Follow-up from Masters' Union";
        const body = match && match[3] ? match[3].trim() : 'Hi, following up on our recent conversation.';

        if (toEmail) {
          const res = await executeAgentAction('send_email', { to: toEmail, subject, body });
          setFeedbackMsg(res.message);
          speakResponse(res.message);
          setRecentActions((prev) => [
            { id: Date.now().toString(), type: 'email', text: `Email to: ${toEmail}`, time: nowTime },
            ...prev,
          ]);
        } else {
          const reply = 'Please specify the recipient email address (e.g., send email to name@domain.com).';
          setFeedbackMsg(reply);
          speakResponse(reply);
        }
        setTranscript('');
        setInputText('');
        return;
      }

      // 4. Create Task
      if (
        lower.startsWith('task') ||
        lower.includes('add task') ||
        lower.includes('remind me') ||
        lower.includes('todo') ||
        lower.includes('submit')
      ) {
        const cleanTitle = commandText
          .replace(/^(please\s+)?(add\s+a?\s*task\s+(to\s+)?|remind\s+me\s+to\s+|create\s+task\s+|todo\s+)/i, '')
          .trim();

        const taskTitle = cleanTitle ? cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1) : commandText;
        const isMustDo = lower.includes('urgent') || lower.includes('must') || lower.includes('today');

        await executeAgentAction(
          'create_task',
          {
            title: taskTitle,
            dueDate: toLocalDateIso(),
            importance: isMustDo ? 'must_do' : 'normal',
          },
          user?.uid
        );

        const reply = `Added task: "${taskTitle}" to your ${isMustDo ? 'must-do' : ''} priorities.`;
        setFeedbackMsg(reply);
        speakResponse(reply);

        setRecentActions((prev) => [
          { id: Date.now().toString(), type: 'task', text: `Task: ${taskTitle}`, time: nowTime },
          ...prev,
        ]);
        setTranscript('');
        setInputText('');
        return;
      }

      // 5. Daily Knowledge Note
      const cleanNote = commandText
        .replace(/^(please\s+)?(note\s+down\s+|take\s+a?\s*note\s+|record\s+(that\s+)?|write\s+down\s+)/i, '')
        .trim();

      const noteText = cleanNote ? cleanNote.charAt(0).toUpperCase() + cleanNote.slice(1) : commandText;
      const reply = `Recorded note: "${noteText.length > 50 ? noteText.slice(0, 50) + '...' : noteText}".`;
      setFeedbackMsg(reply);
      speakResponse(reply);

      setRecentActions((prev) => [
        { id: Date.now().toString(), type: 'note', text: `Note: ${noteText}`, time: nowTime },
        ...prev,
      ]);
      setTranscript('');
      setInputText('');
    } catch (err: any) {
      setFeedbackMsg(`Error: ${err.message || 'Execution failed'}`);
    } finally {
      setIsExecuting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#2E2E2E] bg-[#121212] p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#202020] pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-950/50 border border-purple-500/40 text-purple-400">
              <Mic className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                MU Voice Copilot
                <span className="rounded bg-purple-900/40 text-purple-300 text-[9px] font-bold px-1.5 py-0.2 uppercase border border-purple-500/30">
                  Autonomous Agent
                </span>
              </h2>
              <p className="text-[11px] text-gray-400">Schedules calendar blocks, creates tasks, and logs notes</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (!voiceMuted) window.speechSynthesis?.cancel();
                setVoiceMuted(!voiceMuted);
              }}
              title={voiceMuted ? 'Unmute voice feedback' : 'Mute voice feedback'}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#202020] transition-colors"
            >
              {voiceMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-purple-400" />}
            </button>
            <button
              onClick={() => {
                if (isListening && recognitionRef.current) recognitionRef.current.stop();
                if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
                onClose();
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#202020] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Central Voice Capture Visualizer */}
        <div className="flex flex-col items-center justify-center py-4 space-y-3">
          <button
            onClick={toggleListening}
            className={`relative flex h-20 w-20 items-center justify-center rounded-full transition-all cursor-pointer shadow-xl ${
              isListening
                ? 'bg-red-600 text-white shadow-red-600/40 animate-pulse scale-105'
                : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white hover:scale-105 shadow-purple-600/30'
            }`}
          >
            {isListening ? <MicOff className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8 text-white" />}
            {isListening && <span className="absolute -inset-2 rounded-full border-2 border-red-500/40 animate-ping" />}
          </button>

          <span className="text-xs font-semibold text-gray-300">
            {isListening ? 'Listening live... Click mic to execute' : 'Tap microphone to speak'}
          </span>

          <div className="w-full min-h-14 p-3 rounded-xl bg-[#0A0A0A] border border-[#222] text-xs text-gray-200 text-center flex items-center justify-center italic">
            {transcript || feedbackMsg || '"Block calendar 90 minutes tomorrow" or "Find focus slots for today"...'}
          </div>
        </div>

        {/* Interactive Discovered Focus Slots (if any query found slots) */}
        {discoveredSlots && (
          <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-400" />
                <span className="text-xs font-bold text-white">
                  Available Focus Slots ({discoveredSlots.dateLabel})
                </span>
              </div>
              <span className="text-[10px] text-purple-300 bg-purple-900/40 px-2 py-0.5 rounded-full border border-purple-500/30 font-semibold">
                {discoveredSlots.slots.length} open {discoveredSlots.slots.length === 1 ? 'window' : 'windows'}
              </span>
            </div>

            {discoveredSlots.slots.length === 0 ? (
              <p className="text-xs text-gray-400">No open windows matching this duration on {discoveredSlots.dateLabel}.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                {discoveredSlots.slots.map((slot, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#141414] border border-[#262626] hover:border-purple-500/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{slot.formattedTime}</span>
                        <span className="text-[10px] text-purple-300 font-semibold">({slot.durationMinutes}m)</span>
                      </div>
                      <span className="text-[10px] text-gray-400 block">{slot.label}</span>
                    </div>
                    <button
                      onClick={() => handleBlockSpecificSlot(slot, idx)}
                      disabled={bookingSlotIdx === idx}
                      className="flex items-center gap-1 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-2.5 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer"
                    >
                      <Zap className="h-3 w-3" />
                      <span>{bookingSlotIdx === idx ? 'Booking...' : '⚡ Block on Calendar'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manual Text Fallback */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            processCommand(inputText);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type: Block calendar 90 minutes tomorrow, Find focus slots today..."
            className="flex-1 rounded-xl bg-[#0A0A0A] border border-[#262626] px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isExecuting}
            className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Send className="h-3 w-3" />
            <span>Execute</span>
          </button>
        </form>

        {/* Quick Voice Suggestions */}
        <div className="pt-2 border-t border-[#1C1C1C] space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
            Suggested Autonomous Commands:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              'Block calendar 90 minutes tomorrow',
              'Find me the focus slots for today',
              'Find availability tomorrow',
              'Block 60 mins Friday for prep',
              'Prioritize my day',
              'Add task: Submit Reliance TUP deck by 5 PM',
            ].map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => processCommand(prompt)}
                className="rounded-lg bg-[#181818] hover:bg-[#222] border border-[#282828] px-2.5 py-1 text-[11px] text-gray-400 hover:text-white transition-colors cursor-pointer text-left"
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>

        {/* Executed Action History */}
        {recentActions.length > 0 && (
          <div className="pt-2 border-t border-[#1C1C1C] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
              Autonomous Actions Executed:
            </span>
            <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
              {recentActions.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#141414] border border-[#222] text-xs text-gray-300"
                >
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="truncate">{act.text}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">{act.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
