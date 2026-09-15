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
    <div className="h-full rounded-xl border border-[#222] border-l-2 border-l-[#f7d344] bg-[#161616] px-5 py-4 flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Your weekly focus
      </p>
      <textarea
        ref={textareaRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="What are you focused on this week?"
        rows={3}
        aria-label="Weekly focus"
        className="flex-1 resize-none rounded bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#f7d344]"
      />
      {saving && (
        <span className="text-[10px] text-gray-600">Saving…</span>
      )}
    </div>
  );
}
