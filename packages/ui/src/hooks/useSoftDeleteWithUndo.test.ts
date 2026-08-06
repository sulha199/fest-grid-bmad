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

  it('mark-pending flips isPending and pendingIds, and calls toast with expected message/action and duration', () => {
    const { result } = renderHook(() => useSoftDeleteWithUndo());
    const undoFn = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.markPending('item-1', undoFn);
    });

    expect(result.current.isPending('item-1')).toBe(true);
    expect(result.current.pendingIds.has('item-1')).toBe(true);
    expect(toast).toHaveBeenCalledWith('Item removed', expect.objectContaining({
      duration: 6000,
      action: expect.objectContaining({
        label: 'Undo',
        onClick: expect.any(Function),
      }),
      onAutoClose: expect.any(Function),
    }));
  });

  it('undo flips isPending back to false, calls toast.dismiss, and calls the supplied undo function', async () => {
    (toast as any).mockReturnValue('toast-id-1');
    
    const { result } = renderHook(() => useSoftDeleteWithUndo());
    const undoFn = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.markPending('item-1', undoFn);
    });

    expect(result.current.isPending('item-1')).toBe(true);

    await act(async () => {
      await result.current.undo('item-1');
    });

    expect(result.current.isPending('item-1')).toBe(false);
    expect(result.current.pendingIds.has('item-1')).toBe(false);
    expect((toast as any).dismiss).toHaveBeenCalledWith('toast-id-1');
    expect(undoFn).toHaveBeenCalledTimes(1);
  });

  it('an elapsed window with no Undo calls onExpire exactly once and clears pending state', () => {
    const onExpireMock = vi.fn();
    const { result } = renderHook(() => useSoftDeleteWithUndo({ onExpire: onExpireMock }));
    const undoFn = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.markPending('item-1', undoFn);
    });

    expect(result.current.isPending('item-1')).toBe(true);

    // Get the onAutoClose callback from the toast call options
    const toastCall = (toast as any).mock.calls[0];
    const toastOptions = toastCall[1];
    const onAutoClose = toastOptions.onAutoClose;

    expect(onAutoClose).toBeTypeOf('function');

    act(() => {
      onAutoClose();
    });

    expect(result.current.isPending('item-1')).toBe(false);
    expect(onExpireMock).toHaveBeenCalledWith('item-1');
    expect(onExpireMock).toHaveBeenCalledTimes(1);
  });

  it('multiple concurrent pending items are tracked independently (including independent per-item expiry)', async () => {
    (toast as any).mockReturnValueOnce('toast-id-1')
                 .mockReturnValueOnce('toast-id-2')
                 .mockReturnValueOnce('toast-id-3');
                 
    const onExpireMock = vi.fn();
    const { result } = renderHook(() => useSoftDeleteWithUndo({ onExpire: onExpireMock }));
    const undoFn1 = vi.fn().mockResolvedValue(undefined);
    const undoFn2 = vi.fn().mockResolvedValue(undefined);
    const undoFn3 = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.markPending('item-1', undoFn1);
      result.current.markPending('item-2', undoFn2);
      result.current.markPending('item-3', undoFn3);
    });

    expect(result.current.pendingIds.size).toBe(3);

    // Get the toast call options for item-2
    const toastCall2 = (toast as any).mock.calls[1];
    const onAutoClose2 = toastCall2[1].onAutoClose;

    act(() => {
      onAutoClose2();
    });

    // item-2 expired, 1 and 3 are still pending
    expect(result.current.isPending('item-1')).toBe(true);
    expect(result.current.isPending('item-2')).toBe(false);
    expect(result.current.isPending('item-3')).toBe(true);
    expect(onExpireMock).toHaveBeenCalledWith('item-2');
    expect(onExpireMock).toHaveBeenCalledTimes(1);

    // Undo item-1
    await act(async () => {
      await result.current.undo('item-1');
    });

    expect(result.current.isPending('item-1')).toBe(false);
    expect(result.current.isPending('item-3')).toBe(true);
  });
});
