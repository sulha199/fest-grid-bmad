'use client';

import React, { useEffect, useId, useState } from 'react';
import { Button } from '../../core/ui/button';

export interface JobRetryButtonProps {
  /** The server's `retryNotBefore`: before this time the button is `aria-disabled` and reads "Retry at {time}". */
  retryNotBefore?: string | null;
  labels: { retry: string; retryAt: (time: string) => string };
  formatTime: (iso: string) => string;
  onRetry: () => void;
  pending?: boolean;
}

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/** Retry. Cooldown: it enables itself at `retryNotBefore` with a timer (no poll). */
export function JobRetryButton({ retryNotBefore, labels, formatTime, onRetry, pending = false }: JobRetryButtonProps) {
  const descId = useId();
  const target = retryNotBefore ? new Date(retryNotBefore).getTime() : NaN;
  const [coolingDown, setCoolingDown] = useState(() => Number.isFinite(target) && target > Date.now());

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setCoolingDown(false);
      return;
    }
    const remaining = target - Date.now();
    if (remaining <= 0) {
      setCoolingDown(false);
      return;
    }
    setCoolingDown(true);
    const id = setTimeout(() => setCoolingDown(false), Math.min(remaining, MAX_TIMEOUT_MS));
    return () => clearTimeout(id);
  }, [target]);

  const label = coolingDown && retryNotBefore ? labels.retryAt(formatTime(retryNotBefore)) : labels.retry;
  const blocked = coolingDown || pending;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full sm:w-auto"
        aria-disabled={blocked || undefined}
        aria-describedby={coolingDown ? descId : undefined}
        onClick={() => {
          if (!blocked) onRetry();
        }}
        data-testid="job-retry"
      >
        {label}
      </Button>
      {coolingDown && (
        <span id={descId} className="sr-only">
          {label}
        </span>
      )}
    </>
  );
}
