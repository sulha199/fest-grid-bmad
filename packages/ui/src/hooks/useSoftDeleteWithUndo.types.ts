export type SoftDeleteToastLabels = {
  message?: string;
  undoLabel?: string;
};

export type UseSoftDeleteWithUndoOptions = {
  defaultLabels?: SoftDeleteToastLabels;
};

export type UseSoftDeleteWithUndoResult<TId extends string = string> = {
  isPending: (id: TId) => boolean;
  pendingIds: ReadonlySet<TId>;
  markPending: (
    id: TId,
    commit: () => Promise<void>,
    labels?: SoftDeleteToastLabels,
  ) => void;
  undo: (id: TId) => void;
};
