import type { EventInfo } from '@festgrid/shared-types';
import { EventCard } from './EventCard';

export interface EventGridProps {
  events: EventInfo[];
}

export function EventGrid({ events }: EventGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
