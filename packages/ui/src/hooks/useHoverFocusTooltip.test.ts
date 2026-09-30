import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHoverFocusTooltip } from './useHoverFocusTooltip';

function pointerEvent(pointerType: 'mouse' | 'touch') {
  return { pointerType } as any;
}

describe('useHoverFocusTooltip (Story 1.3k Task 4, AC11)', () => {
  it('is not visible by default', () => {
    const { result } = renderHook(() => useHoverFocusTooltip());
    expect(result.current.isVisible).toBe(false);
  });

  it('becomes visible on non-touch pointer enter and hides on pointer leave', () => {
    const { result } = renderHook(() => useHoverFocusTooltip());
    act(() => result.current.handlers.onPointerEnter(pointerEvent('mouse')));
    expect(result.current.isVisible).toBe(true);
    act(() => result.current.handlers.onPointerLeave(pointerEvent('mouse')));
    expect(result.current.isVisible).toBe(false);
  });

  it('ignores touch pointer events (does not show tooltip on touch)', () => {
    const { result } = renderHook(() => useHoverFocusTooltip());
    act(() => result.current.handlers.onPointerEnter(pointerEvent('touch')));
    expect(result.current.isVisible).toBe(false);
  });

  it('becomes visible on focus and hides on blur', () => {
    const { result } = renderHook(() => useHoverFocusTooltip());
    act(() => result.current.handlers.onFocus({} as any));
    expect(result.current.isVisible).toBe(true);
    act(() => result.current.handlers.onBlur({} as any));
    expect(result.current.isVisible).toBe(false);
  });

  it('Escape dismisses the tooltip while still hovered/focused', () => {
    const { result } = renderHook(() => useHoverFocusTooltip());
    act(() => result.current.handlers.onPointerEnter(pointerEvent('mouse')));
    expect(result.current.isVisible).toBe(true);
    act(() => result.current.handlers.onKeyDown({ key: 'Escape' } as any));
    expect(result.current.isVisible).toBe(false);
  });

  it('re-entering hover after a dismiss clears the dismissed flag', () => {
    const { result } = renderHook(() => useHoverFocusTooltip());
    act(() => result.current.handlers.onPointerEnter(pointerEvent('mouse')));
    act(() => result.current.handlers.onKeyDown({ key: 'Escape' } as any));
    expect(result.current.isVisible).toBe(false);
    act(() => result.current.handlers.onPointerLeave(pointerEvent('mouse')));
    act(() => result.current.handlers.onPointerEnter(pointerEvent('mouse')));
    expect(result.current.isVisible).toBe(true);
  });

  it('never becomes visible when enabled is false, even while hovered', () => {
    const { result } = renderHook(() => useHoverFocusTooltip({ enabled: false }));
    act(() => result.current.handlers.onPointerEnter(pointerEvent('mouse')));
    expect(result.current.isVisible).toBe(false);
  });
});
