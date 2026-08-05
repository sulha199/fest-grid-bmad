import { FocusEvent, KeyboardEvent, PointerEvent } from 'react';

export interface UseNavRailItemInteractionProps {
  variant: 'link' | 'trigger';
  href?: string;
  currentPath?: string;
  onActivate?: () => void;
}

export interface UseNavRailItemInteractionResult {
  isActive: boolean;
  tooltipVisible: boolean;
  isFlashing: boolean;
  handlers: {
    onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
    onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
    onFocus: (event: FocusEvent<HTMLElement>) => void;
    onBlur: (event: FocusEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onClick: () => void;
  };
}
