import React from "react";

export interface StatusBadgeProps {
  variant: "active" | "invalid" | "pending" | "upheld" | "dismissed" | "pendingReview" | "accepted" | "reverted" | "expired" | "superseded" | "removedByModeration" | "hiddenByMe" | "lowConfidence" | "classificationFailed" | "queued" | "extracting" | "promoted" | "notEvent";
  label: string;
}

export function StatusBadge({ variant, label }: StatusBadgeProps) {
  let classes = "";
  switch (variant) {
    case "active":
    case "dismissed":
    case "accepted":
      classes = "text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-0.5 rounded font-medium shrink-0";
      break;
    case "invalid":
    case "upheld":
    case "reverted":
    case "removedByModeration":
    case "classificationFailed":
      classes = "text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-2 py-0.5 rounded font-medium shrink-0";
      break;
    case "pending":
    case "pendingReview":
    case "hiddenByMe":
    case "lowConfidence":
      classes = "text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded font-medium shrink-0";
      break;
    case "expired":
    case "superseded":
    case "notEvent":
      classes = "text-xs bg-slate-100 dark:bg-slate-900/30 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded font-medium shrink-0";
      break;
    case "queued":
      classes = "text-xs bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200 px-2 py-0.5 rounded font-medium shrink-0";
      break;
    case "extracting":
      classes = "text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-200 px-2 py-0.5 rounded font-medium shrink-0";
      break;
    case "promoted":
      classes = "text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-2 py-0.5 rounded font-medium shrink-0";
      break;
  }

  return <span className={classes}>{label}</span>;
}
