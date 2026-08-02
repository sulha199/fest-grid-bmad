import { Resolvers } from '../generated/resolvers-types.js';
import { db } from '../db/client.js';
import { events, schedules, posts, users, favorites, calendarAdditions } from '@festgrid/database';
import { buildOptimizedDrizzleSelect, buildDrizzleWhere } from '@festgrid/graphql-select';
import { requireAuth } from '../lib/auth/context.js';
import { eq, count, sql, asc, and, exists, isNull } from 'drizzle-orm';
import { QueryCondition } from '@festgrid/domain/query';
import { GraphQLJSON } from 'graphql-scalars';
import { GraphQLError } from 'graphql';

export const resolvers: Resolvers = {
  JSON: GraphQLJSON,
  Mutation: {
    toggleFavorite: async (_: any, { eventId }: any, context: any) => {
      const authUser = requireAuth(context);
      
      return await db.transaction(async (tx) => {
        const existingRows = await tx.select().from(favorites)
          .where(and(eq(favorites.userId, authUser.userId), eq(favorites.eventId, eventId)));
        
        if (existingRows.length > 0) {
          const existing = existingRows[0];
          if (existing.deletedAt === null) {
            // Unfavorite: set deletedAt
            await tx.update(favorites)
              .set({ deletedAt: new Date() })
              .where(eq(favorites.id, existing.id));
            return { eventId, isFavorited: false };
          } else {
            // Re-favorite: clear deletedAt
            await tx.update(favorites)
              .set({ deletedAt: null })
              .where(eq(favorites.id, existing.id));
            return { eventId, isFavorited: true };
          }
        } else {
          // Insert new
          await tx.insert(favorites).values({
            userId: authUser.userId,
            eventId,
          });
          return { eventId, isFavorited: true };
        }
      });
    },
    toggleCalendarAddition: async (_: any, { eventId, scheduleId }: any, context: any) => {
      const authUser = requireAuth(context);
      
      return await db.transaction(async (tx) => {
        const scheduleRows = await tx.select().from(schedules).where(eq(schedules.id, scheduleId));
        if (scheduleRows.length === 0) {
          throw new GraphQLError('Schedule not found', { extensions: { code: 'NOT_FOUND' } });
        }
        
        const schedule = scheduleRows[0];
        if (schedule.eventId !== eventId) {
          throw new GraphQLError('Event ID mismatch', { extensions: { code: 'BAD_REQUEST' } });
        }

        const existingRows = await tx.select().from(calendarAdditions)
          .where(and(eq(calendarAdditions.userId, authUser.userId), eq(calendarAdditions.scheduleId, scheduleId)));
        
        if (existingRows.length > 0) {
          const existing = existingRows[0];
          if (existing.deletedAt === null) {
            // Remove from calendar: set deletedAt
            await tx.update(calendarAdditions)
              .set({ deletedAt: new Date() })
              .where(eq(calendarAdditions.id, existing.id));
            return { eventId, scheduleId, isAddedToCalendar: false };
          } else {
            // Re-add to calendar: clear deletedAt
            await tx.update(calendarAdditions)
              .set({ deletedAt: null })
              .where(eq(calendarAdditions.id, existing.id));
            return { eventId, scheduleId, isAddedToCalendar: true };
          }
        } else {
          // Insert new
          await tx.insert(calendarAdditions).values({
            userId: authUser.userId,
            eventId,
            scheduleId,
          });
          return { eventId, scheduleId, isAddedToCalendar: true };
        }
      });
    }
  },
  Query: {
    health: () => true,
    me: async (_: any, __: any, context: any) => {
      const authUser = requireAuth(context);
      const rows = await db.select({
        id: users.id,
        email: users.email,
        role: users.role,
      }).from(users).where(eq(users.id, authUser.userId));

      if (rows.length === 0) {
        throw new Error('User not found');
      }
      return rows[0];
    },
    events: async (_: any, { query, limit, offset }: any, context: any, info: any) => {
      // Create field map for DSL
      // Check auth silently for filter correlations
      let userId: string | null = null;
      try {
        const authUser = requireAuth(context);
        userId = authUser.userId;
      } catch {
        // Not authenticated
      }

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
        scheduleLocation: schedules.location, // to support filtering by schedule location
        isFavorited: userId ? exists(
          db.select({ id: favorites.id })
            .from(favorites)
            .where(and(
              eq(favorites.userId, userId),
              eq(favorites.eventId, events.id),
              isNull(favorites.deletedAt)
            ))
        ) : sql`false`,
        isAddedToCalendar: userId ? exists(
          db.select({ id: calendarAdditions.id })
            .from(calendarAdditions)
            .where(and(
              eq(calendarAdditions.userId, userId),
              eq(calendarAdditions.eventId, events.id),
              isNull(calendarAdditions.deletedAt)
            ))
        ) : sql`false`
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
        postId: events.postId,
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
        postId: events.postId,
      }).from(events).where(eq(events.id, id));

      return (rows[0] as any) || null;
    },
    eventBySlug: async (_: any, { slug }: any, context: any, info: any) => {
      const requestedFields = buildOptimizedDrizzleSelect(events, info);
      const rows = await db.select({
        ...requestedFields,
        id: events.id,
        postId: events.postId,
        slug: events.slug,
      }).from(events).where(eq(events.slug, slug));

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
    },
    imageUrl: async (parent: any) => {
      if (!parent.postId) return null;
      const rows = await db.select({ imageUrl: posts.imageUrl }).from(posts).where(eq(posts.id, parent.postId));
      return rows[0]?.imageUrl || null;
    },
    sourcePostUrl: async (parent: any) => {
      if (!parent.postId) return null;
      const rows = await db.select({ postUrl: posts.postUrl }).from(posts).where(eq(posts.id, parent.postId));
      return rows[0]?.postUrl || null;
    },
    originalPostUrl: () => null,
    isFavorited: async (parent: any, _: any, context: any) => {
      try {
        const authUser = requireAuth(context);
        const rows = await db.select({ id: favorites.id })
          .from(favorites)
          .where(and(
            eq(favorites.userId, authUser.userId),
            eq(favorites.eventId, parent.id),
            isNull(favorites.deletedAt)
          ));
        return rows.length > 0;
      } catch {
        return false;
      }
    },
    isAddedToCalendar: async (parent: any, _: any, context: any) => {
      try {
        const authUser = requireAuth(context);
        const rows = await db.select({ id: calendarAdditions.id })
          .from(calendarAdditions)
          .where(and(
            eq(calendarAdditions.userId, authUser.userId),
            eq(calendarAdditions.eventId, parent.id),
            isNull(calendarAdditions.deletedAt)
          ));
        return rows.length > 0;
      } catch {
        return false;
      }
    }
  },
  Schedule: {
    isAddedToCalendar: async (parent: any, _: any, context: any) => {
      try {
        const authUser = requireAuth(context);
        const rows = await db.select({ id: calendarAdditions.id })
          .from(calendarAdditions)
          .where(and(
            eq(calendarAdditions.userId, authUser.userId),
            eq(calendarAdditions.scheduleId, parent.id),
            isNull(calendarAdditions.deletedAt)
          ));
        return rows.length > 0;
      } catch {
        return false;
      }
    }
  }
};
