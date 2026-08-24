import type { ReactNode } from 'react';

/**
 * Props for the PageContainer component.
 */
export interface PageContainerProps {
  /**
   * Content to render inside the container.
   */
  children: ReactNode;
  /**
   * Optional additional class name to merge into the base container classes.
   */
  className?: string;
  /**
   * Optional prop to scale the page to full-width or contain it (e.g. settings pages).
   * @default true
   */
  fullWidth?: boolean;
}
