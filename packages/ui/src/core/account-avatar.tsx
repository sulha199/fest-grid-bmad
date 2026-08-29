'use client';

import * as React from 'react';
import { useState } from 'react';

export interface AccountAvatarProps {
  profileImageUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  size?: 'sm' | 'lg';
}

const InstagramPlaceholder = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 512 512"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    data-testid="avatar-fallback-placeholder"
  >
    <circle cx="256" cy="256" r="256" className="fill-slate-100 dark:fill-slate-800" />
    <circle cx="256" cy="188" r="90" className="fill-slate-300 dark:fill-slate-600" />
    <path
      d="M256 300c-75 0-150 45-150 100v30h300v-30c0-55-75-100-150-100z"
      className="fill-slate-300 dark:fill-slate-600"
    />
  </svg>
);

export function AccountAvatar({
  profileImageUrl,
  displayName,
  username,
  size = 'sm',
}: AccountAvatarProps) {
  const [hasError, setHasError] = useState(false);

  // Construct fallback alt text or aria-label for accessibility
  const altText = displayName || (username ? `@${username}` : 'User avatar');

  // Determine size-specific styling matching codebase conventions
  const sizeClasses =
    size === 'lg'
      ? 'w-16 h-16 sm:w-20 sm:h-20'
      : 'w-10 h-10';

  const commonClasses = `${sizeClasses} rounded-full shrink-0 border border-slate-200 dark:border-slate-800 overflow-hidden`;

  if (!profileImageUrl || hasError) {
    return (
      <div
        className={commonClasses}
        role="img"
        aria-label={altText}
        data-testid="avatar-fallback-container"
      >
        <InstagramPlaceholder className="w-full h-full" />
      </div>
    );
  }

  return (
    <img
      src={profileImageUrl}
      alt={altText}
      onError={() => setHasError(true)}
      className={`${commonClasses} object-cover`}
      data-testid="avatar-image"
    />
  );
}
