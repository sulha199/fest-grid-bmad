import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCollapseHeaderOnScroll } from './useCollapseHeaderOnScroll';

// Vitest hoists vi.mock calls, so wrapping the mock return inside a closure
vi.mock('./usePrefersReducedMotion', () => {
  return {
    usePrefersReducedMotion: vi.fn(() => false)
  };
});

describe('useCollapseHeaderOnScroll', () => {
  let originalScrollY: number;

  beforeEach(() => {
    originalScrollY = window.scrollY;
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(window, 'scrollY', { value: originalScrollY, writable: true });
    vi.restoreAllMocks();
  });

  it('initializes with isCollapsed false when scrollY is below threshold', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    const { result } = renderHook(() => useCollapseHeaderOnScroll(80));
    expect(result.current.isCollapsed).toBe(false);
  });

  it('updates isCollapsed to true when scrollY exceeds threshold', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    const { result } = renderHook(() => useCollapseHeaderOnScroll(80));
    
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    
    expect(result.current.isCollapsed).toBe(true);
  });

  it('expand() calls window.scrollTo with top: 0 and smooth behavior', () => {
    const { result } = renderHook(() => useCollapseHeaderOnScroll(80));
    act(() => {
      result.current.expand();
    });
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('expand() calls window.scrollTo with auto behavior when prefersReducedMotion is true', async () => {
    const { usePrefersReducedMotion } = await import('./usePrefersReducedMotion');
    vi.mocked(usePrefersReducedMotion).mockReturnValue(true);

    const { result } = renderHook(() => useCollapseHeaderOnScroll(80));
    act(() => {
      result.current.expand();
    });
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });
});
