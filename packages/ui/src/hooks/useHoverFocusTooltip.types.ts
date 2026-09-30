import type { FocusEvent, KeyboardEvent, PointerEvent } from 'react';

export interface UseHoverFocusTooltipOptions {
  /**
   * Whether the tooltip is allowed to become visible at all (Story 1.3k Task 4 — the "only
   * active in a given mode" gate, caller-controlled rather than hardcoded in the hook).
   * `CalendarCard` passes `variant === 'grid'`; `MultiDaySpanningBar` has no such mode split and
   * always passes `true`. Defaults to `true`.
   */
  enabled?: boolean;
}

export interface UseHoverFocusTooltipResult {
  /** Whether the tooltip should currently render — `enabled && (hovered || focused) && !dismissed`. */
  isVisible: boolean;
  handlers: {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
    onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
    onFocus: (event: FocusEvent<HTMLElement>) => void;
    onBlur: (event: FocusEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  };
}
