import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCollapseHeaderOnScroll } from './useCollapseHeaderOnScroll';

const setScrollY = (value: number) => {
  Object.defineProperty(window, 'scrollY', { value, writable: true, configurable: true });
};
const scrollTo = (value: number) => {
  act(() => {
    setScrollY(value);
    window.dispatchEvent(new Event('scroll'));
  });
};

describe('useCollapseHeaderOnScroll', () => {
  let originalScrollY: number;

  beforeEach(() => {
    originalScrollY = window.scrollY;
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    setScrollY(originalScrollY);
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('initializes with isCollapsed false when scrollY is below threshold', () => {
    setScrollY(0);
    const { result } = renderHook(() => useCollapseHeaderOnScroll(80));
    expect(result.current.isCollapsed).toBe(false);
    expect(result.current.isFloatingOpen).toBe(false);
  });

  it('updates isCollapsed to true when scrollY exceeds threshold, and back to false near the top', () => {
    setScrollY(0);
    const { result } = renderHook(() => useCollapseHeaderOnScroll(80));

    scrollTo(100);
    expect(result.current.isCollapsed).toBe(true);

    scrollTo(10);
    expect(result.current.isCollapsed).toBe(false);
  });

  describe('floating panel', () => {
    it('toggleFloating opens the panel WITHOUT scrolling the page', () => {
      setScrollY(400);
      const { result } = renderHook(() => useCollapseHeaderOnScroll(80));
      scrollTo(400);

      act(() => result.current.toggleFloating());

      expect(result.current.isFloatingOpen).toBe(true);
      expect(result.current.isCollapsed).toBe(true);
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it('a second toggleFloating closes it again', () => {
      setScrollY(400);
      const { result } = renderHook(() => useCollapseHeaderOnScroll(80));
      scrollTo(400);

      act(() => result.current.toggleFloating());
      act(() => result.current.toggleFloating());

      expect(result.current.isFloatingOpen).toBe(false);
    });

    it('stays open for a tiny scroll nudge but closes once the user scrolls on', () => {
      setScrollY(400);
      const { result } = renderHook(() => useCollapseHeaderOnScroll(80));
      scrollTo(400);
      act(() => result.current.toggleFloating());

      scrollTo(410);
      expect(result.current.isFloatingOpen).toBe(true);

      scrollTo(480);
      expect(result.current.isFloatingOpen).toBe(false);
      expect(result.current.isCollapsed).toBe(true);
    });

    it('scrolling back to the top closes the panel and un-collapses the header', () => {
      setScrollY(400);
      const { result } = renderHook(() => useCollapseHeaderOnScroll(80));
      scrollTo(400);
      act(() => result.current.toggleFloating());

      scrollTo(0);

      expect(result.current.isFloatingOpen).toBe(false);
      expect(result.current.isCollapsed).toBe(false);
    });

    it('closes on Escape', () => {
      setScrollY(400);
      const { result } = renderHook(() => useCollapseHeaderOnScroll(80));
      scrollTo(400);
      act(() => result.current.toggleFloating());

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });

      expect(result.current.isFloatingOpen).toBe(false);
    });

    it('closes on a press outside the header, but not inside it or inside portaled popover content', () => {
      const header = document.createElement('div');
      const inside = document.createElement('button');
      header.appendChild(inside);
      const popperWrapper = document.createElement('div');
      popperWrapper.setAttribute('data-radix-popper-content-wrapper', '');
      const popperChild = document.createElement('button');
      popperWrapper.appendChild(popperChild);
      const outside = document.createElement('div');
      document.body.append(header, popperWrapper, outside);

      setScrollY(400);
      const { result } = renderHook(() => useCollapseHeaderOnScroll(80, { current: header }));
      scrollTo(400);
      act(() => result.current.toggleFloating());

      act(() => {
        inside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      });
      expect(result.current.isFloatingOpen).toBe(true);

      act(() => {
        popperChild.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      });
      expect(result.current.isFloatingOpen).toBe(true);

      act(() => {
        outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      });
      expect(result.current.isFloatingOpen).toBe(false);
    });
  });

  describe('collapse guard', () => {
    it('defers collapsing right after focus moved into the header (focus-induced scroll)', () => {
      const header = document.createElement('div');
      const input = document.createElement('input');
      header.appendChild(input);
      document.body.appendChild(header);

      setScrollY(0);
      const { result } = renderHook(() => useCollapseHeaderOnScroll(80, { current: header }));

      input.focus();
      scrollTo(300);

      expect(result.current.isCollapsed).toBe(false);
    });

    it('collapses even while an element in the header still holds focus, once the focus grace window has passed (the "won\'t collapse again" bug)', () => {
      vi.useFakeTimers();
      const header = document.createElement('div');
      const trigger = document.createElement('button');
      header.appendChild(trigger);
      document.body.appendChild(header);

      setScrollY(0);
      const { result } = renderHook(() => useCollapseHeaderOnScroll(80, { current: header }));

      trigger.focus();
      vi.advanceTimersByTime(1000);
      scrollTo(300);

      expect(document.activeElement).toBe(trigger);
      expect(result.current.isCollapsed).toBe(true);
    });

    it('defers collapsing while a facet popover in the header is open', () => {
      vi.useFakeTimers();
      const header = document.createElement('div');
      const trigger = document.createElement('button');
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-expanded', 'true');
      header.appendChild(trigger);
      document.body.appendChild(header);

      setScrollY(0);
      const { result } = renderHook(() => useCollapseHeaderOnScroll(80, { current: header }));

      scrollTo(300);
      expect(result.current.isCollapsed).toBe(false);

      trigger.setAttribute('aria-expanded', 'false');
      scrollTo(320);
      expect(result.current.isCollapsed).toBe(true);
    });

    it('re-measures the expanded header so a taller header raises the threshold', () => {
      const header = document.createElement('div');
      let height = 100;
      Object.defineProperty(header, 'offsetHeight', { get: () => height });
      document.body.appendChild(header);

      setScrollY(0);
      const { result } = renderHook(() => useCollapseHeaderOnScroll(80, { current: header }));

      height = 300; // e.g. an AI-summary row appeared after mount
      scrollTo(200);
      expect(result.current.isCollapsed).toBe(false);

      scrollTo(320);
      expect(result.current.isCollapsed).toBe(true);
    });
  });
});
