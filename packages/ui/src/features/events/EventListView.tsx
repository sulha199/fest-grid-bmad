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
  loadingMoreLabel,
  skeletonCount = 6,
  className,
}: EventListViewProps<TEvent>) {
  if (status === 'loading') {
    return (
      <GridContainer baseCols={2} colsStep={1} gap="gap-x-2 gap-y-6" className={className}>
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
      <>
        <GridContainer baseCols={2} colsStep={1} gap="gap-x-2 gap-y-6" className={className}>
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

        <div ref={sentinelRef} className="py-4 flex justify-center">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              <span>{loadingMoreLabel}</span>
            </div>
          )}
        </div>
      </>
    );
  }

  return null;
}
