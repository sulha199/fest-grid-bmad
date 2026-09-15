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
}
