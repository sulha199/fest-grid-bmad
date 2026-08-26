import * as React from 'react';

export interface TabbedShellTab {
  key: string;
  label: string;
  Component: React.ComponentType;
  keepMounted?: boolean;
}

export interface TabbedShellProps {
  tabs: TabbedShellTab[];
  activeKey: string;
  onTabChange: (key: string) => void;
  className?: string;
}
