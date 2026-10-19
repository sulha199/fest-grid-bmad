'use client';

import { useCallback, useEffect, useRef, useState, RefObject } from 'react';

/**
 * A browser scrolls a just-focused field into view (and a mobile soft keyboard resizes the
 * viewport) shortly after `focusin`; those scroll events are not the user scrolling away, so
 * they must not collapse the header they are typing in. Any scroll after this window does.
 */
const FOCUS_SCROLL_GRACE_MS = 500;

/** Scrolling this far from where the floating panel was opened dismisses it. */
const FLOATING_DISMISS_SCROLL_PX = 32;

/** Portaled Radix content (facet popovers, selects, dialogs) lives outside the header's DOM subtree. */
const PORTALED_CONTENT_SELECTOR =
  '[data-radix-popper-content-wrapper], [role="dialog"], [role="listbox"], [role="menu"]';

/**
 * Scroll-driven header collapse with a floating re-expand.
 *
 * - `isCollapsed`: the page is scrolled past the header, so the caller should render only a compact
 *   pill in the sticky bar instead of the full header.
 * - `isFloatingOpen`: the user tapped the pill; the caller renders the full header as an
 *   out-of-flow panel anchored under the sticky bar. Opening it never scrolls the page and never
 *   changes the document height, so the reading position is untouched. It closes on a further
 *   scroll, an outside press, Escape, or a second tap on the pill.
 *
 * @param containerRef - the sticky header element. Its rendered height while expanded is measured
 * (and re-measured on every scroll while expanded, so a taller header -- AI summary row, wrapped
 * chips -- never leaves a stale threshold) and used as the collapse threshold, floored at
 * `thresholdPx`, so the header only collapses once it has already scrolled mostly out of view.
 * Scroll-driven changes are deferred only while a facet popover is open or inside the short
 * focus-scroll grace window above -- a control that merely still holds focus (the last-used
 * popover trigger, an already-submitted search box) no longer blocks collapsing.
 */
export function useCollapseHeaderOnScroll(thresholdPx = 80, containerRef?: RefObject<HTMLElement | null>) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFloatingOpen, setIsFloatingOpen] = useState(false);

  const measuredHeightRef = useRef<number | null>(null);
  const isCollapsedRef = useRef(false);
  const isFloatingOpenRef = useRef(false);
  const floatingOpenedAtScrollYRef = useRef(0);
  const lastFocusInAtRef = useRef(0);

  const applyCollapsed = useCallback((next: boolean) => {
    isCollapsedRef.current = next;
    setIsCollapsed(next);
  }, []);

  const closeFloating = useCallback(() => {
    isFloatingOpenRef.current = false;
    setIsFloatingOpen(false);
  }, []);

  const toggleFloating = useCallback(() => {
    if (isFloatingOpenRef.current) {
      closeFloating();
      return;
    }
    floatingOpenedAtScrollYRef.current = typeof window === 'undefined' ? 0 : window.scrollY;
    isFloatingOpenRef.current = true;
    setIsFloatingOpen(true);
  }, [closeFloating]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const container = containerRef?.current ?? null;

    const handleFocusIn = () => {
      lastFocusInAtRef.current = Date.now();
    };

    const shouldDeferToInteraction = () => {
      if (!container) return false;
      // A facet popover is open: collapsing would unmount its anchor out from under it.
      if (container.querySelector('[aria-haspopup][aria-expanded="true"]')) return true;
      return (
        container.contains(document.activeElement) &&
        Date.now() - lastFocusInAtRef.current < FOCUS_SCROLL_GRACE_MS
      );
    };

    const handleScroll = () => {
      if (!isCollapsedRef.current && container) {
        measuredHeightRef.current = container.offsetHeight;
      }
      if (shouldDeferToInteraction()) return;

      const scrollY = window.scrollY;
      const effectiveThreshold = Math.max(thresholdPx, measuredHeightRef.current ?? 0);
      const pastThreshold = scrollY > effectiveThreshold;

      applyCollapsed(pastThreshold);
      if (!pastThreshold) {
        closeFloating();
      } else if (
        isFloatingOpenRef.current &&
        Math.abs(scrollY - floatingOpenedAtScrollYRef.current) > FLOATING_DISMISS_SCROLL_PX
      ) {
        closeFloating();
      }
    };

    container?.addEventListener('focusin', handleFocusIn);
    // Initial check
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container?.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [thresholdPx, containerRef, applyCollapsed, closeFloating]);

  // Outside press / Escape dismiss the floating panel (listeners exist only while it is open).
  useEffect(() => {
    if (!isFloatingOpen || typeof document === 'undefined') return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (containerRef?.current?.contains(target)) return;
      if (target.closest?.(PORTALED_CONTENT_SELECTOR)) return;
      closeFloating();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) closeFloating();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFloatingOpen, containerRef, closeFloating]);

  return { isCollapsed, isFloatingOpen, toggleFloating, closeFloating };
}
