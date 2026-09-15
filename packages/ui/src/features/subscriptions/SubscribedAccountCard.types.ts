export interface SubscribedAccountCardProps {
  account: {
    accountId: string;
    platform: string;
    displayName: string;
    username: string;
    profileImageUrl?: string | null;
  };
  accountHref: string;
  isSubscribed: boolean;
  onSubscribe?: () => void;
  onUnsubscribe?: () => void;
  isStatusLoading?: boolean;
  isTogglePending?: boolean;
  labels?: {
    subscribeLabel?: string;
    unsubscribeLabel?: string;
    checkingSubscriptionLabel?: string;
  };
  size?: 'sm' | 'lg';
  className?: string;
}
