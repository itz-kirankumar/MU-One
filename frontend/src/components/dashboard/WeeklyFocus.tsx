'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToFocus, updateFocus } from '@/lib/firestore';
import type { WeeklyFocus as WeeklyFocusType } from '@/types';

export function WeeklyFocus() {
  const { user } = useAuth();
  const [focus, setFocus] = useState<WeeklyFocusType | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToFocus(user.uid, (f) => {
      setFocus(f);
      if (!editing) setEditValue(f?.text ?? '');
    });
    return () => unsub();
  }, [user, editing]);

  async function handleBlur() {
    if (!user) return;
    setSaving(true);
    try {
      await updateFocus(user.uid, editValue.trim());
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function handleFocus() {
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  return (
    <div className="rounded-xl border border-[#222] bg-[#161616] px-5 py-5 flex flex-col gap-3 min-h-[240px] shrink-0 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Your weekly focus
        </p>
        {saving && (
          <span className="text-[10px] text-yellow-500/80 animate-pulse font-medium">Saving...</span>
        )}
      </div>
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="What are you focused on this week? Use this space for your top priorities or quick notes..."
        aria-label="Weekly focus"
        className="flex-1 w-full resize-none rounded bg-transparent text-[13px] text-gray-200 placeholder-gray-600 focus:outline-none focus-visible:ring-0 leading-relaxed custom-scrollbar"
      />
    </div>
  );
}
