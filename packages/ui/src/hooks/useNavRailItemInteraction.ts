'use client';

import { FocusEvent, KeyboardEvent, PointerEvent, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import {
  UseNavRailItemInteractionProps,
  UseNavRailItemInteractionResult,
} from './useNavRailItemInteraction.types';

/**
 * A stateful interaction hook for navigation items on responsive tiers (rail/tab/expanded).
 * Manages active route matching, hover/focus tooltip visibility, and touch tap-flash timing.
 */
export function useNavRailItemInteraction({
  variant,
  href,
  currentPath,
  onActivate,
}: UseNavRailItemInteractionProps): UseNavRailItemInteractionResult {
  const prefersReducedMotion = usePrefersReducedMotion();

  // Active route matching: link variant exact match (AC4)
  const isActive = variant === 'link' && href !== undefined && currentPath === href;

  // Tooltip visibility states (AC1)
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  // Touch tap-flash state (AC2)
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  const flashDuration = prefersReducedMotion ? 4000 : 2000;

  const tooltipVisible = (isHovered || isFocused) && !isDismissed;

  const handlers = {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      // Only show tooltip on hover if it's not touch (AC1)
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
    onFocus: (event: FocusEvent<HTMLElement>) => {
      setIsDismissed(false);
      setIsFocused(true);
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      setIsFocused(false);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape') {
        setIsDismissed(true);
      }
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      // Touch tap-flash timing: set flashing for link variant only (AC2, AC8)
      if (event.pointerType === 'touch' && variant === 'link') {
        setIsFlashing(true);
        if (flashTimerRef.current) {
          clearTimeout(flashTimerRef.current);
        }
        flashTimerRef.current = setTimeout(() => {
          setIsFlashing(false);
        }, flashDuration);
      }
    },
    // We can also let the trigger variant activate on normal click
    onClick: () => {
      if (variant === 'trigger') {
        onActivate?.();
      }
    },
  };

  return {
    isActive,
    tooltipVisible,
    isFlashing,
    handlers,
  };
}
