"use client"

import React, { useState } from 'react';
import { MapPin, Heart } from 'lucide-react';
import { useScopedLocale, useScopedTimezone } from '../../hooks';
import type { EventCardProps } from './EventCard.types';

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

/**
 * Formats with graceful degradation: an invalid IANA timezone or locale tag
 * (e.g. bad/typo'd LocationDetails.timezone data, or an unrecognized locale)
 * throws a RangeError from Intl — retry without the timezone, then without
 * the custom locale, rather than crashing the whole card.
 */
function formatEventDate(locale: string, timezone: string | undefined, dateObj: Date): string {
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

function getLocalDateInTimezone(date: Date, timeZone: string | undefined): { year: number; month: number; day: number } {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      ...(timeZone ? { timeZone } : {}),
    });
    const parts = dtf.formatToParts(date);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
    return { year, month, day };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  }
}

function getCalendarDayDifference(nowParts: { year: number; month: number; day: number }, eventParts: { year: number; month: number; day: number }): number {
  const utcNow = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  const utcEvent = Date.UTC(eventParts.year, eventParts.month - 1, eventParts.day);
  const diffMs = utcEvent - utcNow;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function formatWeekday(locale: string, timezone: string | undefined, dateObj: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(dateObj);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(dateObj);
    } catch {
      return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateObj);
    }
  }
}

function formatRelativeDayOrDate(
  locale: string,
  timezone: string | undefined,
  dateObj: Date,
  labels?: { today?: string; tomorrow?: string }
): string {
  const now = new Date();
  const nowParts = getLocalDateInTimezone(now, timezone);
  const eventParts = getLocalDateInTimezone(dateObj, timezone);
  const dayDiff = getCalendarDayDifference(nowParts, eventParts);

  if (dayDiff >= 0 && dayDiff <= 6) {
    if (dayDiff === 0) {
      return labels?.today || 'Today';
    }
    if (dayDiff === 1) {
      return labels?.tomorrow || 'Tomorrow';
    }
    return formatWeekday(locale, timezone, dateObj);
  }

  return formatEventDate(locale, timezone, dateObj);
}

/**
 * EventCard is a reusable, framework-agnostic presentation component for displaying
 * an event's summary information, including its image, name, date, and optional
 * metadata like location, categories, types, and starting price.
 * 
 * It supports a loading skeleton state (`loading={true}`) for non-blocking initial loads,
 * and graceful fallback states for missing or broken images.
 * 
 * It also reserves an interactive slot for a "Quick Favorite" toggle, which is rendered
 * only when `onFavoriteToggle` is provided.
 * 
 * @example
 * ```tsx
 * <EventCard 
 *   eventName="Summer Fest" 
 *   startDate={new Date()} 
 *   imageUrl="https://..." 
 *   href="/events/summer-fest" 
 * />
 * ```
 */
