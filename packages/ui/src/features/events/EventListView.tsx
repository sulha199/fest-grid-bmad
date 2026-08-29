import { EventCard } from './EventCard';
import { EventListViewItem, EventListViewProps } from './EventListView.types';
import { GridContainer } from '../../core/grid-container';

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
  viewMode = 'list',
}: EventListViewProps<TEvent>) {
  if (status === 'loading') {
    return (
      <GridContainer baseCols={viewMode === 'masonry' ? 2 : 1} colsStep={1} gap={viewMode === 'masonry' ? "gap-2" : "gap-6"} className={className}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <EventCard
            key={i}
            eventName=""
            startDate=""
            loading={true}
            variant={viewMode === 'masonry' ? 'masonry' : 'standard'}
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
        <GridContainer baseCols={viewMode === 'masonry' ? 2 : 1} colsStep={1} gap={viewMode === 'masonry' ? "gap-2" : "gap-6"} className={className}>
          {events.map((event) => {
            const mainSchedule =
              event.schedules?.find((s) => s.isMainSchedule) ||
              event.schedules?.[0];

            const derivedProps = {
              eventName: event.eventName,
              startDate: mainSchedule?.eventStartDate || '',
              imageUrl: event.imageUrl ?? undefined,
              locationName: event.location ?? undefined,
              categories: event.categories ?? [],
              types: event.types ?? [],
              priceFrom: mainSchedule?.ticketPrice ?? undefined,
              labels: cardLabels,
              variant: (viewMode === 'masonry' ? 'masonry' : 'standard') as 'standard' | 'masonry',
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
