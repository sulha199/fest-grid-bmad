import type { ReactNode } from 'react';

/**
 * Props for the action button inside the PageHeader component.
 */
export interface PageHeaderAction {
  /**
   * The text label for the action button. Will be hidden on mobile (below sm).
   */
  label: string;
  /**
   * An icon element (e.g., from Lucide React) to render inside the button.
   */
  icon: ReactNode;
  /**
   * Click handler function.
   */
  onClick: () => void;
  /**
   * Optional disabled state for the button.
   */
  disabled?: boolean;
}

/**
 * Props for the PageHeader component.
 */
export interface PageHeaderProps {
  /**
   * Standardized page title.
   */
  title: string;
  /**
   * Optional description/subtitle text rendered beneath the title.
   */
  description?: string;
  /**
   * Optional primary action button configuration.
   */
  action?: PageHeaderAction;
}
