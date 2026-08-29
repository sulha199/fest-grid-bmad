"use client"

import React, { useState } from 'react';
import { MapPin, Heart, Clock } from 'lucide-react';
import { useScopedLocale, useScopedTimezone } from '../../hooks';
import type { EventCardProps } from './EventCard.types';
import {
  getEventDayDiff,
  formatRelativeDayOrDate,
  formatShortEventDateTime,
} from './format-event-date';

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
  startTime,
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
    yesterday: 'Yesterday',
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

  const dateStr = typeof startDate === 'string' ? startDate : startDate.toISOString();
  const hasTime = !!startTime;

  const parseDateTime = (dStr: string, tStr?: string | null): Date => {
    if (tStr) {
      // e.g. "2026-08-01T12:00:00" or similar
      const datePart = dStr.split('T')[0];
      const combined = `${datePart}T${tStr}`;
      const d = new Date(combined);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date(dStr);
  };

  const dateObj = parseDateTime(dateStr, startTime);
  const dayDiff = getEventDayDiff(dateObj, activeTimezone);
  const formattedDate = formatRelativeDayOrDate(activeLocale, activeTimezone, dateObj, defaultLabels, dayDiff);

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
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/80 backdrop-blur-sm shadow-sm text-xs font-semibold text-foreground">
              {hasTime && dayDiff === 0 && <Clock className="w-3 h-3" />}
              {formatShortEventDateTime(activeLocale, activeTimezone, dateObj, hasTime, defaultLabels)}
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
            <h3 className="text-sm font-semibold leading-tight tracking-tight text-card-foreground line-clamp-2">
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
