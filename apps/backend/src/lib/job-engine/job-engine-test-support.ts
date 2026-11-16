import { inArray } from 'drizzle-orm';
import { jobs, users } from '@festgrid/database';
import { registerJobTypeDefinition, type JobTypeDefinition } from '@festgrid/domain/jobs';
import { db } from '../../db/client.js';
import { setInvokeJobEngineWorker, invokeJobEngineWorker } from '../aws/invoke-job-engine-worker.js';

// Story 10.3 -- shared fixtures for the admission suites (real Postgres, fixture job types only). Imported by *.test.ts
// files only; nothing in a Lambda bundle imports it.

export function createFixtures(prefix: string) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userIds: string[] = [];
  const invoked: string[] = [];
  const original = { invoke: invokeJobEngineWorker, scraper: process.env.SCRAPER_FUNCTION_NAME, ai: process.env.AI_PROCESSOR_FUNCTION_NAME };
  let counter = 0;

  return {
    suffix,
    invoked,
    defineType(overrides: Partial<JobTypeDefinition> = {}): string {
      const type = `fixture-${prefix}-${suffix}-${counter++}`;
      registerJobTypeDefinition({ type, host: 'scraper', maxDurationMs: 600_000, ...overrides });
      return type;
    },
    async makeUser(role: 'user' | 'moderator' = 'user'): Promise<string> {
      const [user] = await db
        .insert(users)
        .values({ email: `${prefix}-${suffix}-${userIds.length}@example.test`, role })
        .returning({ id: users.id });
      userIds.push(user.id);
      return user.id;
    },
    /** Stubs the Lambda invoke and the function names; records the job ids that were invoked. */
    stubInvoke(failWith?: Error) {
      process.env.SCRAPER_FUNCTION_NAME = 'test-scraper-fn';
      process.env.AI_PROCESSOR_FUNCTION_NAME = 'test-ai-processor-fn';
      invoked.length = 0;
      setInvokeJobEngineWorker(async (_functionName, payload) => {
        if (failWith) throw failWith;
        invoked.push((payload as { jobId: string }).jobId);
      });
    },
    async cleanup() {
      setInvokeJobEngineWorker(original.invoke);
      if (original.scraper === undefined) delete process.env.SCRAPER_FUNCTION_NAME;
      else process.env.SCRAPER_FUNCTION_NAME = original.scraper;
      if (original.ai === undefined) delete process.env.AI_PROCESSOR_FUNCTION_NAME;
      else process.env.AI_PROCESSOR_FUNCTION_NAME = original.ai;
      if (userIds.length > 0) {
        // jobs and subscriptions cascade with their user (and rows of a SYSTEM job are removed by the tests that make them)
        await db.delete(users).where(inArray(users.id, userIds));
      }
    },
    async deleteJobs(ids: string[]) {
      if (ids.length > 0) await db.delete(jobs).where(inArray(jobs.id, ids));
    },
  };
}
