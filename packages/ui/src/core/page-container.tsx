import * as React from 'react';
import { cn } from '../lib/utils';
import { PageContainerProps } from './page-container.types';

/**
 * PageContainer is a shared, presentational wrapper for all card grid and calendar pages.
 * It enforces a full-width viewport style with a breakpoint-paired responsive min-width floor,
 * or handles a contained settings/table/form style when fullWidth is false.
 *
 * Fix (BUG-045, 2026-09-26): the `md`/`lg`/`xl` `fullWidth` min-width floors are capped via CSS
 * `min(Npx,100%)` rather than a bare `min-w-[Npx]`. `PageContainer` renders inside `<main>`, which
 * reserves `md:ps-16 xl:ps-56` for `AppShell`'s fixed nav rail -- at/above each of those breakpoint
 * edges, a bare pixel floor exceeds `<main>`'s real available width (viewport minus that inset) and
 * forces `PageContainer` wider than its parent, producing a page-level horizontal scrollbar.
 * `min(Npx,100%)` resolves `100%` against `PageContainer`'s own containing block (`<main>`'s content
 * box, which already excludes the inset), so the floor still applies whenever there's room for it
 * but never overflows the space actually available.
 *
 * The unprefixed base (`320px`) and `sm:` (`640px`) floors are deliberately left as bare pixel
 * values -- `AppShell`'s nav rail is `hidden md:flex` (never rendered below `md`), so those two
 * floors can never coincide with the sidebar-inset bug, and wrapping them in `min(Npx,100%)` would
 * have silently defeated their real narrow-host/embed defense (Story 0.30 AC7) for any host
 * narrower than 320/640px -- a regression caught in this fix's own review loop.
 */
export function PageContainer({ children, className, fullWidth = true }: PageContainerProps) {
  const baseClassName = fullWidth
    ? "w-full min-w-[320px] sm:min-w-[640px] md:min-w-[min(768px,100%)] lg:min-w-[min(1024px,100%)] xl:min-w-[min(1280px,100%)] p-4 sm:p-8 space-y-8"
    : "w-full max-w-5xl mx-auto lg:min-w-[768px] p-4 sm:p-8 space-y-8";

  return (
    <div className={cn(baseClassName, className)}>
      {children}
    </div>
  );
}

export * from './page-container.types';
