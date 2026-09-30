export type TemporalFilterValue = 'TODAY' | 'UPCOMING' | null;

export interface TemporalFilterToggleLabels {
  today: string;
  upcoming: string;
  all: string;
  /** Accessible group label for the role="radiogroup" control. */
  groupLabel: string;
}

export interface TemporalFilterToggleProps {
  /** `null` means "All" -- matches the committed value's own null-means-All contract (AC7). */
  value: TemporalFilterValue;
  onChange: (value: TemporalFilterValue) => void;
  labels: TemporalFilterToggleLabels;
  className?: string;
}
