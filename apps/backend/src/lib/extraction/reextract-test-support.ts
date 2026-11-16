import { eq, inArray } from 'drizzle-orm';
import {
  eventMatchCandidates,
  eventPosts,
  eventSlugAliases,
  events,
  favorites,
  jobs,
  postAccountAssociations,
  posts,
  schedules,
  socialMediaAccountProfiles,
  users,
} from '@festgrid/database';
import { REEXTRACT_POST_JOB_TYPE, reextractPostInputKey, type JobHandlerContext } from '@festgrid/domain/jobs';
import type { PostScraperAdapter, ScrapedPost } from '@festgrid/domain';
import { db } from '../../db/client.js';
import { getPostScraperAdapters, registerPostScraperAdapter } from '../scraper/post-scraper-registry.js';
import { setProviderSkipReason } from '../scraper/post-scraper.js';
import '../scraper/register-adapters.js';

// Story 10.6 -- shared fixtures for the re-extract suites (real Postgres, fake vendors, no vendor call, no Lambda invoke). Imported by
// *.test.ts files only; nothing in a Lambda bundle imports it. Every row it creates is removed by `cleanup()` (row-count ratchet).

export type FakeBehaviour = (url: string, ctx: { budgetMs: number }) => Promise<ScrapedPost | null>;

