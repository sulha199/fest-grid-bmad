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
      onActivate: () => void;
      ariaExpanded?: boolean;
    };
