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
  isSubscribing?: boolean;
  labels?: {
    subscribeLabel?: string;
    subscribedLabel?: string;
  };
  size?: 'sm' | 'lg';
  className?: string;
}
