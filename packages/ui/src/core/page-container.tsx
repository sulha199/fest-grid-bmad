import * as React from 'react';
import { cn } from '../lib/utils';
import { PageContainerProps } from './page-container.types';

/**
 * PageContainer is a shared, presentational wrapper for all card grid and calendar pages.
 * It enforces a full-width viewport style with a breakpoint-paired responsive min-width floor.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        "w-full min-w-[320px] sm:min-w-[640px] md:min-w-[768px] lg:min-w-[1024px] xl:min-w-[1280px] p-4 sm:p-8 space-y-8",
        className
      )}
    >
      {children}
    </div>
  );
}

export * from './page-container.types';
