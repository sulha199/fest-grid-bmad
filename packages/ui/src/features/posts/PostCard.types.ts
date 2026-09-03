import { Post } from '@festgrid/shared-types';

export interface PostCardLabels {
  imageFallbackAlt?: string;
  loading?: string;
  contentPlaceholder?: string;
}

export interface PostCardPublisher {
  displayName: string;
  platform: string;
  profileImageUrl?: string | null;
}

export interface PostCardProps {
  /** The post object */
  post: Post;

  /** Publisher profile metadata (optional) */
  publisher?: PostCardPublisher;

  /** Is the card selected */
  isSelected?: boolean;

  /** Callback when selection state changes */
  onSelectionChange?: (selected: boolean) => void;

  /** Is the card disabled */
  disabled?: boolean;

  /** Is the card in a loading skeleton state */
  loading?: boolean;

  /** Optional explicit locale for date formatting */
  locale?: string;

  /** Optional explicit timezone for date formatting */
  timezone?: string;

  /** Optional localized labels */
  labels?: PostCardLabels;
}

export interface PostCardSkeletonProps {
  /** Localized loading label */
  loadingLabel?: string;
  className?: string;
}
