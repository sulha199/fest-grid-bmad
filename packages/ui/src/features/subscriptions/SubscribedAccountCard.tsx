import * as React from 'react';
import { AccountAvatar } from '../../core/account-avatar';
import type { SubscribedAccountCardProps } from './SubscribedAccountCard.types';

export function SubscribedAccountCard({
  account,
  accountHref,
  isSubscribed,
  onSubscribe,
  isSubscribing,
  labels,
  size,
  className = '',
}: SubscribedAccountCardProps) {
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
        />
        <div className="flex flex-col min-w-0">
          <span className="truncate font-medium" title={account.displayName}>{account.displayName}</span>
          <span className="truncate text-sm text-gray-500" title={account.username}>@{account.username}</span>
        </div>
      </a>
      <div className="ml-4 flex-shrink-0">
        {isSubscribed ? (
          <span className="text-sm font-medium">
            {labels?.subscribedLabel || 'Subscribed'}
          </span>
        ) : (
          <button
            type="button"
            onClick={onSubscribe}
            disabled={isSubscribing || !onSubscribe}
            aria-busy={isSubscribing}
            className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {labels?.subscribeLabel || 'Subscribe'}
          </button>
        )}
      </div>
    </div>
  );
}
