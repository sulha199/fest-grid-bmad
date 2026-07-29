import type { EventInfo, Schedule } from '@festgrid/shared-types';

export interface DiscoveryFilterOptions {
  now?: Date;
  pageSize?: number;
}

export interface DiscoveryPageResult {
  items: EventInfo[];
  hasMore: boolean;
}

function toDateValue(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function getPrimarySchedule(event: EventInfo): Schedule | undefined {
  return event.schedules.find((schedule) => schedule.isMainSchedule) ?? event.schedules[0];
}

export function filterDiscoveryEvents(events: EventInfo[], options: DiscoveryFilterOptions = {}): EventInfo[] {
  const now = options.now ?? new Date();

  return events.filter((event) => {
    const schedule = getPrimarySchedule(event);
    if (!schedule?.eventStartDate) {
      return false;
    }

    const startDate = toDateValue(schedule.eventStartDate);
    const endDate = schedule.eventEndDate ? toDateValue(schedule.eventEndDate) : undefined;

    if (startDate > now) {
      return true;
    }

    if (endDate) {
      return endDate >= now;
    }

    return false;
  });
}

export function paginateDiscoveryEvents(events: EventInfo[], page: number, pageSize = 10): EventInfo[] {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  return events.slice(start, end);
}

export function getDiscoveryPage(events: EventInfo[], page: number, options: DiscoveryFilterOptions = {}): DiscoveryPageResult {
  const filtered = filterDiscoveryEvents(events, options);
  const items = paginateDiscoveryEvents(filtered, page, options.pageSize ?? 10);
  return {
    items,
    hasMore: items.length > 0 && page * (options.pageSize ?? 10) < filtered.length,
  };
}
