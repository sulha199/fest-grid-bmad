export interface AccountLocationFieldLabels {
  editLabel: string;
  pendingReviewLabel: string;
  clearLabel?: string;
}

interface AccountLocationFieldBaseProps {
  location?: {
    formattedAddress?: string | null;
    placeName?: string | null;
  } | null;
  isPendingReview?: boolean;
  onEdit: () => void;
}

/**
 * `onClear` and `labels.clearLabel` are a dependent pair: the clear control is an icon-only
 * button, so providing a handler without an accessible name is a type error.
 */
export type AccountLocationFieldProps = AccountLocationFieldBaseProps &
  (
    | { onClear?: undefined; labels: AccountLocationFieldLabels }
    | { onClear: () => void; labels: AccountLocationFieldLabels & { clearLabel: string } }
  );
