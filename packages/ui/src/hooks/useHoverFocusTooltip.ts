'use client';

import { useState } from 'react';
import type { FocusEvent, KeyboardEvent, PointerEvent } from 'react';
import type { UseHoverFocusTooltipOptions, UseHoverFocusTooltipResult } from './useHoverFocusTooltip.types';

/**
 * Story 1.3k Task 4 (AC11, Gate 3 resolution) — the shared hover+focus+Escape-dismiss tooltip
 * interaction-state machine, extracted from what were three independent hand-rolled copies of
 * the identical `isHovered`/`isFocused`/`isDismissed` state + pointer/focus/blur/Escape handlers:
 * `CalendarCard` (`WeeklyCalendarView.tsx`), `MultiDaySpanningBar` (same file), and
 * `useNavRailItemInteraction` (this directory). This story's own new repeat-badge tooltip
 * consumers would otherwise have grown that to 4-5 copies, so extraction happens now rather than
 * later.
 *
 * `CalendarCard` and `MultiDaySpanningBar` are refactored onto this hook (behavior-preserving —
 * same visual/interaction outcome). `useNavRailItemInteraction` is deliberately left as its own
 * hand-rolled copy — refactoring it onto this hook is an optional follow-up (backlog IDEA-051),
 * out of this story's scope (see Dev Notes "Architecture & UX Gate Findings", Gate 3).
 *
 * Touch-gating (`pointerType !== 'touch'`) and the "only active in a given mode" gate are both
 * caller-controlled via `enabled`, not hardcoded here, so this hook stays reusable across callers
 * with different mode-gating needs (Task 4 requirement).
 */
export function useHoverFocusTooltip(
  options: UseHoverFocusTooltipOptions = {}
): UseHoverFocusTooltipResult {
  const { enabled = true } = options;

  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const isVisible = enabled && (isHovered || isFocused) && !isDismissed;

  const handlers = {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'touch') {
        setIsDismissed(false);
        setIsHovered(true);
      }
    },
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'touch') {
        setIsHovered(false);
      }
    },
    onFocus: (_event: FocusEvent<HTMLElement>) => {
      setIsDismissed(false);
      setIsFocused(true);
    },
    onBlur: (_event: FocusEvent<HTMLElement>) => {
      setIsFocused(false);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape') {
        setIsDismissed(true);
      }
    },
  };

  return { isVisible, handlers };
}
