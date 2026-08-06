"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { UseSoftDeleteWithUndoOptions, UseSoftDeleteWithUndoResult, SoftDeleteToastLabels } from './useSoftDeleteWithUndo.types';

export function useSoftDeleteWithUndo<TId extends string = string>(
  options?: UseSoftDeleteWithUndoOptions<TId>,
): UseSoftDeleteWithUndoResult<TId> {
  const [pendingMap, setPendingMap] = useState<Map<TId, () => Promise<void>>>(new Map());
  const pendingMapRef = useRef(pendingMap);
  const activeToastIdsRef = useRef<Map<TId, string | number>>(new Map());
  
  // Use options ref to prevent stale closures when calling callbacks
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Keep ref in sync with state
  useEffect(() => {
    pendingMapRef.current = pendingMap;
  }, [pendingMap]);

  const undo = async (id: TId): Promise<void> => {
    const undoCallback = pendingMapRef.current.get(id);
    if (!undoCallback) return;

    try {
      await undoCallback();
      
      setPendingMap((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

      const toastId = activeToastIdsRef.current.get(id);
      if (toastId !== undefined) {
        toast.dismiss(toastId);
        activeToastIdsRef.current.delete(id);
      }
    } catch (err) {
      console.error('Error during soft-delete undo:', err);
      throw err;
    }
  };

  const handleExpire = (id: TId) => {
    setPendingMap((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      
      // Invoke the consumer-supplied onExpire exactly once
      optionsRef.current?.onExpire?.(id);
      
      return next;
    });
    activeToastIdsRef.current.delete(id);
  };

  const markPending = (id: TId, undoFn: () => Promise<void>, labels?: SoftDeleteToastLabels) => {
    setPendingMap((prev) => {
      const next = new Map(prev);
      next.set(id, undoFn);
      return next;
    });

    const message = labels?.message ?? options?.defaultLabels?.message ?? 'Item removed';
    const undoLabel = labels?.undoLabel ?? options?.defaultLabels?.undoLabel ?? 'Undo';

    const toastId = toast(message, {
      duration: 6000,
      action: {
        label: undoLabel,
        onClick: () => {
          undo(id).catch(() => {
            // Error logged inside undo
          });
        },
      },
      onAutoClose: () => {
        handleExpire(id);
      },
    });
    
    activeToastIdsRef.current.set(id, toastId);
  };

  const isPending = (id: TId) => pendingMap.has(id);
  
  const pendingIds = useMemo(() => {
    return new Set(pendingMap.keys());
  }, [pendingMap]);

  return {
    isPending,
    pendingIds,
    markPending,
    undo,
  };
}
