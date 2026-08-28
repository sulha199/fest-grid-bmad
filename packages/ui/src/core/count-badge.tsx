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
