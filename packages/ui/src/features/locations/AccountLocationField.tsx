import React from "react";
import { Pencil } from "lucide-react";
import { StatusBadge } from "../../core/status-badge";
import type { AccountLocationFieldProps } from "./AccountLocationField.types";

export function AccountLocationField({
  location,
  isPendingReview = false,
  onEdit,
  labels,
}: AccountLocationFieldProps) {
  if (!location) return null;

  const displayAddress = location.formattedAddress || location.placeName || "";

  return (
    <div className="flex items-center gap-2 flex-wrap text-muted-foreground">
      <span>{displayAddress}</span>
      {isPendingReview && (
        <StatusBadge variant="pendingReview" label={labels.pendingReviewLabel} />
      )}
      <button
        type="button"
        onClick={onEdit}
        className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-accent/50 rounded flex items-center justify-center h-6 w-6 shrink-0"
        aria-label={labels.editLabel}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
