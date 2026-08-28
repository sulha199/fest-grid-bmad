import React from 'react';
import { MapPin, CalendarDays, ExternalLink, Heart, User, DollarSign, CalendarPlus, MoreVertical, AlertCircle } from 'lucide-react';
import { EventDetailViewProps, ScheduleDetail, EventDetailViewLabels } from './EventDetailView.types';
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
  videoUrl,
  videoAlt,
  imageFallbackUrl,
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
  isAuthenticated = true,
  isAddedToCalendar,
  onAddToCalendar,
  onResolveScheduleTimezone,
  onCorrectData,
  onReport,
}) => {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const menuContainerRef = React.useRef<HTMLDivElement>(null);
  const menuTriggerRef = React.useRef<HTMLButtonElement>(null);

  const [timezoneStates, setTimezoneStates] = React.useState<Record<string, { value: string }>>({})

  const menuActions = React.useMemo(() => {
    const list: { label: string; onClick: () => void }[] = [];
    if (onCorrectData) {
      list.push({
        label: labels.correctDataMenuItemLabel,
        onClick: onCorrectData,
      });
    }
    if (onReport) {
      list.push({
        label: labels.reportMenuItemLabel || 'Report',
        onClick: onReport,
      });
    }
    return list;
  }, [onCorrectData, onReport, labels.correctDataMenuItemLabel, labels.reportMenuItemLabel]);

  React.useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        menuTriggerRef.current?.focus();
        return;
      }
      
      if (e.key === 'Tab' && menuContainerRef.current) {
        const focusable = menuContainerRef.current.querySelectorAll<HTMLElement>(
          'button, [tabindex="0"]'
        );
        const focusableElements = Array.from(focusable).filter((el) => el.tabIndex !== -1);
        if (focusableElements.length > 0) {
          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }
      }
    };

    const handleOutsideClick = (e: PointerEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsideClick);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [isMenuOpen]);

  const handleTriggerClick = () => {
    if (!isAuthenticated && onAddToCalendar) {
      onAddToCalendar([]);
      return;
    }
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="animate-pulse flex flex-col gap-6" aria-busy="true" aria-label={labels.loadingText}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Left Column: Image Skeleton */}
          <div className="lg:col-span-3">
            <div className="w-full h-64 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
          </div>

          {/* Right Column: Content Skeleton */}
          <div className="lg:col-span-2 flex flex-col gap-6">
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
        </div>
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
      {(onFavoriteToggle || onAddToCalendar || menuActions.length > 0) && (
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
              ref={triggerRef}
              onClick={handleTriggerClick}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={labels.addToCalendarButtonLabel}
              aria-pressed={isAddedToCalendar}
            >
              <CalendarPlus className={`w-6 h-6 ${isAddedToCalendar ? 'fill-primary text-primary' : 'text-gray-500'}`} />
            </button>
          )}
          {menuActions.length > 0 && (
            <div className="relative" ref={menuContainerRef}>
              <button
                ref={menuTriggerRef}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label={labels.moreActionsButtonLabel}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
              >
                <MoreVertical className="w-6 h-6 text-gray-500" />
              </button>
              {isMenuOpen && (
                <div
                  className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md shadow-lg py-1 z-50 focus:outline-none"
                  role="menu"
                  aria-orientation="vertical"
                >
                  {menuActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setIsMenuOpen(false);
                        action.onClick();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      role="menuitem"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
        {/* Left Column: Media */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <EventImage
            imageUrl={imageUrl}
            imageAlt={imageAlt}
            eventName={eventName}
            videoUrl={videoUrl}
            videoAlt={videoAlt}
            imageFallbackUrl={imageFallbackUrl}
            originalPostUrl={originalPostUrl}
            sourcePostUrl={sourcePostUrl}
            videoUnavailableLabel={labels.videoUnavailableLabel}
            viewOriginalPostLabel={labels.viewOriginalPostLabel}
            viewSourceLabel={labels.viewSourceLabel}
          />
        </div>

        {/* Right Column: Details & Content */}
        <div className="lg:col-span-2 flex flex-col gap-6">
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
              const scheduleAsHeader = !schedule.title && schedules.length === 1;
              return (
                <li key={idx} className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg flex flex-col gap-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-gray-500" />
                    {
                      scheduleAsHeader ?
                        formatScheduleDate(schedule) :
                        (schedule.title || `${labels.defaultScheduleTitle} ${idx + 1}`)
                    }
                  </h3>

                  {schedule.timezoneStatus === 'NEEDS_CLARIFICATION' && onResolveScheduleTimezone && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                      <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                      <div className="flex-1 flex flex-col gap-2">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">{labels.timezoneClarificationLabel}</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={timezoneStates[schedule.id]?.value || ''}
                            onChange={(e) => setTimezoneStates(prev => ({ ...prev, [schedule.id]: { value: e.target.value } }))}
                            placeholder={labels.timezoneSelectPlaceholder}
                            className="px-2 py-1 text-sm border border-yellow-300 dark:border-yellow-700 bg-white dark:bg-gray-900 rounded text-gray-900 dark:text-gray-100"
                            aria-label={labels.timezoneSelectLabel}
                          />
                          <button
                            onClick={() => {
                              const value = timezoneStates[schedule.id]?.value;
                              if (value) {
                                onResolveScheduleTimezone(schedule.id, value);
                                setTimezoneStates(prev => ({ ...prev, [schedule.id]: { value: '' } }));
                              }
                            }}
                            disabled={!timezoneStates[schedule.id]?.value}
                            className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {labels.timezoneSubmitLabel}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={`flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-400 ${scheduleAsHeader ? "" : "ml-7"}`}>
                    {!scheduleAsHeader && (
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {formatScheduleDate(schedule)}
                      </p>
                    )}

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
              <span>{labels.postedByLabel}</span>
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
                  {labels.viewOriginalPostLabel} <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {sourcePostUrl && (
                <a href={sourcePostUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline text-primary">
                  {labels.viewSourceLabel} <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </section>
      )}
        </div>
      </div>

      {onAddToCalendar && (
        <AddToCalendarDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          schedules={schedules}
          labels={labels}
          onConfirm={onAddToCalendar}
          locale={locale}
          formatScheduleDate={formatScheduleDate}
          triggerEl={triggerRef.current}
        />
      )}
    </article>
  );
};

interface AddToCalendarDialogProps {
  isOpen: boolean;
  onClose: () => void;
  schedules: ScheduleDetail[];
  labels: EventDetailViewLabels;
  onConfirm: (selectedIds: string[]) => void;
  locale?: string;
  formatScheduleDate: (schedule: ScheduleDetail) => string;
  triggerEl: HTMLButtonElement | null;
}

const AddToCalendarDialog: React.FC<AddToCalendarDialogProps> = ({
  isOpen,
  onClose,
  schedules,
  labels,
  onConfirm,
  locale,
  formatScheduleDate,
  triggerEl,
}) => {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Initialize selectedIds with schedules that already have isAddedToCalendar === true
  React.useEffect(() => {
    if (isOpen) {
      const initialSelected = schedules
        .filter((s) => s.isAddedToCalendar)
        .map((s) => s.id);
      setSelectedIds(initialSelected);
    }
  }, [isOpen, schedules]);

  // Handle focus trap
  React.useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (container) {
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && container) {
        const focusable = container.querySelectorAll<HTMLElement>(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
        );
        const focusableElements = Array.from(focusable).filter((el) => el.tabIndex !== -1);

        if (focusableElements.length === 0) {
          e.preventDefault();
          container.focus();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === container) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    const handleOutsideClick = (e: PointerEvent) => {
      if (container && !container.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleOutsideClick);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleOutsideClick);
      if (triggerEl) {
        setTimeout(() => triggerEl.focus(), 0);
      }
    };
  }, [isOpen, onClose, triggerEl]);

  if (!isOpen) return null;

  const handleCheckboxChange = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div
        ref={containerRef}
        tabIndex={-1}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 flex flex-col gap-4 focus:outline-none"
      >
        <h2 id="dialog-title" className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {labels.addToCalendarDialogTitle}
        </h2>

        <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
          {schedules.map((schedule, idx) => {
            const isChecked = selectedIds.includes(schedule.id);
            const labelText = schedule.title || `${labels.defaultScheduleTitle} ${idx + 1}`;
            const dateText = formatScheduleDate(schedule);

            return (
              <label
                key={schedule.id}
                className="flex items-start gap-3 p-3 border border-gray-100 dark:border-gray-800 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => handleCheckboxChange(schedule.id, e.target.checked)}
                  className="mt-1 h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary focus:ring-offset-0"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                    {labelText}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {dateText}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-sm font-medium transition-colors"
          >
            {labels.addToCalendarCancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors"
          >
            {labels.addToCalendarConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
