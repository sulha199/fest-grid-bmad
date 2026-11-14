import { describe, expect, it } from 'vitest';
import { ClientError } from 'graphql-request';
import { readSubscriptionCapRefusal } from './subscription-cap-error';

const clientError = (extensions: Record<string, unknown>) =>
  new ClientError({ status: 200, errors: [{ message: 'Server English text', extensions }] } as never, { query: 'mutation X { x }' });

describe('readSubscriptionCapRefusal', () => {
  it('reads a thrown ClientError with the exact extensions shape of the backend error', () => {
    expect(readSubscriptionCapRefusal(clientError({ code: 'SUBSCRIPTION_CAP_REACHED', activeCount: 3, reservedCount: 2, cap: 5 }))).toEqual({ activeCount: 3, reservedCount: 2, cap: 5 });
  });

  it('reads a start result (RetryJobResult shape)', () => {
    expect(readSubscriptionCapRefusal({ outcome: 'REFUSED', errorCode: 'SUBSCRIPTION_CAP_REACHED', activeCount: 5, reservedCount: 0, cap: 5, job: null })).toEqual({ activeCount: 5, reservedCount: 0, cap: 5 });
  });

  it('reads a user above the cap (7 of 5)', () => {
    expect(readSubscriptionCapRefusal(clientError({ code: 'SUBSCRIPTION_CAP_REACHED', activeCount: 7, reservedCount: 0, cap: 5 }))).toEqual({ activeCount: 7, reservedCount: 0, cap: 5 });
  });

  it('missing counts read as 0', () => {
    expect(readSubscriptionCapRefusal(clientError({ code: 'SUBSCRIPTION_CAP_REACHED', cap: 5 }))).toEqual({ activeCount: 0, reservedCount: 0, cap: 5 });
    expect(readSubscriptionCapRefusal({ errorCode: 'SUBSCRIPTION_CAP_REACHED', activeCount: null, reservedCount: null, cap: 5 })).toEqual({ activeCount: 0, reservedCount: 0, cap: 5 });
  });

  it('a refusal without a numeric cap is not a cap refusal (generic)', () => {
    expect(readSubscriptionCapRefusal(clientError({ code: 'SUBSCRIPTION_CAP_REACHED', activeCount: 5, reservedCount: 0 }))).toBeNull();
    expect(readSubscriptionCapRefusal({ errorCode: 'SUBSCRIPTION_CAP_REACHED', cap: null })).toBeNull();
  });

  it('returns null for every other code, a network error and nonsense', () => {
    expect(readSubscriptionCapRefusal(clientError({ code: 'SCRAPER_CAPACITY_EXCEEDED' }))).toBeNull();
    expect(readSubscriptionCapRefusal(clientError({ code: 'JOB_QUEUE_FULL', maxQueued: 10 }))).toBeNull();
    expect(readSubscriptionCapRefusal(clientError({ code: 'COOLDOWN' }))).toBeNull();
    expect(readSubscriptionCapRefusal(new TypeError('Failed to fetch'))).toBeNull();
    expect(readSubscriptionCapRefusal(null)).toBeNull();
    expect(readSubscriptionCapRefusal(undefined)).toBeNull();
    expect(readSubscriptionCapRefusal('SUBSCRIPTION_CAP_REACHED')).toBeNull();
  });
});
