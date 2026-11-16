'use client';

import { useEffect, useState } from 'react';

/** A `Date.now()` that re-renders every `intervalMs` while `active`, for the "Running for 1 min 20 s" text. */
export function useJobClock(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
