import type { ReactNode } from 'react';

/**
 * Props for the BlockingLoader component.
 */
export interface BlockingLoaderProps {
  /**
   * If true, renders the full-screen blocking overlay.
   */
  active: boolean;
  /**
   * Optional localized status text/node resolved by the caller.
   */
  label?: ReactNode;
  /**
   * Optional override for accessible names and ARIA fallback text.
   */
  labels?: {
    /**
     * Screen reader announcement text when visual label is not provided.
     * Defaults to "Loading".
     */
    busyLabel?: string;
  };
}
