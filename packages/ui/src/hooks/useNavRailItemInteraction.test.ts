import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNavRailItemInteraction } from './useNavRailItemInteraction';

// Mock prefers reduced motion hook to control its return value
const mockPrefersReducedMotion = vi.fn().mockReturnValue(false);
vi.mock('./usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => mockPrefersReducedMotion(),
}));

describe('useNavRailItemInteraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrefersReducedMotion.mockReturnValue(false);
    vi.useRealTimers();
  });

  describe('isActive matching logic (AC4)', () => {
    it('returns true when link variant exact matches href and currentPath', () => {
      const { result } = renderHook(() =>
        useNavRailItemInteraction({
          variant: 'link',
          href: '/feed',
          currentPath: '/feed',
        })
      );
      expect(result.current.isActive).toBe(true);
    });

    it('returns false when link variant path is a prefix but not exact match (especially "/" vs "/feed")', () => {
      const { result } = renderHook(() =>
        useNavRailItemInteraction({
          variant: 'link',
          href: '/',
          currentPath: '/feed',
        })
      );
      expect(result.current.isActive).toBe(false);
    });

    it('returns false for trigger variant even if href matches', () => {
      const { result } = renderHook(() =>
        useNavRailItemInteraction({
          variant: 'trigger',
          href: '/feed',
          currentPath: '/feed',
        })
      );
      expect(result.current.isActive).toBe(false);
    });
  });

  describe('tooltip visibility (AC1)', () => {
    it('shows tooltip on pointerenter (non-touch) and hides on pointerleave', () => {
      const { result } = renderHook(() =>
        useNavRailItemInteraction({ variant: 'link', href: '/feed' })
      );

      expect(result.current.tooltipVisible).toBe(false);

      act(() => {
        result.current.handlers.onPointerEnter({ pointerType: 'mouse' } as any);
      });
      expect(result.current.tooltipVisible).toBe(true);

      act(() => {
        result.current.handlers.onPointerLeave({ pointerType: 'mouse' } as any);
      });
      expect(result.current.tooltipVisible).toBe(false);
    });

    it('does NOT show tooltip on pointerenter with touch pointerType', () => {
      const { result } = renderHook(() =>
        useNavRailItemInteraction({ variant: 'link', href: '/feed' })
      );

      act(() => {
        result.current.handlers.onPointerEnter({ pointerType: 'touch' } as any);
      });
      expect(result.current.tooltipVisible).toBe(false);
    });

    it('shows tooltip on focus and hides on blur', () => {
      const { result } = renderHook(() =>
        useNavRailItemInteraction({ variant: 'link', href: '/feed' })
      );

      expect(result.current.tooltipVisible).toBe(false);

      act(() => {
        result.current.handlers.onFocus({} as any);
      });
      expect(result.current.tooltipVisible).toBe(true);

      act(() => {
        result.current.handlers.onBlur({} as any);
      });
      expect(result.current.tooltipVisible).toBe(false);
    });

    it('dismisses tooltip on Escape and restores it on new hover/focus', () => {
      const { result } = renderHook(() =>
        useNavRailItemInteraction({ variant: 'link', href: '/feed' })
      );

      act(() => {
        result.current.handlers.onFocus({} as any);
      });
      expect(result.current.tooltipVisible).toBe(true);

      act(() => {
        result.current.handlers.onKeyDown({ key: 'Escape' } as any);
      });
      expect(result.current.tooltipVisible).toBe(false);

      // hover again should restore tooltip
      act(() => {
        result.current.handlers.onPointerEnter({ pointerType: 'mouse' } as any);
      });
      expect(result.current.tooltipVisible).toBe(true);
    });
  });

  describe('touch tap-flash timing (AC2, AC7, AC8)', () => {
    it('sets isFlashing to true on touch pointerup for link variant and clears it after 2000ms', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() =>
        useNavRailItemInteraction({ variant: 'link', href: '/feed' })
      );

      expect(result.current.isFlashing).toBe(false);

      act(() => {
        result.current.handlers.onPointerUp({ pointerType: 'touch' } as any);
      });
      expect(result.current.isFlashing).toBe(true);

      // Advance by 1999ms
      act(() => {
        vi.advanceTimersByTime(1999);
      });
      expect(result.current.isFlashing).toBe(true);

      // Complete 2000ms
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current.isFlashing).toBe(false);
    });

    it('extends flash duration to 4000ms when reduced motion is preferred', () => {
      vi.useFakeTimers();
      mockPrefersReducedMotion.mockReturnValue(true);

      const { result } = renderHook(() =>
        useNavRailItemInteraction({ variant: 'link', href: '/feed' })
      );

      act(() => {
        result.current.handlers.onPointerUp({ pointerType: 'touch' } as any);
      });
      expect(result.current.isFlashing).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      // Should still be flashing after 2000ms
      expect(result.current.isFlashing).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2000);
      });
      // Clears after 4000ms
      expect(result.current.isFlashing).toBe(false);
    });

    it('never sets isFlashing on trigger variant pointerup, even with touch', () => {
      vi.useFakeTimers();
      const onActivate = vi.fn();
      const { result } = renderHook(() =>
        useNavRailItemInteraction({ variant: 'trigger', onActivate })
      );

      act(() => {
        result.current.handlers.onPointerUp({ pointerType: 'touch' } as any);
      });
      expect(result.current.isFlashing).toBe(false);
    });
  });

  describe('trigger variant activation (AC8)', () => {
    it('invokes onActivate callback on click', () => {
      const onActivate = vi.fn();
      const { result } = renderHook(() =>
        useNavRailItemInteraction({ variant: 'trigger', onActivate })
      );

      act(() => {
        result.current.handlers.onClick();
      });
      expect(onActivate).toHaveBeenCalledTimes(1);
    });
  });
});
