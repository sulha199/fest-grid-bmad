import type { JobHandler, JobLateResultHandler } from '@festgrid/domain/jobs';

// Story 10.1a -- the handler registry of the job engine (AD-53). The same `Map`-registry shape as
// lib/scraper/profile-scraper.ts's adapter map and register-adapters.ts. A handler is registered only inside its
// OWN host Lambda (the AI-processor's bundle carries `sharp`/`face-api`, the scraper's carries the vendor adapters);
// the API Lambda never imports a handler, it only reads the pure `JobTypeDefinition` from `@festgrid/domain/jobs`.
// This story registers no real job type: the adoption stories (10.6, 10.7, 10.9 to 10.12a) do.
const handlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

export function getJobHandler(type: string): JobHandler | undefined {
  return handlers.get(type);
}

// Story 10.5 -- the second registry: a job type's handler for a vendor result that arrives after the job's own run ended (FR119),
// registered only in the Scraper Lambda (which collects late Bright Data snapshots). No real type registers one in this story:
// Story 10.6's moderator re-extract saves the fresh image links to `posts` through it.
const lateResultHandlers = new Map<string, JobLateResultHandler>();

export function registerLateResultHandler(type: string, handler: JobLateResultHandler): void {
  lateResultHandlers.set(type, handler);
}

export function getLateResultHandler(type: string): JobLateResultHandler | undefined {
  return lateResultHandlers.get(type);
}
