"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { UseSoftDeleteWithUndoOptions, UseSoftDeleteWithUndoResult, SoftDeleteToastLabels } from './useSoftDeleteWithUndo.types';

export function useSoftDeleteWithUndo<TId extends string = string>(
  options?: UseSoftDeleteWithUndoOptions,
): UseSoftDeleteWithUndoResult<TId> {
  const [pendingMap, setPendingMap] = useState<Map<TId, () => Promise<void>>>(new Map());
  const pendingMapRef = useRef(pendingMap);
  const activeToastIdsRef = useRef<Map<TId, string | number>>(new Map());

  // Keep ref in sync with state for unmount cleanup
  useEffect(() => {
    pendingMapRef.current = pendingMap;
  }, [pendingMap]);

  const markPending = (id: TId, commit: () => Promise<void>, labels?: SoftDeleteToastLabels) => {
    setPendingMap((prev) => {
      const next = new Map(prev);
      next.set(id, commit);
      return next;
    });

    const message = labels?.message ?? options?.defaultLabels?.message ?? 'Item removed';
    const undoLabel = labels?.undoLabel ?? options?.defaultLabels?.undoLabel ?? 'Undo';

    const toastId = toast(message, {
      action: {
        label: undoLabel,
        onClick: () => undo(id),
      },
    });
    
    activeToastIdsRef.current.set(id, toastId);
  };

  const undo = (id: TId) => {
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
  };

  // Unmount cleanup: iterate the ref's current entries and call each stored commit() exactly once
  useEffect(() => {
    return () => {
      const remainingPending = pendingMapRef.current;
      const commits = Array.from(remainingPending.values());
      remainingPending.clear();

      for (const commit of commits) {
        // We invoke exactly once. We don't await or swallow errors, 
        // allowing rejections to propagate as unhandled.
        commit().catch((err) => {
          // Typically we let the consumer handle the rejection in their commit function
          // but we log it to console here so it's not totally invisible if they don't.
          console.error('Error during soft-delete unmount commit:', err);
        });
      }
    };
  }, []); // Run only on unmount

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