export function createReextractFixtures(prefix: string) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userIds: string[] = [];
  const accountIds: string[] = [];
  const postIds: string[] = [];
  const originalAdapters = new Map(getPostScraperAdapters().map((a) => [a.name, a]));
  const skipReasons = new Map<string, 'quota' | 'degraded'>();
  const calls: string[] = [];
  setProviderSkipReason(async (provider) => skipReasons.get(provider) ?? null);
  const originalOrder = process.env.POST_SCRAPER_PROVIDER_ORDER;
  const hexOf = (d: Date) => Math.floor(d.getTime() / 1000).toString(16);
  const urlCache = new Map<string, string>();
  const memo = (key: string, build: () => string) => urlCache.get(key) ?? (urlCache.set(key, build()), urlCache.get(key)!);

  const fx = {
    suffix,
    calls,
    skipReasons,
    /** A link whose own `oe` says it expired three days ago. Memoized: the same key is the same string. */
    expiredUrl: (key: string) => memo(`e-${key}`, () => `https://cdn.example.com/${key}.jpg?oe=${hexOf(new Date(Date.now() - 3 * 86_400_000))}`),
    /** A valid full-size link (expires in three days). */
    freshUrl: (key: string) => memo(`f-${key}`, () => `https://cdn.example.com/${key}.jpg?oe=${hexOf(new Date(Date.now() + 3 * 86_400_000))}`),
    /** A valid 640 px link, the size Bright Data returns. */
    lowResUrl: (key: string) =>
      memo(`l-${key}`, () => `https://cdn.example.com/${key}.jpg?stp=dst-jpg_e35_s640x640_sh0.08_tt6&oe=${hexOf(new Date(Date.now() + 3 * 86_400_000))}`),

    async makeUser(role: 'user' | 'moderator' = 'moderator'): Promise<string> {
      const [user] = await db.insert(users).values({ email: `${prefix}-${suffix}-${userIds.length}@example.test`, role }).returning({ id: users.id });
      userIds.push(user.id);
      return user.id;
    },
    async makeAccount(overrides: Partial<typeof socialMediaAccountProfiles.$inferInsert> = {}) {
      const n = accountIds.length;
      const [account] = await db
        .insert(socialMediaAccountProfiles)
        .values({ accountId: `acc-${prefix}-${suffix}-${n}`, platform: 'instagram', displayName: 'Reextract', username: `${prefix}_${n}_${suffix.replace(/\W/g, '')}`, ...overrides })
        .returning();
      accountIds.push(account.id);
      return account;
    },
    async makePost(accountId: string, overrides: Partial<typeof posts.$inferInsert> = {}) {
      const n = postIds.length;
      const platformPostId = `${prefix}${n}x${suffix.replace(/\W/g, '')}`;
      const [post] = await db
        .insert(posts)
        .values({
          accountId,
          platform: 'instagram',
          postUrl: `https://www.instagram.com/p/${platformPostId}/`,
          platformPostId,
          platformPostType: 'p',
          publishedAt: new Date('2026-10-01T00:00:00Z'),
          content: 'A stored caption that must never leave the post row',
          ...overrides,
        })
        .returning();
      postIds.push(post.id);
      await db.insert(postAccountAssociations).values({ postId: post.id, accountId, role: 'PUBLISHER' });
      return post;
    },
    readPost: async (id: string) => (await db.select().from(posts).where(eq(posts.id, id)))[0],
    /** An admitted RUNNING engine job for a post, as the worker would have claimed it. */
    async makeJob(postId: string, ownerUserId: string, overrides: Partial<typeof jobs.$inferInsert> = {}) {
      const [job] = await db
        .insert(jobs)
        .values({
          type: REEXTRACT_POST_JOB_TYPE,
          ownerUserId,
          trigger: 'USER',
          inputKey: reextractPostInputKey(postId),
          input: { postId },
          status: 'RUNNING',
          admittedAt: new Date(),
          deadlineAt: new Date(Date.now() + 600_000),
          ...overrides,
        })
        .returning();
      return job;
    },
    readJob: async (id: string) => (await db.select().from(jobs).where(eq(jobs.id, id)))[0],

    /** Replaces a vendor's post adapter with a fake that records its calls. */
    fakeAdapter(name: 'apify' | 'brightdata', behaviour: FakeBehaviour, minBudgetMs = 0): void {
      const adapter: PostScraperAdapter = {
        name,
        minBudgetMs,
        fetchPost: async (url, ctx) => {
          calls.push(name);
          return behaviour(url, ctx);
        },
      };
      registerPostScraperAdapter(adapter);
    },
    /** A handler context that records the phase writes and the hand-off instead of invoking a Lambda. */
    handlerContext(job: { id: string; input: unknown; phase?: string | null }, remainingMs = 150_000) {
      const record = { phases: [] as string[], handedOffTo: [] as string[] };
      const ctx: JobHandlerContext = {
        jobId: job.id,
        input: job.input,
        phase: job.phase ?? null,
        getRemainingTimeInMillis: () => remainingMs,
        signal: new AbortController().signal,
        setPhase: async (phase) => {
          record.phases.push(phase);
          await db.update(jobs).set({ phase }).where(eq(jobs.id, job.id));
        },
        handOffToLambda: async (functionName) => {
          record.handedOffTo.push(functionName);
        },
      };
      return { ctx, record };
    },

    reset() {
      calls.length = 0;
      skipReasons.clear();
      delete process.env.POST_SCRAPER_PROVIDER_ORDER;
      for (const adapter of originalAdapters.values()) registerPostScraperAdapter(adapter);
    },
    async cleanup() {
      for (const adapter of originalAdapters.values()) registerPostScraperAdapter(adapter);
      if (originalOrder === undefined) delete process.env.POST_SCRAPER_PROVIDER_ORDER;
      else process.env.POST_SCRAPER_PROVIDER_ORDER = originalOrder;
      if (postIds.length > 0) {
        // Events an Apply created are found through their links to the fixture posts.
        const eventIds = (await db.select({ eventId: eventPosts.eventId }).from(eventPosts).where(inArray(eventPosts.postId, postIds))).map((r) => r.eventId);
        if (eventIds.length > 0) {
          await db.delete(eventMatchCandidates).where(inArray(eventMatchCandidates.eventId, eventIds));
          await db.delete(favorites).where(inArray(favorites.eventId, eventIds));
          await db.delete(eventSlugAliases).where(inArray(eventSlugAliases.eventId, eventIds));
          await db.delete(schedules).where(inArray(schedules.eventId, eventIds));
          await db.delete(eventPosts).where(inArray(eventPosts.eventId, eventIds));
          await db.delete(events).where(inArray(events.id, eventIds));
        }
        await db.delete(postAccountAssociations).where(inArray(postAccountAssociations.postId, postIds));
        await db.delete(posts).where(inArray(posts.id, postIds));
      }
      if (userIds.length > 0) await db.delete(users).where(inArray(users.id, userIds)); // jobs, attempts and snapshot links cascade
      if (accountIds.length > 0) await db.delete(socialMediaAccountProfiles).where(inArray(socialMediaAccountProfiles.id, accountIds));
    },
  };
  return fx;
}
