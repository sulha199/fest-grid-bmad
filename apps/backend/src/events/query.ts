import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { events, schedules } from '@festgrid/database';
import { getDiscoveryPage } from '@festgrid/domain';
import type { EventInfo, EventCategory, EventType, Schedule } from '@festgrid/shared-types';
import { applyEventQueryDsl, type EventQueryDsl } from './dsl';

export type { EventQueryDsl, EventQueryNode, EventQueryGroup, EventQueryTerminal } from './dsl';

interface EventQueryRow {
  id: string;
  slug: string;
  eventName: string;
  types: string[] | null;
  categories: string[] | null;
  location: string;
  organizerName: string | null;
  description: string | null;
  scheduleId: string | null;
  scheduleSlug: string | null;
  isMainSchedule: boolean | null;
  eventStartDate: string | null;
  eventEndDate: string | null;
  eventStartTime: string | null;
  eventEndTime: string | null;
  title: string | null;
  performers: string[] | null;
  scheduleLocation: string | null;
  ticketPrice: string | null;
}

function mapSchedule(row: EventQueryRow): Schedule {
  return {
    id: row.scheduleId ?? '',
    slug: row.scheduleSlug ?? '',
    isMainSchedule: row.isMainSchedule ?? false,
    eventStartDate: row.eventStartDate ?? '',
    eventEndDate: row.eventEndDate ?? undefined,
    eventStartTime: row.eventStartTime ?? undefined,
    eventEndTime: row.eventEndTime ?? undefined,
    title: row.title ?? undefined,
    performers: row.performers ?? undefined,
    location: row.scheduleLocation ?? undefined,
    ticketPrice: row.ticketPrice ?? undefined,
  };
}

function mapEvent(row: EventQueryRow, schedulesForEvent: Schedule[]): EventInfo {
  return {
    id: row.id,
    slug: row.slug,
    isEvent: true,
    eventName: row.eventName,
    types: (row.types ?? []).map((value) => value as EventType),
    categories: (row.categories ?? []).map((value) => value as EventCategory),
    location: row.location,
    organizerName: row.organizerName ?? undefined,
    description: row.description ?? undefined,
    schedules: schedulesForEvent,
  };
}

/**
 * Fetches every event and its schedules, applies the Unified Query DSL filter,
 * then applies the ongoing/upcoming + pagination rules from `@festgrid/domain`.
 *
 * NOTE: this currently selects a fixed set of columns rather than the dynamic,
 * requested-field-only selection required by project-context.md
 * (`buildOptimizedDrizzleSelect`). Tracked as deferred work.
 */
export async function getEventsForQuery(query?: EventQueryDsl, page = 1, pageSize = 6): Promise<{ items: EventInfo[]; hasMore: boolean }> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    const rows: EventQueryRow[] = await db
      .select({
        id: events.id,
        slug: events.slug,
        eventName: events.eventName,
        types: events.types,
        categories: events.categories,
        location: events.location,
        organizerName: events.organizerName,
        description: events.description,
        scheduleId: schedules.id,
        scheduleSlug: schedules.slug,
        isMainSchedule: schedules.isMainSchedule,
        eventStartDate: schedules.eventStartDate,
        eventEndDate: schedules.eventEndDate,
        eventStartTime: schedules.eventStartTime,
        eventEndTime: schedules.eventEndTime,
        title: schedules.title,
        performers: schedules.performers,
        scheduleLocation: schedules.location,
        ticketPrice: schedules.ticketPrice,
      })
      .from(events)
      .leftJoin(schedules, eq(schedules.eventId, events.id))
      .orderBy(events.eventName);

    const grouped = new Map<string, { row: EventQueryRow; schedules: EventQueryRow[] }>();
    for (const row of rows) {
      const existing = grouped.get(row.id);
      if (existing) {
        if (row.scheduleId) {
          existing.schedules.push(row);
        }
      } else {
        grouped.set(row.id, { row, schedules: row.scheduleId ? [row] : [] });
      }
    }

    const items = Array.from(grouped.values()).map(({ row, schedules: schedulesForEvent }) =>
      mapEvent(row, schedulesForEvent.map(mapSchedule)),
    );

    const filtered = applyEventQueryDsl(items, query);
    return getDiscoveryPage(filtered, page, { pageSize });
  } finally {
    await client.end();
  }
}

export async function getDiscoveryEvents(page = 1, pageSize = 6): Promise<{ items: EventInfo[]; hasMore: boolean }> {
  return getEventsForQuery(undefined, page, pageSize);
}
