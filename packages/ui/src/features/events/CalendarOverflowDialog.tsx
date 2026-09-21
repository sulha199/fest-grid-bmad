"use client"

/**
 * CalendarOverflowDialog — the ONE shared `calendar_overflow_dialog` component
 * (`DESIGN.md` § `components.calendar_overflow_dialog`, Story 1.i1h Task 6).
 *
 * Simultaneously retires two bespoke, surface-specific overflow implementations:
 *  - desktop's static `w-56 max-h-56 overflow-y-auto` popover, and
 *  - mobile's previous uncapped always-render day list.
 *
 * Responsive by breakpoint (bottom sheet `<md:`, centered dialog `>=md:`) with real
 * infinite-scroll pagination via the existing `useInfiniteScroll` hook (Task 6.4 — no second
 * infinite-scroll mechanism is built), full modal accessibility (Task 6.5), and one shared
 * row renderer built on Story 1.i1f's `EventCardCalendarGridItem` primitive (Task 6.3).
 *
 * @see CalendarOverflowDialog.types.ts — props/labels contract
 * @see WeeklyCalendarView.tsx — the only caller; owns open/closed state + focus return
 * @see apps/web/src/features/events/CalendarView.tsx — owns the day-scoped React Query fetch
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import { useInfiniteScroll } from '../../hooks';
import { EventCardCalendarGridItem } from './EventCardCalendarGridItem';
import type {
  CalendarOverflowDialogItemShape,
  CalendarOverflowDialogProps,
} from './CalendarOverflowDialog.types';

/**
 * `DESIGN.md` `components.calendar_overflow_dialog`, transcribed verbatim:
 *
 *   sheet_mobile:   "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-xl bg-white shadow-xl flex flex-col"
 *   dialog_desktop: "{components.modal.dialog} max-h-[70vh] flex flex-col"
 *                   -> "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white
 *                       rounded-lg shadow-xl p-6 w-full max-w-md max-h-[70vh] flex flex-col"
 *   scroll_region:  "flex-1 overflow-y-auto flex flex-col gap-2 p-3"
 *
 * Both token values are applied to the *same* element rather than duplicated into two
 * `hidden md:*` trees (the usual responsive convention in `WeeklyCalendarView.tsx`): the dialog
 * is one focus trap, one `aria-live` region and one scroll sentinel, so two DOM copies would
 * break exactly the accessibility guarantees AC8 requires. The desktop token's classes are
 * therefore re-expressed as `md:`-scoped overrides of the mobile token's classes, and the
 * overlay reuses `components.modal.overlay` verbatim.
 */
const OVERLAY_CLASS = "fixed inset-0 z-40 bg-black bg-opacity-50";
const DIALOG_SURFACE_CLASS =
  "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-xl bg-white shadow-xl flex flex-col " +
  "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 " +
  "md:w-full md:max-w-md md:max-h-[70vh] md:rounded-lg md:p-6";
const SCROLL_REGION_CLASS = "flex-1 overflow-y-auto flex flex-col gap-2 p-3";
/**
 * No DESIGN.md token covers this dialog's header (the token block specifies only the surface,
 * the scroll region and the responsive split), so it reuses the chrome of the popover it
 * replaces — the same `border-b` header row with a dismiss control.
 */
const HEADER_CLASS = "flex items-center justify-between gap-2 pb-2 border-b border-gray-200 shrink-0";
const CLOSE_BUTTON_CLASS = "p-1 rounded hover:bg-gray-100 text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";
/**
 * Story 1.i1g AC12's proven shape for "the whole card is the schedule-click target, but the
 * card also contains its own interactive favorite button": a real `<button>` (Enter/Space,
 * `focus-visible` ring, single linear Tab stop) sits *underneath* the visual layer so the card
 * layer paints on top while mouse/touch events fall through to it, and
 * `[&_button]:pointer-events-auto` restores interactivity for the card's own favorite button.
 */
const ITEM_HOST_CLASS = "relative shrink-0";
const ITEM_CLICK_CLASS = "absolute inset-0 z-10 w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";
const ITEM_VISUAL_CLASS = "relative z-20 pointer-events-none [&_button]:pointer-events-auto";
const SENTINEL_CLASS = "h-px w-full shrink-0";
const STATUS_TEXT_CLASS = "text-xs text-center text-gray-500 py-2";

export function CalendarOverflowDialog<
  TSchedule extends CalendarOverflowDialogItemShape = CalendarOverflowDialogItemShape,
