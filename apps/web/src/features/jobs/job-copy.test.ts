import { describe, expect, it } from 'vitest';
import en from '../../../locales/en.json';
import { buildJobAnnouncement, buildJobTitle, phaseText, reasonText, subjectText, type JobTranslator } from './job-copy';
import { toJobProgressJob } from './job-model';
import { makeFragment } from './job-test-support';

// A tiny ICU-less translator over the real English copy: enough to prove keys and fallbacks.
function lookup(key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => (acc == null ? acc : (acc as Record<string, unknown>)[part]), en.Jobs);
}
const tr = ((key: string, values: Record<string, string | number> = {}) => {
  const raw = lookup(key);
  if (typeof raw !== 'string') throw new Error(`missing key ${key}`);
  return raw
    .replace(/\{(\w+), plural, (?:=1|one) \{([^}]*)\} other \{([^}]*)\}\}/g, (_m, name, one, other) => (Number(values[name]) === 1 ? one : other).replace('#', String(values[name])))
    .replace(/\{(\w+)\}/g, (_m, name) => String(values[name] ?? ''));
}) as JobTranslator;
tr.has = (key) => typeof lookup(key) === 'string';
const time = (iso: string) => iso.slice(11, 16);
const job = (o: Record<string, unknown> = {}) => toJobProgressJob(makeFragment(o));

describe('job copy', () => {
  it('resolves reason text from the code and falls back to GENERIC for an unknown code or none', () => {
    expect(reasonText(tr, 'ACCOUNT_PRIVATE', {})).toBe(en.Jobs.reason.ACCOUNT_PRIVATE);
    expect(reasonText(tr, 'SOMETHING_NEW', {})).toBe(en.Jobs.reason.GENERIC);
    expect(reasonText(tr, null, {})).toBe(en.Jobs.reason.GENERIC);
    expect(reasonText(tr, 'COOLDOWN', { time: '14:42' })).toContain('14:42');
    expect(reasonText(tr, 'WAITED_TOO_LONG', { minutes: 30 })).toContain('30 minutes');
    expect(reasonText(tr, 'WAITED_TOO_LONG', {})).toContain('30 minutes');
  });

  it('labels steps by type and key, falling back to "Working on it"', () => {
    expect(phaseText(tr, 'REEXTRACT_REFRESH', 'refresh')).toBe('Fetching fresh images');
    expect(phaseText(tr, 'REEXTRACT_REFRESH', 'nope')).toBe('Working on it');
    expect(phaseText(tr, 'OTHER', 'working')).toBe('Working on it');
  });

  it('builds a subject and a title; an unknown type reads as a background job', () => {
    expect(subjectText(tr, { kind: 'ACCOUNT', username: 'venue' })).toBe('@venue');
    expect(subjectText(tr, { kind: 'POSTS', postCount: 12 })).toBe('12 posts');
    expect(subjectText(tr, { kind: 'POST', postCode: 'DcntzF0mB7z' })).toBe('Post DcntzF0mB7z');
    expect(subjectText(tr, { kind: 'NONE' })).toBeNull();
    expect(subjectText(tr, undefined)).toBeNull();
    expect(buildJobTitle(tr, 'SUBSCRIBE', { kind: 'ACCOUNT', username: 'venue' })).toBe('Adding an account: @venue');
    expect(buildJobTitle(tr, 'EXPIRED_TYPE', null)).toBe('Background job');
  });

  const title = 'T';
  it('announces entering the queue with the position, a step change, endings with their reason', () => {
    expect(buildJobAnnouncement(tr, job({ status: 'QUEUED', queue: { position: 2, maxConcurrent: 3, expiresAt: '2026-11-13T14:32:00.000Z' } }), title, time)).toBe('T is waiting for a free place. Number 2 in line');
    expect(buildJobAnnouncement(tr, job({ status: 'QUEUED', queue: { position: 1, maxConcurrent: 3, expiresAt: 'x' } }), title, time)).toContain('Next in line');
    expect(buildJobAnnouncement(tr, job({ status: 'QUEUED' }), title, time)).toBe('T is waiting for a free place.');
    expect(buildJobAnnouncement(tr, job(), title, time)).toBe('T: step 2 of 2, Reading the post and finding events.');
    expect(buildJobAnnouncement(tr, job(), title, time, true)).toBe('T started.');
    expect(buildJobAnnouncement(tr, job({ steps: [] }), title, time)).toBe('T is now in progress.');
    expect(buildJobAnnouncement(tr, job({ status: 'SUCCEEDED' }), title, time)).toBe('T is done.');
    expect(buildJobAnnouncement(tr, job({ status: 'SUCCEEDED_WITH_LIMITS', reasonCode: 'TIMED_OUT' }), title, time)).toBe(`T finished with limits. ${en.Jobs.reason.TIMED_OUT}`);
    expect(buildJobAnnouncement(tr, job({ status: 'FAILED', reasonCode: 'ACCOUNT_NOT_FOUND' }), title, time)).toContain('T failed.');
    expect(buildJobAnnouncement(tr, job({ status: 'FAILED', isCancelled: true, reasonCode: 'CANCELLED' }), title, time)).toBe('T was cancelled.');
    expect(buildJobAnnouncement(tr, job({ status: 'EXPIRED', reasonCode: 'WAITED_TOO_LONG' }), title, time)).toContain('T was stopped.');
    expect(buildJobAnnouncement(tr, job({ status: 'FAILED', reasonCode: 'COOLDOWN', retryNotBefore: '2026-11-13T14:42:00.000Z' }), title, time)).toContain('14:42');
  });

  it('announces what a waiting job waits for', () => {
    expect(buildJobAnnouncement(tr, job({ status: 'WAITING', waiting: { waitingFor: 'RETRY_AT', resumeAt: '2026-11-13T14:20:00.000Z', done: null, total: null } }), title, time)).toBe('T is waiting. Waiting to try again at 14:20.');
    expect(buildJobAnnouncement(tr, job({ status: 'WAITING', waiting: { waitingFor: 'EXTRACTION_QUEUE', resumeAt: null, done: 3, total: 8 } }), title, time)).toContain('3 of 8 done');
    expect(buildJobAnnouncement(tr, job({ status: 'WAITING', waiting: null }), title, time)).toContain('Waiting for the answer');
  });
});

describe('toJobProgressJob', () => {
  it('maps dates to strings and keeps queue, waiting and outcome', () => {
    const mapped = toJobProgressJob(makeFragment({ status: 'WAITING', waiting: { waitingFor: 'RETRY_AT', resumeAt: '2026-11-13T14:20:00.000Z', done: null, total: null }, outcome: { kind: 'EVENTS', eventCount: 2, postCount: 1, previewApplyUntil: null, previewApplied: null }, retryNotBefore: '2026-11-13T14:42:00.000Z', reasonRetryAfter: '2026-11-13T14:42:00.000Z' }));
    expect(mapped.waiting?.resumeAt).toBe('2026-11-13T14:20:00.000Z');
    expect(mapped.outcome).toEqual({ kind: 'EVENTS', eventCount: 2, postCount: 1 });
    expect(mapped.retryNotBefore).toBe('2026-11-13T14:42:00.000Z');
    expect(mapped.finishedAt).toBeNull();
  });
});
