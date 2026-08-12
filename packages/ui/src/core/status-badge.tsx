import React from "react";

export interface StatusBadgeProps {
  variant: "active" | "invalid" | "pending" | "upheld" | "dismissed";
  label: string;
}

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  let classes = "";
  switch (variant) {
    case "active":
    case "dismissed":
      classes = "text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-0.5 rounded font-medium shrink-0";
      break;
    case "invalid":
    case "upheld":
      classes = "text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-2 py-0.5 rounded font-medium shrink-0";
      break;
    case "pending":
      classes = "text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded font-medium shrink-0";
      break;
  }

  return <span className={classes}>{label}</span>;
}
