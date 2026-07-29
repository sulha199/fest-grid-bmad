import type { EventInfo } from '@festgrid/shared-types';
import { CalendarDays, MapPin } from 'lucide-react';

export interface EventCardProps {
  event: EventInfo;
}

function formatDate(value?: string): string {
  if (!value) {
    return 'TBD';
  }

  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function EventCard({ event }: EventCardProps) {
  const schedule = event.schedules.find((item) => item.isMainSchedule) ?? event.schedules[0];

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="aspect-[4/3] bg-muted" />
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <h2 className="line-clamp-2 text-lg font-semibold">{event.eventName}</h2>
          <p className="text-sm text-muted-foreground">{event.location}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span>{formatDate(schedule?.eventStartDate)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{event.location}</span>
        </div>
      </div>
    </article>
  );
}
