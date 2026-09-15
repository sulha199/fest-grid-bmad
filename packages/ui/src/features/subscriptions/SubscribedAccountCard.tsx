import * as React from 'react';
import { UserPlus, UserCheck } from 'lucide-react';
import { AccountAvatar } from '../../core/account-avatar';
import type { SubscribedAccountCardProps } from './SubscribedAccountCard.types';

export function SubscribedAccountCard({
  account,
  accountHref,
  isSubscribed,
  onSubscribe,
  onUnsubscribe,
  isStatusLoading,
  isTogglePending,
  labels,
  size,
  className = '',
}: SubscribedAccountCardProps) {
  const displayNameTextClass = size === 'lg' ? 'text-lg' : '';
  const usernameTextClass = size === 'lg' ? 'text-base' : 'text-sm';

  const ariaLabel = isStatusLoading
    ? labels?.checkingSubscriptionLabel || 'Checking subscription status'
    : isSubscribed
    ? labels?.unsubscribeLabel || 'Unsubscribe'
    : labels?.subscribeLabel || 'Subscribe';

  const handleClick = isStatusLoading ? undefined : isSubscribed ? onUnsubscribe : onSubscribe;
  const isDisabled =
    !!isStatusLoading ||
    !!isTogglePending ||
    (!isSubscribed && !onSubscribe) ||
    (isSubscribed && !onUnsubscribe);

  return (
    <div className={`flex items-center justify-between w-full ${className}`}>
      <a
        href={accountHref}
        className="flex items-center gap-3 min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <AccountAvatar
          profileImageUrl={account.profileImageUrl}
          displayName={account.displayName}
          username={account.username}
          size={size}
          platform={account.platform}
        />
        <div className="flex flex-col min-w-0">
          <span className={`truncate font-medium ${displayNameTextClass}`} title={account.displayName}>{account.displayName}</span>
          <span className={`truncate text-gray-500 ${usernameTextClass}`} title={account.username}>@{account.username}</span>
        </div>
      </a>
      <div className="ml-4 flex-shrink-0">
        <button
          type="button"
          data-testid="subscribe-toggle"
          onClick={handleClick}
          disabled={isDisabled}
          aria-busy={!!isStatusLoading || !!isTogglePending}
          aria-pressed={isStatusLoading ? undefined : isSubscribed}
          aria-label={ariaLabel}
          className="rounded-full p-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {isStatusLoading ? (
            <UserPlus className="w-5 h-5 text-gray-400 opacity-40" aria-hidden="true" />
          ) : isSubscribed ? (
            <UserCheck className="w-5 h-5 text-primary" aria-hidden="true" />
          ) : (
            <UserPlus className="w-5 h-5 text-gray-400 hover:text-gray-600" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
