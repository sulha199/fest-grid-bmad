'use client';

import * as React from 'react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import type { PaginationControlsProps } from './pagination-controls.types';

const INACTIVE_CLASSES = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-background aria-disabled:hover:text-foreground';

/**
 * Previous / next controls with a "page N of M" and optional total readout, for a list that pages
 * through a cursor (Architecture Spine AD-18, Story 0.i5c).
 *
 * A button that cannot act is `aria-disabled`, never the native `disabled` attribute: a browser moves
 * keyboard focus to <body> when the focused button becomes natively disabled (Chrome does), so pressing
 * Next into the last page, or while the next page loads, would drop a keyboard user's place. An
 * `aria-disabled` button keeps focus, is announced as unavailable, and ignores activation here.
 *
 * Presentational only: it owns no pagination state. The cursor, the history that makes "previous"
 * possible and the reset to page 1 on a filter change all live in `useListPaginationController`;
 * the consumer passes that hook's `hasPrevPage`, `goToPrevPage`, `hasNextPage` and `goToNextPage`
 * straight through. Every label arrives as a string so the primitive stays free of any i18n runtime.
 */
export function PaginationControls({
  hasPrevPage,
  hasNextPage,
  onPrev,
  onNext,
  disabled = false,
  labels,
  className,
}: PaginationControlsProps) {
  const prevInactive = disabled || !hasPrevPage;
  const nextInactive = disabled || !hasNextPage;

  return (
    <nav aria-label={labels.navigation} className={cn('flex items-center justify-between gap-3', className)}>
      <Button
        type="button"
        variant="outline"
        className={INACTIVE_CLASSES}
        aria-disabled={prevInactive}
        onClick={() => {
          if (!prevInactive) onPrev();
        }}
      >
        {labels.previous}
      </Button>
      <p className="text-center text-sm text-muted-foreground" aria-live="polite">
        <span>{labels.pageInfo}</span>
        {labels.total !== undefined && (
          <>
            <span aria-hidden="true"> · </span>
            <span>{labels.total}</span>
          </>
        )}
      </p>
      <Button
        type="button"
        variant="outline"
        className={INACTIVE_CLASSES}
        aria-disabled={nextInactive}
        onClick={() => {
          if (!nextInactive) onNext();
        }}
      >
        {labels.next}
      </Button>
    </nav>
  );
}
