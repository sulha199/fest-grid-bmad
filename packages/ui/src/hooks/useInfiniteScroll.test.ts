import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useInfiniteScroll } from './useInfiniteScroll';
import type { UseInfiniteScrollOptions } from './useInfiniteScroll.types';

// Mock IntersectionObserver
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

describe('useInfiniteScroll', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    mockObserverInstance = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const setup = (options: Partial<UseInfiniteScrollOptions> = {}) => {
    const defaultOptions: UseInfiniteScrollOptions = {
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
    };
    return renderHook((opts) => useInfiniteScroll({ ...defaultOptions, ...options, ...opts }), {
      initialProps: {},
    });
  };

  it('triggers fetchNextPage when sentinel intersects', () => {
    const fetchNextPage = vi.fn();
    const { result } = setup({ fetchNextPage });

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    expect(mockObserverInstance?.observe).toHaveBeenCalledWith(element);

    act(() => {
      if (mockObserverInstance) {
        mockObserverInstance.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          mockObserverInstance
        );
      }
    });

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('does not trigger fetchNextPage when isFetchingNextPage is true', () => {
    const fetchNextPage = vi.fn();
    const { result } = setup({ fetchNextPage, isFetchingNextPage: true });

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    act(() => {
      if (mockObserverInstance) {
        mockObserverInstance.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          mockObserverInstance
        );
      }
    });

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('disconnects observer when hasNextPage is false', () => {
    const fetchNextPage = vi.fn();
    const { result, rerender } = setup({ fetchNextPage, hasNextPage: true });

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    const initialObserver = mockObserverInstance;
    expect(initialObserver?.observe).toHaveBeenCalled();

    rerender({ hasNextPage: false });

    expect(initialObserver?.disconnect).toHaveBeenCalled();
    // After rerender with hasNextPage: false, a new observer is NOT created
    // wait, our hook has `!node || !hasNextPage` early return
    expect(mockObserverInstance).toBe(initialObserver); // No new observer instance
  });

  it('cleans up observer on unmount', () => {
    const { result, unmount } = setup();

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    const observer = mockObserverInstance;
    unmount();

    expect(observer?.disconnect).toHaveBeenCalled();
  });

  it('cleans up observer and re-attaches on sentinel ref change', () => {
    const { result } = setup();

    const element1 = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element1);
    });

    const observer1 = mockObserverInstance;
    expect(observer1?.observe).toHaveBeenCalledWith(element1);

    const element2 = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element2);
    });

    expect(observer1?.disconnect).toHaveBeenCalled();
    
    const observer2 = mockObserverInstance;
    expect(observer2).not.toBe(observer1);
    expect(observer2?.observe).toHaveBeenCalledWith(element2);
  });

  it('populates error when fetchNextPage rejects and does not throw', async () => {
    const errorMsg = new Error('Fetch failed');
    const fetchNextPage = vi.fn().mockRejectedValue(errorMsg);
    const { result } = setup({ fetchNextPage });

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    await act(async () => {
      if (mockObserverInstance) {
        mockObserverInstance.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          mockObserverInstance
        );
      }
    });

    expect(result.current.error).toBe(errorMsg);
  });

  it('populates error when fetchNextPage throws synchronously', () => {
    const errorMsg = new Error('Sync error');
    const fetchNextPage = vi.fn().mockImplementation(() => {
      throw errorMsg;
    });
    const { result } = setup({ fetchNextPage });

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    act(() => {
      if (mockObserverInstance) {
        mockObserverInstance.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          mockObserverInstance
        );
      }
    });

    expect(result.current.error).toBe(errorMsg);
  });

  it('clears error on next successful trigger', async () => {
    const errorMsg = new Error('Fetch failed');
    let shouldFail = true;
    const fetchNextPage = vi.fn().mockImplementation(() => {
      if (shouldFail) {
        return Promise.reject(errorMsg);
      }
      return Promise.resolve();
    });

    const { result } = setup({ fetchNextPage });

    const element = document.createElement('div');
    act(() => {
      result.current.sentinelRef(element);
    });

    // First trigger - fails
    await act(async () => {
      if (mockObserverInstance) {
        mockObserverInstance.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          mockObserverInstance
        );
      }
    });

    expect(result.current.error).toBe(errorMsg);

    // Second trigger - succeeds
    shouldFail = false;
    await act(async () => {
      if (mockObserverInstance) {
        mockObserverInstance.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          mockObserverInstance
        );
      }
    });

    expect(result.current.error).toBeNull();
  });
});
