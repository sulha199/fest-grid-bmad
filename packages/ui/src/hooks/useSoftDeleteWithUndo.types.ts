export type SoftDeleteToastLabels = {
  message?: string;
  undoLabel?: string;
};

export type UseSoftDeleteWithUndoOptions<TId extends string = string> = {
  defaultLabels?: SoftDeleteToastLabels;
  onExpire?: (id: TId) => void;
};

export type UseSoftDeleteWithUndoResult<TId extends string = string> = {
  isPending: (id: TId) => boolean;
  pendingIds: ReadonlySet<TId>;
  markPending: (
    id: TId,
    undo: () => Promise<void>,
    labels?: SoftDeleteToastLabels,
  ) => void;
  undo: (id: TId) => void;
};
