'use client';

import React, { useState } from 'react';
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  executeAgentAction,
  findAllFocusSlots,
  FocusSlot,
} from '@/lib/agentTools';

export function AiDayPrioritizer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dashboardData } = useDashboard();

  const [calendarBlockedMsg, setCalendarBlockedMsg] = useState('');
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [focusDuration, setFocusDuration] = useState<number>(90);
  const [bookingSlotIdx, setBookingSlotIdx] = useState<number | null>(null);

  if (!open) return null;

  async function handleBlockSpecificSlot(slot: FocusSlot, idx: number) {
    if (bookingSlotIdx !== null) return;
    setBookingSlotIdx(idx);
    setCalendarBlockedMsg('');

    try {
      const res = await executeAgentAction('auto_block_focus', {
        slot,
        title: 'Deep Work Focus Block',
      });
      if (res.success) {
        setCalendarBlockedMsg(res.message);
      } else {
        setCalendarBlockedMsg(res.message || 'Could not block calendar.');
      }
    } catch (err: any) {
      setCalendarBlockedMsg(err.message || 'Failed to schedule calendar block.');
    } finally {
      setBookingSlotIdx(null);
    }
  }

  const targetDate = new Date(Date.now() + selectedDayOffset * 86400000);
  const targetDayLabel =
    selectedDayOffset === 0
      ? 'Today'
      : selectedDayOffset === 1
      ? 'Tomorrow'
      : targetDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  const availableSlots = findAllFocusSlots(
    dashboardData?.events || [],
    targetDate,
    focusDuration
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl flex flex-col rounded-xl border border-[#333] bg-[#161616] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Subtle top glow */}
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        <div className="absolute top-0 inset-x-0 h-32 bg-emerald-500/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1A1A1A]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white tracking-wide">Smart Focus Planner</h3>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Find and protect open time blocks on your calendar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Day & Duration Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Day selector pills */}
              <div className="flex rounded-md bg-[#121212] p-0.5 border border-[#222]">
                {[
                  { label: 'Today', offset: 0 },
                  { label: 'Tomorrow', offset: 1 },
                  { label: 'Day After', offset: 2 },
                ].map((d) => (
                  <button
                    key={d.offset}
                    onClick={() => setSelectedDayOffset(d.offset)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-all duration-200 ${
                      selectedDayOffset === d.offset
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 shadow-sm'
                        : 'text-gray-500 hover:text-gray-300 border border-transparent'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Duration selector pills */}
              <div className="flex rounded-md bg-[#121212] p-0.5 border border-[#222]">
                {[45, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setFocusDuration(mins)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-all duration-200 ${
                      focusDuration === mins
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 shadow-sm'
                        : 'text-gray-500 hover:text-gray-300 border border-transparent'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
            
            {/* Close Button */}
            <button 
              onClick={onClose} 
              className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-[#222] transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative z-10 p-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {calendarBlockedMsg && (
            <div className="rounded-lg bg-emerald-950/20 border border-emerald-900/30 p-3 text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>{calendarBlockedMsg}</span>
            </div>
          )}

          {/* Slots Grid */}
          {availableSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-[#111] rounded-lg border border-[#222] border-dashed">
              <Calendar className="h-8 w-8 text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-300">No focus gaps found</p>
              <p className="text-xs text-gray-500 mt-1">
                Your schedule for {targetDayLabel} doesn't have any {focusDuration}-minute openings.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {availableSlots.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex flex-col justify-between p-3.5 rounded-lg bg-[#111] border border-[#222] hover:border-[#444] hover:bg-[#161616] transition-all duration-200 gap-4 shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-200">{slot.formattedTime}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-sm bg-[#222] text-gray-400 font-medium">
                        {slot.durationMinutes}m
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{slot.label}</span>
                  </div>

                  <button
                    onClick={() => handleBlockSpecificSlot(slot, idx)}
                    disabled={bookingSlotIdx === idx}
                    className="flex items-center justify-center gap-1.5 w-full rounded-md bg-[#222] border border-[#333] disabled:opacity-50 py-1.5 text-xs font-medium text-gray-300 hover:bg-white hover:text-black hover:border-white transition-all duration-200"
                  >
                    {bookingSlotIdx === idx ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <CalendarPlus className="h-3.5 w-3.5" />
                    )}
                    <span>{bookingSlotIdx === idx ? 'Booking...' : 'Block on Calendar'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
