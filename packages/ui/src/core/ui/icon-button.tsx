import * as React from 'react';

import { cn } from '../../lib/utils';
import { Button, type ButtonProps } from './button';

/**
 * Accessible-by-construction icon buttons (project-context.md "Accessibility", rules 1, 3 and 5). New icon-only
 * controls in the navbar, event list and event detail use these instead of a bare `<button>` around an icon, so the
 * things that were forgotten before cannot be forgotten: the TypeScript props require a spoken `label`, the icon is
 * hidden from assistive technology, the control is a real `type="button"` with the project's 44 px touch target, and a
 * toggle cannot be built without its state.
 */
export interface IconButtonProps extends Omit<ButtonProps, 'aria-label' | 'aria-labelledby' | 'children' | 'size'> {
  /** The spoken name. Required: an icon alone has none. Localized by the caller. */
  label: string;
  /** The icon. It is decorative (`aria-hidden`); the `label` carries the meaning. */
  icon: React.ReactNode;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, icon, className, type = 'button', variant = 'ghost', ...props }, ref) => (
    <Button
      ref={ref}
      type={type}
      variant={variant}
      size="icon"
      aria-label={label}
      className={cn('min-h-11 min-w-11', className)}
      {...props}
    >
      <span aria-hidden="true" className="inline-flex items-center justify-center">
        {icon}
      </span>
    </Button>
  ),
);
IconButton.displayName = 'IconButton';

export interface ToggleIconButtonProps extends Omit<IconButtonProps, 'aria-pressed' | 'onClick'> {
  /** The current state. Required: a toggle without its state is the defect this component exists to prevent. */
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
}

/**
 * An icon button with an on and off state. The name is fixed ("Favorite") and the state is `aria-pressed`, so a screen
 * reader says "Favorite, toggle button, pressed". Do not also change the label with the state (it would be read twice).
 */
export const ToggleIconButton = React.forwardRef<HTMLButtonElement, ToggleIconButtonProps>(
  ({ pressed, onPressedChange, ...props }, ref) => (
    <IconButton ref={ref} aria-pressed={pressed} onClick={() => onPressedChange(!pressed)} {...(props as IconButtonProps)} />
  ),
);
ToggleIconButton.displayName = 'ToggleIconButton';
