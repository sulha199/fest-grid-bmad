export interface AccountLocationFieldLabels {
  editLabel?: string;
  pendingReviewLabel?: string;
}

export interface AccountLocationFieldProps {
  location?: {
    formattedAddress?: string | null;
    placeName?: string | null;
  } | null;
  isPendingReview?: boolean;
  onEdit: () => void;
  labels?: AccountLocationFieldLabels;
}
