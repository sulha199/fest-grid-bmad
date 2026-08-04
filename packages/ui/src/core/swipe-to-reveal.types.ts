import type { ReactNode } from 'react';

/**
 * Props for the SwipeToReveal component.
 */
export interface SwipeToRevealProps {
  /**
   * The primary content of the list item that will be shifted horizontally during the swipe.
   */
  children: ReactNode;

  /**
   * The visual content of the action (e.g., an icon or text) to reveal.
   * This is rendered inside the primitive's own `<button>` element.
   * The consumer is responsible for ensuring this content has an accessible name if it's icon-only.
   */
  action: ReactNode;

  /**
   * Callback invoked exactly once when the revealed action is clicked or activated via keyboard.
   * Note: The primitive does not reset the reveal state automatically after calling this.
   */
  onAction: () => void;

  /**
   * The horizontal drag distance in pixels past which a release commits to the revealed state instead of snapping back.
   * Defaults to 50% of the action slot's measured rendered width.
   */
  revealThreshold?: number;

  /**
   * If true, suppresses both the swipe gesture and interaction with the action control.
   * The action control remains in the DOM but is inert (receives `tabIndex={-1}` and `aria-disabled="true"`).
   */
  disabled?: boolean;

  /**
   * Optional CSS class to apply to the outer container.
   */
  className?: string;
}
