'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { PitchDraftStore } from '@/lib/pitchDrafts';

/** A new store is selected during render when uid changes, so another user's draft is never exposed. */
export function usePitchDrafts(uid: string | undefined) {
  const store = useMemo(() => new PitchDraftStore(uid), [uid]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    store.start();
    return store.stop;
  }, [store]);
  return { ...snapshot, updateDraft: store.updateDraft, createDraft: store.createDraft, selectDraft: store.selectDraft };
}
