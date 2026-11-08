export type PaginationControlsLabels = {
  /** Accessible name of the navigation landmark, e.g. "Pagination". */
  navigation: string;
  previous: string;
  next: string;
  /** Already formatted for the current locale, e.g. "Page 2 of 5" or "Page 2". */
  pageInfo: string;
  /** Already formatted, e.g. "93 total". Omit when the list has no total to show. */
  total?: string;
};

export type PaginationControlsProps = {
  hasPrevPage: boolean;
  hasNextPage: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** True while a page is loading: both buttons are disabled so a click cannot race the fetch. */
  disabled?: boolean;
  labels: PaginationControlsLabels;
  className?: string;
};
