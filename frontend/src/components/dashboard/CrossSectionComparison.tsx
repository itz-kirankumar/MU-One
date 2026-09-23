'use client';

import React, { useEffect, useMemo } from 'react';
import { X, Calendar, Clock, MapPin, Columns } from 'lucide-react';
import type { NormalizedEvent } from '@/types';
import { getCalendarEventDetails } from '@/lib/calendarEventDetails';

export interface CrossSectionComparisonProps {
  sharedEvents: NormalizedEvent[];
  currentSubject: string;
  isOpen: boolean;
  onClose: () => void;
}

const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

function getSectionCode(event: NormalizedEvent): string | null {
  const direct = String(event.sectionCode || (event as Record<string, any>).section || '').trim().toUpperCase();
  if (/^[A-H]$/.test(direct)) return direct;

  const label = String(event.sectionLabel || '').match(/\b(?:section|sec)\s*[-:#]?\s*([A-H]|[1-8])\b/i)?.[1];
  if (label) return /^\d$/.test(label) ? String.fromCharCode(64 + Number(label)) : label.toUpperCase();

  const legacy = Number(event.sectionNumber);
  return legacy >= 1 && legacy <= 8 ? String.fromCharCode(64 + legacy) : null;
}

function matchesSubject(event: NormalizedEvent, targetSubject: string): boolean {
  if (!targetSubject || targetSubject.trim().toLowerCase() === 'all') return true;
  const target = targetSubject.trim().toLowerCase();
  const course = (event.course || '').trim().toLowerCase();
  const subject = (event.subject || '').trim().toLowerCase();
  const detailsCourse = getCalendarEventDetails(event).course.toLowerCase();
  return course === target || subject === target || detailsCourse === target;
}

export function CrossSectionComparison({
  sharedEvents,
  currentSubject,
  isOpen,
  onClose,
}: CrossSectionComparisonProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredEvents = useMemo(() => {
    return sharedEvents.filter(event => matchesSubject(event, currentSubject));
  }, [sharedEvents, currentSubject]);

  const groupedBySection = useMemo(() => {
    const map = new Map<string, NormalizedEvent[]>();
    SECTIONS.forEach(sec => map.set(sec, []));

    filteredEvents.forEach(event => {
      const sec = getSectionCode(event);
      if (sec && map.has(sec)) {
        map.get(sec)!.push(event);
      }
    });

    SECTIONS.forEach(sec => {
      map.get(sec)!.sort((a, b) => (a.startIso || '').localeCompare(b.startIso || ''));
    });

    return map;
  }, [filteredEvents]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const displaySubject = currentSubject && currentSubject !== 'all' ? currentSubject : 'All Subjects';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cross-section-modal-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-[#2a2a2a] bg-[#121212] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#242424] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#f7d344]/10 text-[#f7d344]">
              <Columns className="h-5 w-5" />
            </div>
            <div>
              <h2 id="cross-section-modal-title" className="text-base font-bold text-white sm:text-lg">
                Cross-Section Comparison
              </h2>
              <p className="text-xs text-gray-400">
                Comparing schedule for <span className="font-semibold text-[#f7d344]">{displaySubject}</span> across Sections A–H
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-[#222] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#1e1e1e] text-gray-500 mb-3">
                <Calendar className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-gray-300">
                No sessions found for this subject across sections.
              </p>
              <p className="mt-1 text-xs text-gray-500 max-w-sm">
                There are currently no scheduled timetable sessions for this course across Sections A through H.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SECTIONS.map(section => {
                const sessions = groupedBySection.get(section) ?? [];
                return (
                  <div
                    key={section}
                    className="flex flex-col rounded-xl border border-[#242424] bg-[#171717] p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between border-b border-[#262626] pb-2.5 mb-3">
                      <h3 className="text-sm font-bold tracking-tight text-white">
                        Section {section}
                      </h3>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          sessions.length > 0
                            ? 'bg-[#f7d344]/15 text-[#f7d344] border border-[#f7d344]/30'
                            : 'bg-[#222] text-gray-500'
                        }`}
                      >
                        {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
                      </span>
                    </div>

                    <div className="flex-1 space-y-3">
                      {sessions.length === 0 ? (
                        <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-[#242424] bg-[#111] p-3">
                          <span className="text-xs text-gray-500 italic">No scheduled sessions</span>
                        </div>
                      ) : (
                        sessions.map((session, idx) => {
                          const details = getCalendarEventDetails(session);
                          const mode = session.mode || details.venueLabel;
                          return (
                            <article
                              key={session.id || session.googleEventId || `${session.startIso}-${idx}`}
                              className="rounded-lg border border-[#282828] bg-[#1c1c1c] p-3 text-xs space-y-2 hover:border-[#3a3a3a] transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-semibold text-white leading-tight line-clamp-2">
                                  {details.title}
                                </h4>
                                {mode && (
                                  <span className="shrink-0 rounded bg-[#262626] px-1.5 py-0.5 text-[10px] font-medium text-gray-300 capitalize">
                                    {mode}
                                  </span>
                                )}
                              </div>

                              {details.description && details.description !== 'No description provided.' && (
                                <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                                  {details.description}
                                </p>
                              )}

                              <div className="space-y-1 pt-2 border-t border-[#262626] text-[11px] text-gray-400">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-3 w-3 text-[#d8bd4d] shrink-0" />
                                  <span className="text-gray-300">{details.date}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3 w-3 text-[#d8bd4d] shrink-0" />
                                  <span className="text-white font-medium">{details.time}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="h-3 w-3 text-gray-500 shrink-0" />
                                  <span className="truncate">{details.venue}</span>
                                </div>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[#242424] bg-[#0e0e0e] px-5 py-3 sm:px-6">
          <p className="text-xs text-gray-500">
            Showing timings and venues across institutional section calendars.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#222] px-4 py-2 text-xs font-semibold text-gray-200 hover:bg-[#2c2c2c] hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
