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
}
