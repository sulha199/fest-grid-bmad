export interface AccountLocationFieldLabels {
  editLabel: string;
  pendingReviewLabel: string;
  clearLabel?: string;
}

export interface AccountLocationFieldProps {
  location?: {
    formattedAddress?: string | null;
    placeName?: string | null;
  } | null;
  isPendingReview?: boolean;
  onEdit: () => void;
  onClear?: () => void;
  labels: AccountLocationFieldLabels;
}
