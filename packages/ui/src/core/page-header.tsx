import * as React from 'react';
import { PageHeaderProps } from './page-header.types';

/**
 * PageHeader is a shared presentational primitive that renders a standardized page header row.
 * It contains the page title, an optional description, and an optional responsive primary action button.
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex justify-between items-center flex-wrap gap-4 w-full">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          {action.icon}
          <span className="hidden sm:inline">{action.label}</span>
        </button>
      )}
    </div>
  );
}

export * from './page-header.types';
