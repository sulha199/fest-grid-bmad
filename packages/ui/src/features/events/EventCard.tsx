import React, { useState } from 'react';
import { MapPin, Tag, Heart } from 'lucide-react';
import type { EventCardProps } from './EventCard.types';

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
  eventName,
  startDate,
  locale = 'en-US',
  imageUrl,
  imageAlt,
  loading = false,
  locationName,
  categories = [],
  types = [],
  priceFrom,
  isFavorited = false,
  onFavoriteToggle,
  href,
  onClick,
  labels = {},
}: EventCardProps) {
  const defaultLabels = {
    imageFallbackAlt: 'No image available',
    loading: 'Loading event details',
    favoriteToggle: 'Toggle favorite',
    ...labels,
  };

  const [imgError, setImgError] = useState(false);

  if (loading) {
    return (
      <article
        aria-busy="true"
        aria-label={defaultLabels.loading}
        className="w-full max-w-sm rounded-xl overflow-hidden shadow-sm border border-border bg-card animate-pulse"
      >
        <div className="h-48 bg-muted w-full" />
        <div className="p-4 space-y-4">
          <div className="h-6 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
        </div>
      </article>
    );
  }

  const dateObj = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const formattedDate = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(dateObj);

  const fallbackAlt = defaultLabels.imageFallbackAlt;
  const finalImageAlt = imageAlt || eventName;

  const RootTag = href ? 'a' : onClick ? 'button' : 'div';
  const interactiveProps = href 
    ? { href } 
    : onClick 
      ? { onClick, type: 'button' as const } 
      : {};

  return (
    <article className="w-full max-w-sm rounded-xl overflow-hidden shadow-sm border border-border bg-card transition-all hover:shadow-md relative group flex flex-col">
      {onFavoriteToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onFavoriteToggle(e);
          }}
          aria-label={defaultLabels.favoriteToggle}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background transition-colors"
        >
          <Heart 
            className={`w-5 h-5 ${isFavorited ? 'fill-destructive text-destructive' : 'text-muted-foreground'}`} 
          />
        </button>
      )}

      <RootTag 
        {...interactiveProps} 
        className="flex-1 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative h-48 w-full bg-muted overflow-hidden flex items-center justify-center">
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
                  {type}
                </span>
              ))}
              {categories.map((cat) => (
                <span 
                  key={cat} 
                  className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-foreground"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          {priceFrom !== undefined && (
            <div className="flex items-center justify-between mt-2 pt-3 border-t">
              <span className="text-sm font-medium">From</span>
              <span className="text-sm font-semibold">{priceFrom}</span>
            </div>
          )}
        </div>
      </RootTag>
    </article>
  );
}
