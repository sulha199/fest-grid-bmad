import type { ReactNode } from 'react';

export type ConfirmActionDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  /** Optional body between the description and the buttons (a checklist, a field). The consumer owns its state. */
  children?: ReactNode;
  className?: string;
};
