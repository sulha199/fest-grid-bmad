"use client"

import * as React from 'react';
import { useState } from 'react';
import { Instagram, Link, ExternalLink, User } from 'lucide-react';
import { useScopedLocale, useScopedTimezone } from '../../hooks';
import { Checkbox } from '../../core/checkbox';
import type { PostCardProps, PostCardSkeletonProps } from './PostCard.types';

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

/**
 * Formats a post's publication date with graceful degradation for invalid
 * locale or timezone tags.
 */
function formatPostDate(locale: string, timezone: string | undefined, dateObj: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      ...DATE_FORMAT_OPTIONS,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(dateObj);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, DATE_FORMAT_OPTIONS).format(dateObj);
    } catch {
      return new Intl.DateTimeFormat('en-US', DATE_FORMAT_OPTIONS).format(dateObj);
    }
  }
}

const PlatformIcon = ({ platform, className }: { platform: string; className?: string }) => {
  const norm = platform.toLowerCase();
  if (norm === 'instagram') {
    return <Instagram className={className} />;
  }
  return <Link className={className} />;
};

/**
 * PostCard is a reusable presentation component for displaying a social media post.
 * It is fully pure, stateless, and driven by props.
 */
export function PostCard({
  post,
  publisher,
  isSelected = false,
  onSelectionChange,
  disabled = false,
  loading = false,
  locale,
  timezone,
  labels = {},
}: PostCardProps) {
  const defaultLabels = {
    imageFallbackAlt: 'No image available',
    loading: 'Loading post details',
    ...labels,
  };

  const [imgError, setImgError] = useState(false);
  const contextLocale = useScopedLocale();
  const contextTimezone = useScopedTimezone();
  const activeLocale = locale || contextLocale;
  const activeTimezone = timezone || contextTimezone;

  if (loading) {
    return <PostCardSkeleton loadingLabel={defaultLabels.loading} />;
  }

  const dateObj = typeof post.publishedAt === 'string' ? new Date(post.publishedAt) : post.publishedAt;
  const formattedDate = formatPostDate(activeLocale, activeTimezone, dateObj);

  // Fallback publisher name if not provided
  const publisherName = publisher?.displayName || `@${post.accountId}`;
  const platform = publisher?.platform || (post.postUrl.includes('instagram.com') ? 'instagram' : 'x');

  const handleCardClick = () => {
    if (disabled) return;
    if (onSelectionChange) {
      onSelectionChange(!isSelected);
    }
  };

  return (
    <article
      onClick={handleCardClick}
      className={`w-full max-w-sm rounded-xl overflow-hidden shadow-sm border border-border bg-card transition-all relative group flex flex-col p-4 select-none ${
        disabled ? 'opacity-60 grayscale cursor-not-allowed' : 'cursor-pointer hover:shadow-md'
      } ${isSelected ? 'ring-2 ring-violet-500 border-transparent' : ''}`}
    >
      {/* Top right selection checkbox */}
      {onSelectionChange && (
        <div
          className="absolute top-3 right-3 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            id={`post-check-${post.id}`}
            label=""
            checked={isSelected}
            onChange={(checked) => {
              if (!disabled) {
                onSelectionChange(checked);
              }
            }}
            disabled={disabled}
          />
        </div>
      )}

      {/* Header section with Publisher info */}
      <div className="flex items-center gap-3 mb-3 pr-10">
        {publisher?.profileImageUrl ? (
          <img
            src={publisher.profileImageUrl}
            alt={publisherName}
            className="w-10 h-10 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border text-muted-foreground">
            <User className="w-5 h-5" />
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-sm truncate text-foreground leading-tight">
            {publisherName}
          </span>
          <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
            <PlatformIcon platform={platform} className="w-3.5 h-3.5" />
            <span className="text-xs font-medium capitalize leading-none">{platform}</span>
          </div>
        </div>
      </div>

      {/* Optional Post Image */}
      {post.imageUrl ? (
        <div className="relative h-48 w-full bg-muted overflow-hidden flex items-center justify-center rounded-lg mb-3">
          {!imgError ? (
            <img
              src={post.imageUrl}
              alt="Post media"
              onError={() => setImgError(true)}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground bg-muted w-full h-full">
              <span className="text-xs font-medium">{defaultLabels.imageFallbackAlt}</span>
            </div>
          )}
        </div>
      ) : null}

      {/* Post Text Content */}
      <div className="flex-1 flex flex-col justify-between">
        <p className="text-sm text-foreground whitespace-pre-wrap break-words line-clamp-6">
          {post.content}
        </p>

        {/* Footer section with Date & Link */}
        <div className="flex items-center justify-between text-muted-foreground mt-4 pt-3 border-t border-border/50 text-xs">
          <time dateTime={post.publishedAt}>
            {formattedDate}
          </time>
          <a
            href={post.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-700 font-medium transition-colors"
          >
            Original Post
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </article>
  );
}

/**
 * PostCardSkeleton represents the loading state of the PostCard.
 */
export function PostCardSkeleton({ loadingLabel = 'Loading post details', className = '' }: PostCardSkeletonProps) {
  return (
    <article
      aria-busy="true"
      aria-label={loadingLabel}
      className={`w-full max-w-sm rounded-xl overflow-hidden shadow-sm border border-border bg-card animate-pulse p-4 flex flex-col gap-3 ${className}`}
    >
      {/* Header Skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
          <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
        </div>
      </div>

      {/* Image Skeleton placeholder */}
      <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-lg w-full" />

      {/* Content Skeleton */}
      <div className="flex flex-col gap-2 flex-1 mt-1">
        <div className="h-3.5 bg-gray-200 dark:bg-gray-800 rounded w-full" />
        <div className="h-3.5 bg-gray-200 dark:bg-gray-800 rounded w-5/6" />
        <div className="h-3.5 bg-gray-200 dark:bg-gray-800 rounded w-4/5" />
      </div>

      {/* Footer Skeleton */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
        <div className="h-3.5 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
        <div className="h-3.5 bg-gray-200 dark:bg-gray-800 rounded w-1/5" />
      </div>
    </article>
  );
}
