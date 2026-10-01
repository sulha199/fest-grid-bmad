import { EventCard } from './EventCard';
import { EventListViewItem, EventListViewProps } from './EventListView.types';
import { GridContainer } from '../../core/grid-container';
import { selectDisplaySchedule } from '@festgrid/domain/events';

export function EventListView<TEvent extends EventListViewItem>({
  status,
  events,
  errorMessage,
  errorDetail,
  emptyState,
  getCardProps,
  cardLabels,
  sentinelRef,
  isFetchingNextPage,
  hasNextPage,
  loadingMoreLabel,
  skeletonCount = 6,
  className,
}: EventListViewProps<TEvent>) {
  if (status === 'loading') {
    return (
      <GridContainer baseCols={2} colsStep={1} gap="gap-x-2 gap-y-6" layout="masonry" className={className}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <EventCard
            key={i}
            eventName=""
            startDate=""
            loading={true}
            variant="masonry"
          />
        ))}
      </GridContainer>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-center py-10 text-destructive">
        {errorMessage && <p>{errorMessage}</p>}
        {errorDetail && (
          <pre className="text-xs mt-4 text-left max-w-full overflow-auto bg-destructive/10 p-4 rounded text-destructive">
            {errorDetail}
          </pre>
        )}
      </div>
    );
  }

  if (status === 'success' && events.length === 0) {
    return <>{emptyState}</>;
  }

  if (status === 'success' && events.length > 0) {
    return (
      // BUG-038: `display: contents` keeps this wrapper invisible to layout (children
      // participate in the parent's flex/grid exactly as if this div weren't here), while
      // `overflow-anchor: none` on it excludes the whole subtree (cards + sentinel) from CSS
      // scroll-anchoring's anchor-node selection, since exclusion propagates down the DOM to
      // the nearest scroll container (the page body here — there's no dedicated scroll div).
      // This is stronger than excluding the sentinel alone: without it, the browser can anchor
      // to whichever card sits nearest the bottom of the viewport, not just the sentinel.
      <div className="contents [overflow-anchor:none]">
        <GridContainer baseCols={2} colsStep={1} gap="gap-x-2 gap-y-6" layout="masonry" className={className}>
          {events.map((event) => {
            // Story 2.7 — prefer the next-upcoming schedule for display (falling
            // back to the main schedule, then the first schedule), instead of
            // always preferring the main schedule.
            const displaySchedule = selectDisplaySchedule(event.schedules ?? []);
            // Story 2.7 — the display schedule drives the shown date, but price
            // (and by extension any other main-schedule-only field this pattern is
            // applied to) inherits from the main schedule when the picked schedule
            // lacks it (sub-schedules are typically sparser than the main schedule
            // for AI/poster-extracted events).
            const mainSchedule =
              event.schedules?.find((s) => s.isMainSchedule) ?? null;

            const derivedProps = {
              eventName: event.eventName,
              startDate: displaySchedule?.eventStartDate || '',
              startTime: displaySchedule?.eventStartTime ?? null,
              endDate: displaySchedule?.eventEndDate ?? undefined,
              endTime: displaySchedule?.eventEndTime ?? null,
              imageUrl: event.imageUrl ?? undefined,
              // BUG-042 (AC-IMG-1): the imageUrl -> imageFallbackUrl retry chain's second URL —
              // this single derivation point also fixes the Archive page, which routes through
              // this same EventListView/getCardProps composition (no separate Archive mapper).
              imageFallbackUrl: event.durableImageUrl ?? undefined,
              locationName: event.location ?? undefined,
              categories: event.categories ?? [],
              types: event.types ?? [],
              priceFrom:
                displaySchedule?.ticketPrice ??
                mainSchedule?.ticketPrice ??
                undefined,
              prominentPoster: event.durableImageUrl != null,
              labels: cardLabels,
              variant: 'masonry' as const,
            };

            const mergedProps = {
              ...derivedProps,
              ...getCardProps(event),
            };

            return <EventCard key={event.id} {...mergedProps} />;
          })}
        </GridContainer>

        {/*
          Infinite scroll sentinel: kept at consistent height to prevent scroll-anchoring jumps.
          BUG-031 fix: the sentinel's height must not change between loading/loaded states,
          otherwise the browser's scroll-anchoring algorithm can jump when the element shrinks.
          Using min-h-16 ensures the sentinel is tall enough for either the spinner or the
          end-of-list message, preventing height collapse on page load.

          BUG-038 fix: even with a stable sentinel height, the browser's native CSS
          scroll-anchoring can still anchor to this bottom-of-DOM sentinel and, when a new
          page's cards are inserted above it, pull the viewport down to the new bottom of the
          list on every page load. See the `overflow-anchor: none` wrapper above (also
          covers the cards, since an anchored last-card can cause the same jump) — the class
          here is a belt-and-suspenders duplicate directly on the node most likely to be
          picked as the anchor. Validated live against production (see BUG-038 backlog note).
        */}
        <div
          ref={sentinelRef}
          className="min-h-16 py-4 flex justify-center items-center [overflow-anchor:none]"
        >
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              <span>{loadingMoreLabel}</span>
            </div>
          )}
          {!isFetchingNextPage && !hasNextPage && (
            <div className="text-sm text-muted-foreground">
              You've reached the end of the list.
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
