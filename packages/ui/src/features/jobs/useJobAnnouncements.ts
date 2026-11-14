'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ObservedJobAnnouncement {
  id: string;
  /** `getJobSignature(job)`: changes with the status and, while running, the current step; NOT with the queue position. */
  signature: string;
  /** The message for the current state, resolved by the host. */
  text: string;
  /** A failure in a dialog the user is watching: `role="alert"`. */
  urgent?: boolean;
}

export interface JobAnnouncerMessage {
  text: string;
  role: 'status' | 'alert';
  /** Bumps on every message so an identical text is announced again. */
  seq: number;
}

export interface UseJobAnnouncementsOptions {
  /** Messages within this window collapse into one "{n} jobs updated". Default 3000. */
  coalesceMs?: number;
  listUpdated: (count: number) => string;
  /** Overridable for tests. */
  isHidden?: () => boolean;
}

export interface UseJobAnnouncementsResult {
  message: JobAnnouncerMessage | null;
  /**
   * Feed the jobs of one poll result. Announces a job only when its signature changed since the last call
   * (never on an unchanged poll). A first sighting is announced only with `announceFirst` (the user's own start).
   */
  observe: (jobs: ReadonlyArray<ObservedJobAnnouncement>, options?: { announceFirst?: boolean }) => void;
  /** An explicit message (minimized, started again, reconnecting). */
  announce: (text: string, options?: { urgent?: boolean }) => void;
  /** Forget what was seen (a page change): the next sighting of a job is recorded silently, so a return to a page never announces a change the user did not watch. */
  resetSeen: () => void;
}

const defaultIsHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

export function useJobAnnouncements({ coalesceMs = 3000, listUpdated, isHidden = defaultIsHidden }: UseJobAnnouncementsOptions): UseJobAnnouncementsResult {
  const [message, setMessage] = useState<JobAnnouncerMessage | null>(null);
  const seen = useRef(new Map<string, string>());
  const pending = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowOpen = useRef(false);
  const seq = useRef(0);
  const listUpdatedRef = useRef(listUpdated);
  listUpdatedRef.current = listUpdated;

  const emit = useCallback((text: string, role: 'status' | 'alert') => {
    seq.current += 1;
    setMessage({ text, role, seq: seq.current });
  }, []);

  const closeWindow = useCallback(() => {
    timer.current = null;
    const buffered = pending.current;
    pending.current = [];
    if (buffered.length === 0) {
      windowOpen.current = false;
      return;
    }
    if (isHidden()) {
      windowOpen.current = false;
      return;
    }
    emit(buffered.length === 1 ? buffered[0] : listUpdatedRef.current(buffered.length), 'status');
    // The window stays open for another period after a flush so a steady stream stays coalesced.
    timer.current = setTimeout(closeWindow, coalesceMs);
  }, [coalesceMs, emit, isHidden]);

  const push = useCallback(
    (texts: string[]) => {
      if (texts.length === 0 || isHidden()) return;
      if (!windowOpen.current) {
        windowOpen.current = true;
        emit(texts.length === 1 ? texts[0] : listUpdatedRef.current(texts.length), 'status');
        timer.current = setTimeout(closeWindow, coalesceMs);
      } else {
        pending.current.push(...texts);
      }
    },
    [closeWindow, coalesceMs, emit, isHidden]
  );

  const observe = useCallback<UseJobAnnouncementsResult['observe']>(
    (jobs, options) => {
      const changed: string[] = [];
      for (const job of jobs) {
        const previous = seen.current.get(job.id);
        seen.current.set(job.id, job.signature);
        const isFirst = previous === undefined;
        if (isFirst ? !options?.announceFirst : previous === job.signature) continue;
        if (job.urgent && !isHidden()) {
          emit(job.text, 'alert');
          continue;
        }
        changed.push(job.text);
      }
      push(changed);
    },
    [emit, isHidden, push]
  );

  const announce = useCallback<UseJobAnnouncementsResult['announce']>(
    (text, options) => {
      if (isHidden()) return;
      if (options?.urgent) emit(text, 'alert');
      else emit(text, 'status');
    },
    [emit, isHidden]
  );

  const resetSeen = useCallback(() => {
    seen.current.clear();
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { message, observe, announce, resetSeen };
}
