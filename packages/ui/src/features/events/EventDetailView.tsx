import React from 'react';
import { MapPin, CalendarDays, ExternalLink, Heart, User, DollarSign, CalendarPlus } from 'lucide-react';
import { EventDetailViewProps, ScheduleDetail } from './EventDetailView.types';
import { EventImage } from './EventImage';

/**
 * EventDetailView is a reusable, presentation-only component that displays
 * comprehensive details about an event including multiple schedules,
 * category/type tags, and a hero image.
 * 
 * It supports loading and error states, and is framework-agnostic.
 * 
 * @param props - EventDetailViewProps
 */
export const EventDetailView: React.FC<EventDetailViewProps> = ({
  eventName,
  description,
  schedules,
  location,
  types,
  categories,
  imageUrl,
  imageAlt,
  originalPostUrl,
  sourcePostUrl,
  accountName,
  accountPlatformIconUrl,
  accountHref,
  loading = false,
  error = null,
  locale = 'en-US',
  labels,
  isFavorited,
  onFavoriteToggle,
  isAddedToCalendar,
  onAddToCalendar,
}) => {
  if (loading) {
    return (
      <div className="animate-pulse flex flex-col gap-6" aria-busy="true" aria-label={labels.loadingText}>
        <div className="w-full h-64 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
        <div className="flex flex-col gap-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-20"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-800 rounded w-24"></div>
        </div>
        <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded w-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-center">
        <p className="font-medium">{labels.errorText}</p>
        <p className="text-sm mt-2">{error.message}</p>
      </div>
    );
  }

  const formatScheduleDate = (schedule: ScheduleDetail) => {
    try {
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: schedule.eventStartTime ? 'numeric' : undefined,
        minute: schedule.eventStartTime ? '2-digit' : undefined,
      };
      
      const startDate = new Date(schedule.eventStartDate);
      let dateString = new Intl.DateTimeFormat(locale, options).format(startDate);
      
      // If we only have an end time but no end date, or end date is the same
      if (schedule.eventEndDate && schedule.eventEndDate !== schedule.eventStartDate) {
        const endDateOptions: Intl.DateTimeFormatOptions = {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        };
        const endDate = new Date(schedule.eventEndDate);
        dateString += ` - ${new Intl.DateTimeFormat(locale, endDateOptions).format(endDate)}`;
      } else if (schedule.eventEndTime && schedule.eventStartTime) {
          // just append time
          dateString += ` - ${schedule.eventEndTime}`;
      }
      return dateString;
    } catch (e) {
      // Fallback if date is invalid
      return schedule.eventStartDate;
    }
  };

  const hasTags = (types && types.length > 0) || (categories && categories.length > 0);
  const hasAccountAttribution = accountName && accountPlatformIconUrl && accountHref;
  const hasSourceAttribution = originalPostUrl || sourcePostUrl;

  return (
    <article className="flex flex-col gap-6">
      {/* Header controls */}
      {(onFavoriteToggle || onAddToCalendar) && (
        <div className="flex justify-end gap-3 mb-2">
          {onFavoriteToggle && (
            <button
              onClick={onFavoriteToggle}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={isFavorited ? labels.removeFavoriteButtonLabel : labels.favoriteButtonLabel}
              aria-pressed={isFavorited}
            >
              <Heart className={`w-6 h-6 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
            </button>
          )}
          {onAddToCalendar && (
            <button
              onClick={onAddToCalendar}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={labels.addToCalendarButtonLabel}
              aria-pressed={isAddedToCalendar}
            >
              <CalendarPlus className={`w-6 h-6 ${isAddedToCalendar ? 'text-primary' : 'text-gray-500'}`} />
            </button>
          )}
        </div>
      )}

      {/* Image */}
      <EventImage imageUrl={imageUrl} imageAlt={imageAlt} eventName={eventName} />

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{eventName}</h1>
        
        {hasTags && (
          <ul className="flex flex-wrap gap-2" aria-label="Event categories and types">
            {categories?.map((category, idx) => (
              <li key={`cat-${idx}`} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                {category}
              </li>
            ))}
            {types?.map((type, idx) => (
              <li key={`type-${idx}`} className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium">
                {type}
              </li>
            ))}
          </ul>
        )}
      </header>

      {/* Description */}
      {description && (
        <section>
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{description}</p>
        </section>
      )}

      {/* Schedules */}
      <section className="flex flex-col gap-4">
        {schedules && schedules.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {schedules.map((schedule, idx) => {
              const scheduleLocation = schedule.location || location;
              return (
                <li key={idx} className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg flex flex-col gap-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-gray-500" />
                    {schedule.title || `${labels.defaultScheduleTitle} ${idx + 1}`}
                  </h3>
                  
                  <div className="flex flex-col gap-2 ml-7 text-sm text-gray-600 dark:text-gray-400">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {formatScheduleDate(schedule)}
                    </p>

                    <address className="not-italic flex items-start gap-2">
                      <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="sr-only">{labels.locationLabel}:</span>
                        {schedule.mapUrl ? (
                          <a href={schedule.mapUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            {scheduleLocation}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span>{scheduleLocation}</span>
                        )}
                      </div>
                    </address>

                    {schedule.performers && (
                      <div className="flex items-start gap-2">
                        <User className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="sr-only">{labels.performersLabel}:</span>
                          <span>{schedule.performers}</span>
                        </div>
                      </div>
                    )}

                    {schedule.ticketPrice && (
                      <div className="flex items-start gap-2">
                        <DollarSign className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="sr-only">{labels.ticketPriceLabel}:</span>
                          <span>{schedule.ticketPrice}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-gray-500 italic">{labels.noSchedulesLabel}</p>
        )}
      </section>

      {/* Attributions */}
      {(hasAccountAttribution || hasSourceAttribution) && (
        <section className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col gap-3 text-sm text-gray-500">
          {hasAccountAttribution && (
            <div className="flex items-center gap-2">
              <span>Posted by:</span>
              <a href={accountHref!} className="flex items-center gap-2 hover:underline text-gray-900 dark:text-gray-100 font-medium">
                <img src={accountPlatformIconUrl!} alt="" className="w-4 h-4 rounded-sm" aria-hidden="true" />
                {accountName}
              </a>
            </div>
          )}

          {hasSourceAttribution && (
            <div className="flex items-center gap-4 flex-wrap">
              {originalPostUrl && (
                <a href={originalPostUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline text-primary">
                  View original post <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {sourcePostUrl && (
                <a href={sourcePostUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline text-primary">
                  View source <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </section>
      )}
    </article>
  );
};