export function EventCard({
  variant = 'standard',
  isGreyedOut = false,
  eventName,
  startDate,
  locale,
  timezone,
  imageUrl,
  imageAlt,
  loading = false,
  locationName,
  categories = [],
  types = [],
  priceFrom,
  pendingRemoval = false,
  isFavorited = false,
  favoriteCount,
  onFavoriteToggle,
  href,
  onClick,
  labels = {},
  statusBadge,
}: EventCardProps) {
  const defaultLabels = {
    imageFallbackAlt: 'No image available',
    loading: 'Loading event details',
    favoriteToggle: 'Toggle favorite',
    priceFrom: 'From',
    today: 'Today',
    tomorrow: 'Tomorrow',
    ...labels,
    typeLabels: labels.typeLabels ?? {},
    categoryLabels: labels.categoryLabels ?? {},
  };

  const [imgError, setImgError] = useState(false);
  const contextLocale = useScopedLocale();
  const contextTimezone = useScopedTimezone();
  // `||` (not `??`) so an accidental empty-string prop also falls through to context/default
  // instead of being passed straight to Intl and throwing.
  const activeLocale = locale || contextLocale;
  const activeTimezone = timezone || contextTimezone;

  if (loading) {
    const isMasonry = variant === 'masonry';
    return (
      <article
        aria-busy="true"
        aria-label={defaultLabels.loading}
        className={`w-full max-w-sm rounded-xl overflow-hidden shadow-sm border border-border bg-card animate-pulse ${isGreyedOut ? 'opacity-50 grayscale' : ''}`}
      >
        <div className={`${isMasonry ? 'aspect-[3/4]' : 'h-48'} bg-gray-200 w-full`} />
        <div className={isMasonry ? 'p-3 flex flex-col gap-2' : 'p-4 flex flex-col gap-4'}>
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          {!isMasonry && <div className="h-4 bg-gray-200 rounded w-1/2" />}
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      </article>
    );
  }

  const dateObj = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const formattedDate = formatRelativeDayOrDate(activeLocale, activeTimezone, dateObj, defaultLabels);

  const fallbackAlt = defaultLabels.imageFallbackAlt;
  const finalImageAlt = imageAlt || eventName;

  const RootTag = href ? 'a' : onClick ? 'button' : 'div';
  const interactiveProps = href 
    ? { href } 
    : onClick 
      ? { onClick, type: 'button' as const } 
      : {};

  return (
    <article
      className={`w-full max-w-sm rounded-xl overflow-hidden shadow-sm border border-border bg-card transition-all hover:shadow-md relative group flex flex-col ${
        pendingRemoval ? 'opacity-50 grayscale' : ''
      }`}
      aria-disabled={pendingRemoval}
    >
      {onFavoriteToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFavoriteToggle(e);
          }}
          aria-label={defaultLabels.favoriteToggle}
          className={`absolute top-3 right-3 z-10 rounded-full bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background transition-colors flex items-center justify-center ${
            favoriteCount !== undefined ? 'px-2.5 py-1.5 gap-1.5' : 'p-2'
          }`}
        >
          <Heart
            className={`w-5 h-5 ${isFavorited ? 'fill-red-600 text-red-600' : 'text-black'}`}
            fill={isFavorited ? 'currentColor' : 'none'}
          />
          {favoriteCount !== undefined && (
            <span className="text-xs font-semibold text-black pr-0.5 select-none">
              {favoriteCount}
            </span>
          )}
        </button>
      )}

      <RootTag 
        {...interactiveProps} 
        className="flex-1 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className={`relative ${variant === 'masonry' ? 'aspect-[3/4]' : 'h-48'} w-full bg-muted overflow-hidden flex items-center justify-center`}>
          {statusBadge && (
            <div className="absolute top-2 right-2 z-10">{statusBadge}</div>
          )}
          {variant === 'masonry' && (
            <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm shadow-sm text-xs font-semibold text-foreground">
              {formattedDate}
            </div>
          )}
          {!imgError && imageUrl ? (
            <img 
              src={imageUrl} 
              alt={finalImageAlt}
              onError={() => setImgError(true)}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <span className="text-sm font-medium">{fallbackAlt}</span>
            </div>
          )}
        </div>

        {variant === 'masonry' ? (
          <div className="p-3 flex-1 flex flex-col gap-2">
            <h3 className="text-xl font-semibold leading-tight tracking-tight text-card-foreground line-clamp-2">
              {eventName}
            </h3>
            {locationName && (
              <div className="flex items-center text-sm text-muted-foreground gap-1.5">
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="line-clamp-1">{locationName}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 flex-1 flex flex-col gap-3">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold leading-tight tracking-tight text-card-foreground line-clamp-2">
                {eventName}
              </h3>
              <p className="text-sm font-medium text-primary">
                {formattedDate}
              </p>
            </div>

            {locationName && (
              <div className="flex items-center text-sm text-muted-foreground gap-1.5">
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="line-clamp-1">{locationName}</span>
              </div>
            )}

            {(categories.length > 0 || types.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                {types.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground"
                  >
                    {defaultLabels.typeLabels[type] ?? type}
                  </span>
                ))}
                {categories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
                  >
                    {defaultLabels.categoryLabels[cat] ?? cat}
                  </span>
                ))}
              </div>
            )}

            {priceFrom !== undefined && (
              <div className="flex items-center justify-between mt-2 pt-3 border-t">
                <span className="text-sm font-medium">{defaultLabels.priceFrom}</span>
                <span className="text-sm font-semibold">{priceFrom}</span>
              </div>
            )}
          </div>
        )}
      </RootTag>
    </article>
  );
}
