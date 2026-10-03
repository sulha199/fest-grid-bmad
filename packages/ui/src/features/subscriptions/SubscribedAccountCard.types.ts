export interface SubscribedAccountCardProps {
  account: {
    accountId: string;
    platform?: string | null;
    displayName?: string | null;
    username?: string | null;
    profileImageUrl?: string | null;
  };
  accountHref?: string | null;
  isSubscribed: boolean;
  onSubscribe?: () => void;
  onUnsubscribe?: () => void;
  isStatusLoading?: boolean;
  isTogglePending?: boolean;
  labels?: {
    subscribeLabel?: string;
    unsubscribeLabel?: string;
    checkingSubscriptionLabel?: string;
    unknownAccountLabel?: string;
  };
  size?: 'sm' | 'lg';
  className?: string;
  location?: {
    name: string;
    coordinates?: { lat: number; lng: number } | null;
    confidence?: number | null;
    matchType?: string | null;
  } | null;
  /**
   * Context/variant this card renders in. `'detail'` (default) keeps the
   * subscribe/unsubscribe icon-toggle button. `'list'` omits the toggle from
   * the DOM entirely (Story 0.i6c) — intended for list-context surfaces
   * (e.g. the Subscribed Accounts settings list) that have no subscribe
   * concept of their own.
   */
  variant?: 'detail' | 'list';
  /**
   * When `true` and `account.platform` is present, renders a platform-name
   * pill next to the primary label (Story 0.i6c). Defaults to off so
   * existing detail-context callers remain pixel-identical.
   */
  showPlatformBadge?: boolean;
}
