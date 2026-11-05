'use client';

import * as React from 'react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import type { PaginationControlsProps } from './pagination-controls.types';

/**
 * Previous / next controls with a "page N of M" and optional total readout, for a list that pages
 * through a cursor (Architecture Spine AD-18, Story 0.i5c).
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
  return (
    <nav aria-label={labels.navigation} className={cn('flex items-center justify-between gap-3', className)}>
      <Button type="button" variant="outline" onClick={onPrev} disabled={disabled || !hasPrevPage}>
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
      <Button type="button" variant="outline" onClick={onNext} disabled={disabled || !hasNextPage}>
        {labels.next}
      </Button>
    </nav>
  );
}
