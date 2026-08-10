import React from "react";

export interface StatusBadgeProps {
  variant: "active" | "invalid";
  label: string;
}

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  const classes =
    variant === "active"
      ? "text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-0.5 rounded font-medium shrink-0"
      : "text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-2 py-0.5 rounded font-medium shrink-0";

  return <span className={classes}>{label}</span>;
}
