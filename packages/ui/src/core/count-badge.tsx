/** @jsxImportSource react */
// The pragma above is a no-op for this package's own build (tsconfig already defaults JSX to
// React's automatic runtime) -- it exists only so a *different* package's test tooling
// (packages/visual-audit's Review Follow-up item 1 react-component RenderSpec, which mounts this
// component through Playwright's test transform) doesn't have this file's JSX default to
// Playwright's own internal `playwright/jsx-runtime` (used for its reporter/attachment UI, an
// unrelated coincidental reuse of the `jsx`/`jsxs` function names) instead of React's. Confirmed
// via direct repro: without this pragma, `React.createElement`d/JSX-compiled elements from this
// file come back as Playwright-tagged `{__pw_type: 'jsx', ...}` objects that `react-dom/server`
// rejects ("Objects are not valid as a React child").
import React from "react";

export interface CountBadgeProps {
  count: number;
  /** Caps the displayed number, showing "{max}+" beyond it. Default 9. */
  max?: number;
  className?: string;
}

/**
 * A small numeric bubble (e.g. the Moderator Pending-Item Badge, PRD Section
 * 3.9.3). Renders nothing when count <= 0 -- callers don't need their own
 * conditional. Purely presentational; positioning (inline vs. absolutely
 * overlaid on an avatar) is the caller's responsibility via `className`.
 */
export function CountBadge({ count, max = 9, className = "" }: CountBadgeProps) {
  if (count <= 0) return null;

  const display = count > max ? `${max}+` : String(count);

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold leading-none ${className}`}
    >
      {display}
    </span>
  );
}
