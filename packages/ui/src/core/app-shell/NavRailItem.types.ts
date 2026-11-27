import { ReactNode } from 'react';

export type NavRailItemProps =
  | {
      variant: 'link';
      icon: ReactNode;
      label: string;
      className?: string;
      href: string;
      currentPath?: string;
      renderLink: React.ComponentType<{
        href: string;
        className?: string;
        children: ReactNode;
        'aria-label'?: string;
        'aria-current'?: 'page';
      }>;
    }
  | {
      variant: 'trigger';
      icon: ReactNode;
      label: string;
      className?: string;
      /** The spoken name when it must say more than the visible `label` (it must start with it, WCAG 2.5.3). */
      accessibleLabel?: string;
      onActivate: () => void;
      ariaExpanded?: boolean;
      buttonRef?: React.RefObject<HTMLButtonElement | null>;
    };
