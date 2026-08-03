import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSoftDeleteWithUndo } from './useSoftDeleteWithUndo';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    dismiss: vi.fn(),
  }),
}));

describe('useSoftDeleteWithUndo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mark-pending flips isPending and pendingIds, and calls toast with expected message/action', () => {
    const { result } = renderHook(() => useSoftDeleteWithUndo());
    const commitFn = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.markPending('item-1', commitFn);
    });

    expect(result.current.isPending('item-1')).toBe(true);
    expect(result.current.pendingIds.has('item-1')).toBe(true);
    expect(toast).toHaveBeenCalledWith('Item removed', expect.objectContaining({
      action: expect.objectContaining({
        label: 'Undo',
        onClick: expect.any(Function)
      })
    }));
  });

  it('undo flips isPending back to false, calls toast.dismiss, and commit is never called', () => {
    // We need to return a toastId from our mock so dismiss has something to call
    (toast as any).mockReturnValue('toast-id-1');
    
    const { result } = renderHook(() => useSoftDeleteWithUndo());
    const commitFn = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.markPending('item-1', commitFn);
    });

    expect(result.current.isPending('item-1')).toBe(true);

    act(() => {
      result.current.undo('item-1');
    });

    expect(result.current.isPending('item-1')).toBe(false);
    expect(result.current.pendingIds.has('item-1')).toBe(false);
    expect((toast as any).dismiss).toHaveBeenCalledWith('toast-id-1');
    expect(commitFn).not.toHaveBeenCalled();
  });

  it('unmounting the hook calls each pending item commit function exactly once', () => {
    const { result, unmount } = renderHook(() => useSoftDeleteWithUndo());
    const commitFn1 = vi.fn().mockResolvedValue(undefined);
    const commitFn2 = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.markPending('item-1', commitFn1);
      result.current.markPending('item-2', commitFn2);
    });

    unmount();

    expect(commitFn1).toHaveBeenCalledTimes(1);
    expect(commitFn2).toHaveBeenCalledTimes(1);
  });

  it('multiple concurrent pending items are tracked independently (undoing one does not affect others, unmount commits remaining)', () => {
    (toast as any).mockReturnValueOnce('toast-id-1')
                 .mockReturnValueOnce('toast-id-2')
                 .mockReturnValueOnce('toast-id-3');
                 
    const { result, unmount } = renderHook(() => useSoftDeleteWithUndo());
    const commitFn1 = vi.fn().mockResolvedValue(undefined);
    const commitFn2 = vi.fn().mockResolvedValue(undefined);
    const commitFn3 = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.markPending('item-1', commitFn1);
      result.current.markPending('item-2', commitFn2);
      result.current.markPending('item-3', commitFn3);
    });

    expect(result.current.pendingIds.size).toBe(3);

    act(() => {
      result.current.undo('item-2');
    });

    // item-2 is undone, 1 and 3 are still pending
    expect(result.current.isPending('item-1')).toBe(true);
    expect(result.current.isPending('item-2')).toBe(false);
    expect(result.current.isPending('item-3')).toBe(true);

    // Unmount should only commit 1 and 3
    unmount();

    expect(commitFn1).toHaveBeenCalledTimes(1);
    expect(commitFn2).not.toHaveBeenCalled();
    expect(commitFn3).toHaveBeenCalledTimes(1);
  });
});
