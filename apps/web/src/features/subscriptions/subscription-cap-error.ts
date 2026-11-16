import { mapJobStartError } from '@/features/jobs/job-start-error';

/** The numbers a `SUBSCRIPTION_CAP_REACHED` refusal carries (Story 10.3, reuse and admission control to job start). */
export interface SubscriptionCapRefusal {
  activeCount: number;
  reservedCount: number;
  cap: number;
}

/**
 * Story 10.3a (show the subscription cap refusal and the upgrade call to action) -- the one reader of a cap refusal. It is
 * built on `mapJobStartError` (the single place that knows the shapes of a refused start), so it takes a thrown GraphQL
 * `ClientError` or a start result alike and never parses `extensions` itself. Anything that is not a cap refusal with a
 * numeric `cap` (a network error, SCRAPER_CAPACITY_EXCEEDED, a full queue, a cooldown) returns null.
 */
export function readSubscriptionCapRefusal(input: unknown): SubscriptionCapRefusal | null {
  const failure = mapJobStartError(input);
  if (failure.kind !== 'cap') return null;
  return { activeCount: failure.activeCount, reservedCount: failure.reservedCount, cap: failure.cap };
}