>({
  open,
  date,
  items,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  onClose,
  onScheduleClick,
  onFavoriteToggle,
  nearbyBadgeThreshold,
  triggerRef,
  labels = {},
  className = '',
}: CalendarOverflowDialogProps<TSchedule>) {
  const defaultLabels = {
    titleLabel: 'All schedules',
    closeLabel: 'Close',
    loadingMoreLabel: 'Loading more…',
    loadMoreErrorLabel: 'Could not load more events.',
    loadedAnnouncement: (count: number) => `${count} more ${count === 1 ? 'event' : 'events'} loaded`,
    favoriteToggleLabel: 'Toggle favorite',
    nearbyBadgeLabel: 'Nearby',
    ...labels,
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [announcement, setAnnouncement] = useState('');
  const previousItemCountRef = useRef(0);
  const wasOpenRef = useRef(false);

  // Task 6.4 — the existing shared hook owns sentinel observation + duplicate-fetch guarding.
  const { sentinelRef, error } = useInfiniteScroll({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });

  // Task 6.5 — `aria-live="polite"` announcement of newly-loaded items. The baseline is
  // (re)seeded whenever the dialog opens or switches day, so the *first* page arriving is
  // delivered content, not an announcement of "more".
  useEffect(() => {
    previousItemCountRef.current = items.length;
    setAnnouncement('');
    // Deliberately keyed on `open`/`date` only: the baseline must be re-seeded when the dialog
    // opens or switches day, not on every page arrival (which the effect below handles).
  }, [open, date]);

  useEffect(() => {
    const delta = items.length - previousItemCountRef.current;
    previousItemCountRef.current = items.length;
    if (delta > 0) {
      setAnnouncement(defaultLabels.loadedAnnouncement(delta));
    }
    // Keyed on the count alone — that *is* the change being announced.
  }, [items.length]);

  // Task 6.5 — focus trap, Escape-to-close and outside-pointerdown-close. Adapted from the
  // superseded popover's own trap in `WeeklyCalendarView.tsx`, so the keyboard contract users
  // already had on desktop is preserved rather than re-invented.
  useEffect(() => {
    if (!open) return;

    const container = dialogRef.current;
    if (container) {
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      if (!container) return;

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
      } else if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
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
    };
  }, [open, onClose]);

  // Task 6.5/7.4 — focus return to the trigger the user activated. Deferred a tick so the
  // dialog's own unmount has settled before focus moves (mirrors the superseded popover's
  // close), and skipped entirely when the caller supplied no trigger ref.
  useEffect(() => {
    if (wasOpenRef.current && !open) {
      const trigger = triggerRef?.current;
      if (trigger) {
        setTimeout(() => trigger.focus(), 0);
      }
    }
    wasOpenRef.current = open;
  }, [open, triggerRef]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div className={OVERLAY_CLASS} data-testid="calendar-overflow-overlay" />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-date={date ?? undefined}
        data-testid="calendar-overflow-dialog"
        className={`${DIALOG_SURFACE_CLASS} ${className}`}
      >
        <div className={HEADER_CLASS}>
          <span id={titleId} className="text-sm font-bold text-gray-700">
            {defaultLabels.titleLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={defaultLabels.closeLabel}
            className={CLOSE_BUTTON_CLASS}
          >
            {/* Inline glyph: `features/events` already depends on `lucide-react`, but this X is
                decorative chrome with no other consumer in this component, so a one-glyph
                inline SVG keeps the shared dialog free of an extra icon import. */}
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={SCROLL_REGION_CLASS} data-testid="calendar-overflow-scroll-region">
          {items.map((item) => (
            <div key={item.id} className={ITEM_HOST_CLASS}>
              {onScheduleClick && (
                <button
                  type="button"
                  className={ITEM_CLICK_CLASS}
                  onClick={() => onScheduleClick(item)}
                >
                  {/* Accessible name only — the visual card layer below supplies all visible
                      content, so this element must not render text of its own (no duplicate
                      announcement). */}
                  <span className="sr-only">{item.eventName}</span>
                </button>
              )}
              <div className={ITEM_VISUAL_CLASS}>
                <EventCardCalendarGridItem
                  eventName={item.eventName}
                  location={item.locationName}
                  // Task 6.3 — Story 1.i1f's NO-IMAGE composition: `isMultiDay={false}` makes
                  // the primitive skip its with-image layout entirely, which is exactly the
                  // composition this dialog consumes. The image itself is never built here.
                  isMultiDay={false}
                  isFavorited={item.isFavorited}
                  favoriteCount={item.favoriteCount}
                  onFavoriteToggle={onFavoriteToggle ? () => onFavoriteToggle(item) : undefined}
                  distanceKm={item.distanceKm}
                  nearbyBadgeThreshold={nearbyBadgeThreshold}
                  labels={{
                    favoriteToggle: defaultLabels.favoriteToggleLabel,
                    nearbyBadge: defaultLabels.nearbyBadgeLabel,
                  }}
                />
              </div>
            </div>
          ))}

          <div ref={sentinelRef} className={SENTINEL_CLASS} data-testid="calendar-overflow-sentinel" />
          {isFetchingNextPage && <p className={STATUS_TEXT_CLASS}>{defaultLabels.loadingMoreLabel}</p>}
        </div>

        {error != null && (
          <p role="alert" className="text-xs text-destructive py-2 shrink-0">
            {defaultLabels.loadMoreErrorLabel}
          </p>
        )}

        <div aria-live="polite" className="sr-only" data-testid="calendar-overflow-live-region">
          {announcement}
        </div>
      </div>
    </>
  );
}
