'use client';

import { useEffect, useRef, useState, RefObject } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * @param containerRef - dual purpose. (1) When the currently focused element
 * is inside this container (e.g. the user is typing in a search box or has a
 * filter popover open), scroll-driven collapse is skipped so their
 * in-progress interaction isn't yanked out from under them -- re-evaluated on
 * every scroll event, so collapse resumes normally once focus moves
 * elsewhere. (2) Its rendered height while expanded is measured once on
 * mount and used as the real collapse threshold (floored at `thresholdPx`)
 * so the header only collapses once it has already scrolled mostly out of
 * view, instead of shrinking abruptly while still mostly on screen.
 */
export function useCollapseHeaderOnScroll(thresholdPx = 80, containerRef?: RefObject<HTMLElement | null>) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const measuredHeightRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Measure the container's expanded-state height once, before any
    // collapse has happened (a later measurement while collapsed would only
    // capture the much-shorter collapsed pill's height instead).
    if (measuredHeightRef.current === null && containerRef?.current) {
      measuredHeightRef.current = containerRef.current.offsetHeight;
    }

    const handleScroll = () => {
      const focusIsInsideHeader = !!containerRef?.current?.contains(document.activeElement);
      if (focusIsInsideHeader) return;
      const effectiveThreshold = Math.max(thresholdPx, measuredHeightRef.current ?? 0);
      setIsCollapsed(window.scrollY > effectiveThreshold);
    };

    // Initial check
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [thresholdPx, containerRef]);

  const expand = () => {
    // Respond immediately rather than waiting for the (possibly interrupted
    // or reduced-motion-skipped) scroll to actually cross the threshold.
    setIsCollapsed(false);
    if (typeof window === 'undefined') return;
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  return { isCollapsed, expand };
}
