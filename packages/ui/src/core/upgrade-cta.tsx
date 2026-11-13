'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import type { UpgradeCtaProps } from './upgrade-cta.types';

/**
 * A call to action for something that does not exist yet. It is a real, focusable button (never `disabled` or
 * `aria-disabled`): tapping it records interest and swaps the note, nothing is purchased. Full width below `sm:`.
 */
export function UpgradeCta({ label, comingSoonLabel, note, afterClickNote, onShown, onClick, className }: UpgradeCtaProps) {
  const noteId = useId();
  const [clicked, setClicked] = useState(false);
  const shownRef = useRef(false);
  const onShownRef = useRef(onShown);
  onShownRef.current = onShown;

  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    onShownRef.current?.();
  }, []);

  return (
    <div className={cn('flex min-w-0 flex-col items-stretch gap-2 sm:items-start', className)} data-testid="upgrade-cta">
      <Button
        type="button"
        aria-describedby={noteId}
        onClick={() => {
          setClicked(true);
          onClick?.();
        }}
        className="h-auto min-h-11 w-full flex-wrap whitespace-normal sm:w-auto"
      >
        <span className="min-w-0 break-words">{label}</span>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900/30 dark:text-violet-200">
          {comingSoonLabel}
        </span>
      </Button>
      <p id={noteId} aria-live="polite" className="min-w-0 break-words text-xs text-muted-foreground">
        {clicked ? afterClickNote : note}
      </p>
    </div>
  );
}
