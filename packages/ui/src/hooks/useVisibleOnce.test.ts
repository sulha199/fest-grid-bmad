import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVisibleOnce } from './useVisibleOnce';
import type { UseVisibleOnceOptions } from './useVisibleOnce';

// Mock IntersectionObserver (Story 3.6u) -- same shape as useInfiniteScroll.test.ts's mock.
let mockObserverInstance: MockIntersectionObserver | null = null;

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly scrollMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(public callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    mockObserverInstance = this;
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn();
}

describe('useVisibleOnce (Story 3.6u)', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    mockObserverInstance = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const setup = (options: UseVisibleOnceOptions = {}) => {
    return renderHook((opts) => useVisibleOnce({ ...options, ...opts }), {
      initialProps: {},
    });
  };

  it('starts not visible', () => {
    const { result } = setup();
    expect(result.current.isVisible).toBe(false);
  });

  it('fires once when the sentinel intersects', () => {
    const { result } = setup();

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    expect(mockObserverInstance?.observe).toHaveBeenCalledWith(element);

    act(() => {
      mockObserverInstance?.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        mockObserverInstance as unknown as IntersectionObserver
      );
    });

    expect(result.current.isVisible).toBe(true);
  });

  it('disconnects the observer once it fires', () => {
    const { result } = setup();

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    const observer = mockObserverInstance;
    act(() => {
      observer?.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer as unknown as IntersectionObserver
      );
    });

    expect(observer?.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not re-fire or re-observe on a second intersection event', () => {
    const { result } = setup();

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    const observer = mockObserverInstance;

    act(() => {
      observer?.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer as unknown as IntersectionObserver
      );
    });
    expect(result.current.isVisible).toBe(true);

    // A stale/duplicate intersection callback firing again (e.g. a leftover async
    // microtask) must not flip anything or create a new observer -- the ref callback
    // itself guards on hasFiredRef, and the observer is already disconnected besides.
    act(() => {
      observer?.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer as unknown as IntersectionObserver
      );
    });

    expect(result.current.isVisible).toBe(true);
    expect(observer?.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not flip isVisible when the entry is not intersecting', () => {
    const { result } = setup();

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    act(() => {
      mockObserverInstance?.callback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        mockObserverInstance as unknown as IntersectionObserver
      );
    });

    expect(result.current.isVisible).toBe(false);
    expect(mockObserverInstance?.disconnect).not.toHaveBeenCalled();
  });

  it('does not create a new observer once already fired, even if the sentinel ref changes', () => {
    const { result } = setup();

    const element1 = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element1);
    });

    act(() => {
      mockObserverInstance?.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        mockObserverInstance as unknown as IntersectionObserver
      );
    });

    const firedObserver = mockObserverInstance;
    expect(result.current.isVisible).toBe(true);

    const element2 = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element2);
    });

    // No new IntersectionObserver instance was constructed for the new node, since
    // hasFiredRef already short-circuits the effect.
    expect(mockObserverInstance).toBe(firedObserver);
  });

  it('cleans up the observer on unmount before it ever fires', () => {
    const { result, unmount } = setup();

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    const observer = mockObserverInstance;
    unmount();

    expect(observer?.disconnect).toHaveBeenCalled();
  });

  it('uses the default rootMargin/threshold matching useInfiniteScroll', () => {
    const observerSpy = vi.spyOn(globalThis, 'IntersectionObserver' as any);
    const { result } = setup();

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    expect(observerSpy).toHaveBeenCalledWith(expect.any(Function), {
      rootMargin: '200px',
      threshold: 0,
    });
  });

  it('honors custom rootMargin/threshold options', () => {
    const observerSpy = vi.spyOn(globalThis, 'IntersectionObserver' as any);
    const { result } = setup({ rootMargin: '50px', threshold: 0.5 });

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    expect(observerSpy).toHaveBeenCalledWith(expect.any(Function), {
      rootMargin: '50px',
      threshold: 0.5,
    });
  });
});
