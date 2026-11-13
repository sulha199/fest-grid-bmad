import { describe, expect, it } from 'vitest';
import { mapJobStartError } from './job-start-error';

describe('mapJobStartError', () => {
  it('maps queue full with the maximum', () => {
    expect(mapJobStartError({ errorCode: 'JOB_QUEUE_FULL', maxQueued: 10 })).toEqual({ kind: 'queue-full', maxQueued: 10 });
    expect(mapJobStartError({ errorCode: 'JOB_QUEUE_FULL' })).toEqual({ kind: 'queue-full', maxQueued: null });
  });
  it('maps the subscription cap with its numbers, from a result or from a thrown GraphQL error', () => {
    expect(mapJobStartError({ errorCode: 'SUBSCRIPTION_CAP_REACHED', activeCount: 3, reservedCount: 2, cap: 5 })).toEqual({ kind: 'cap', activeCount: 3, reservedCount: 2, cap: 5 });
    const thrown = { response: { errors: [{ extensions: { code: 'SUBSCRIPTION_CAP_REACHED', activeCount: 7, cap: 5 } }] } };
    expect(mapJobStartError(thrown)).toEqual({ kind: 'cap', activeCount: 7, reservedCount: 0, cap: 5 });
  });
  it('maps a cooldown with its time', () => {
    expect(mapJobStartError({ errorCode: 'COOLDOWN', retryNotBefore: '2026-11-13T14:42:00.000Z' })).toEqual({ kind: 'cooldown', retryNotBefore: '2026-11-13T14:42:00.000Z' });
    expect(mapJobStartError({ errorCode: 'COOLDOWN' })).toEqual({ kind: 'cooldown', retryNotBefore: null });
  });
  it('maps everything else, including a cap with no number, an Error and junk, to the generic message', () => {
    expect(mapJobStartError({ errorCode: 'JOB_START_FAILED' })).toEqual({ kind: 'generic' });
    expect(mapJobStartError({ errorCode: 'SUBSCRIPTION_CAP_REACHED' })).toEqual({ kind: 'generic' });
    expect(mapJobStartError(new Error('boom'))).toEqual({ kind: 'generic' });
    expect(mapJobStartError(null)).toEqual({ kind: 'generic' });
    expect(mapJobStartError({ extensions: { code: 'JOB_QUEUE_FULL', maxQueued: 4 } })).toEqual({ kind: 'queue-full', maxQueued: 4 });
  });
});
