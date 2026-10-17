// Parent types for the GraphQL object types whose resolvers return database rows rather than the
// GraphQL shape (Date columns serialised by field resolvers, columns selected dynamically from the
// requested fields, computed fields supplied by field resolvers). graphql-codegen picks these up
// through the `mappers` option in apps/backend/codegen.ts, so a resolver's `parent` and return type
// are checked against the row it really handles instead of being typed `any`.
import type {
  socialMediaAccountProfiles,
  subscriptions,
  events,
  reports,
  widgets,
  aiEventFilters,
  accountVotes,
  embedDomains,
  schedules,
  unprocessedScraperPayloads,
} from '@festgrid/database';
import type { OptimizedRow } from '@festgrid/graphql-select';
import type { AccountActivity } from './accounts/load-account-activity.js';

/** Profile rows are selected dynamically (see `buildOptimizedDrizzleSelect`), so only `id` is certain. */
export type SocialMediaAccountProfileParent = OptimizedRow<typeof socialMediaAccountProfiles> & { id: string };

/** A subscription row; `__activity` memoises the per-request account-activity lookup. */
export type SubscriptionParent = OptimizedRow<typeof subscriptions> & {
  accountId: string;
  __activity?: Promise<AccountActivity>;
};

/** Schedule rows are selected dynamically, like profiles. */
export type ScheduleParent = OptimizedRow<typeof schedules> & { id: string; isAddedToCalendar?: boolean };

/**
 * An event row as the event resolvers build it: the selected `events` columns plus the columns joined
 * from the source post and account (served image URLs, source links, storage opt-in) and the
 * schedules preloaded by the batch loaders.
 */
export type EventParent = OptimizedRow<typeof events> & {
  id: string;
  imageUrl?: string | null;
  durableImageUrl?: string | null;
  durableThumbnailUrl?: string | null;
  imageUrlExpiresAt?: Date | null;
  videoUrl?: string | null;
  sourcePostUrl?: string | null;
  originalPostUrl?: string | null;
  publishedAt?: Date | string | null;
  isImageStorageOptedIn?: boolean | null;
  schedules?: ScheduleParent[];
  // Resolver-internal marker set by the windowed `Query.events` branch (never exposed in the schema).
  __schedulesPreloaded?: ScheduleParent[];
  // Preloaded by the batch loaders when the same query already knows them; otherwise the field
  // resolvers look them up per row.
  isFavorited?: boolean;
  favoriteCount?: number;
  isAddedToCalendar?: boolean;
};

export type ReportParent = OptimizedRow<typeof reports> & { id: string; eventId: string };
export type WidgetParent = WithTimestamps<OptimizedRow<typeof widgets>>;
export type AIEventFilterParent = WithTimestamps<OptimizedRow<typeof aiEventFilters>>;

// Stored rows hold Date columns, while mutations return the same shape with ISO strings already applied;
// the createdAt/deletedAt field resolvers accept either.
type WithTimestamps<TRow> = Omit<TRow, 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  id: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  deletedAt: Date | string | null;
};
export type AccountVoteParent = WithTimestamps<OptimizedRow<typeof accountVotes>>;
export type EmbedDomainParent = WithTimestamps<OptimizedRow<typeof embedDomains>>;

/** One ranked account: the profile is loaded by the `profile` field resolver when it is not already attached. */
export type RankedAccountVoteParent = {
  profile?: SocialMediaAccountProfileParent;
  accountId?: string;
  profileId?: string;
  voteCount: number;
  userVoteId?: string | null;
};

/** Coordinates arrive as either `lat`/`lng` or `latitude`/`longitude` depending on the source. */
export type CoordinatesParent = { lat?: number; lng?: number; latitude?: number; longitude?: number };

/** A stored unprocessed scraper payload; its `context` column is untyped JSON read by `PayloadContext`. */
export type UnprocessedScraperPayloadParent = OptimizedRow<typeof unprocessedScraperPayloads> & { id: string };
export type PayloadContextParent = { source?: string | null };
