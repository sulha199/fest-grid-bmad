import { Resolvers } from '../generated/resolvers-types.js';
import { db } from '../db/client.js';
import { events, schedules } from '@festgrid/database';
import { buildOptimizedDrizzleSelect, buildDrizzleWhere } from '@festgrid/graphql-select';
import { eq, count, sql, asc, and } from 'drizzle-orm';
import { QueryCondition } from '@festgrid/domain/query';
import { GraphQLJSON } from 'graphql-scalars';

export const resolvers: Resolvers = {
  JSON: GraphQLJSON,
  Query: {
    health: () => true,
    events: async (_: any, { query, limit, offset }: any, context: any, info: any) => {
      // Create field map for DSL
      const fieldMap = {
        eventName: events.eventName,
        description: events.description,
        location: events.location,
        types: events.types,
        categories: events.categories,
        sourceSocialMediaAccountId: events.sourceSocialMediaAccountId,
        postId: events.postId,
        performers: schedules.performers, // mapped to joined table
        scheduleLocation: schedules.location // to support filtering by schedule location
      };

      const whereClause = buildDrizzleWhere(query as QueryCondition, fieldMap);
      
      const qLimit = limit ?? 20;
      const qOffset = offset ?? 0;

      const requestedFields = buildOptimizedDrizzleSelect(events, info, {
        path: 'items',
      });

      // Note: to filter on schedules' columns safely with a left join, or sort, we filter schedules in the join or where clause.
      // The AC specifies: "default sort order... is by the event's main schedule's eventStartDate/eventStartTime ascending".
      // Let's ensure we only join main schedules for sorting/filtering.
      // Wait, AC1: "join schedules (filtered isMainSchedule = true) for the default sort key"
      
      const mainSchedulesOnly = and(
        eq(events.id, schedules.eventId),
        eq(schedules.isMainSchedule, true)
      );

      const itemsQuery = db.select({
        ...requestedFields,
        id: events.id,
      }).from(events)
        .leftJoin(schedules, mainSchedulesOnly)
        .$dynamic();

      if (whereClause) {
        itemsQuery.where(whereClause as any);
      }

      itemsQuery.orderBy(asc(schedules.eventStartDate), asc(schedules.eventStartTime));
      itemsQuery.limit(qLimit + 1).offset(qOffset);

      const fetchedItems = await itemsQuery;

      const hasMore = fetchedItems.length > qLimit;
      const items = hasMore ? fetchedItems.slice(0, qLimit) : fetchedItems;

      // Note: Count query could be expensive, but required by schema.
      // If full schema optimization is needed, count should only be fetched if selected.
      const totalCountRes = await db.select({ count: count() as any })
        .from(events)
        .leftJoin(schedules, mainSchedulesOnly)
        .where(whereClause as any);
      const totalCount = totalCountRes[0]?.count ?? 0;

      return {
        items: items as any, // Cast since buildOptimizedDrizzleSelect returns partial shapes
        hasMore,
        totalCount
      };
    },
    event: async (_: any, { id }: any, context: any, info: any) => {
      const requestedFields = buildOptimizedDrizzleSelect(events, info);
      const rows = await db.select({
        ...requestedFields,
        id: events.id,
      }).from(events).where(eq(events.id, id));

      return (rows[0] as any) || null;
    }
  },
  Event: {
    schedules: async (parent: any, args: any, context: any, info: any) => {
      const requestedFields = buildOptimizedDrizzleSelect(schedules, info);
      const rows = await db.select({
        ...requestedFields,
        id: schedules.id
      }).from(schedules).where(eq(schedules.eventId, parent.id));
      return rows as any;
    }
  }
};
