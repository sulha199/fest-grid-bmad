import { describe, it, expect } from 'vitest';
import { EventCategory, EventType } from '@festgrid/shared-types';
import en from './en.json';
import id from './id.json';

// Guards against locale drift: a missing/renamed key in one locale falls
// back gracefully at runtime (see buildEnumLabels in page.tsx), but should
// still fail CI so translations don't silently go stale.
describe('locale files stay in sync', () => {
  const namespaces = Object.keys(en) as (keyof typeof en)[];

  it('id.json defines the same namespaces as en.json', () => {
    expect(Object.keys(id).sort()).toEqual(namespaces.sort());
  });

  it.each(namespaces)('id.json "%s" defines the same keys as en.json', (namespace) => {
    const enKeys = Object.keys(en[namespace]).sort();
    const idKeys = Object.keys((id as typeof en)[namespace] ?? {}).sort();
    expect(idKeys).toEqual(enKeys);
  });
});

// Guards against a new/renamed EventCategory or EventType member (in
// @festgrid/shared-types) shipping without a matching locale key. Today a
// missing key silently falls back to the raw enum string at runtime (see
// buildEnumLabels's try/catch in home-content.tsx et al.) -- this test makes
// that gap fail CI instead. The existing "id.json mirrors en.json" tests
// above already cover id.json transitively once en.json is asserted
// complete, so only en.json is checked directly here.
describe('EventCategory/EventType enums stay in sync with locale files', () => {
  it('every EventType member has a matching en.json "EventType" key, and no stale/extra key', () => {
    const enumMembers = Object.values(EventType).sort();
    const localeKeys = Object.keys(en.EventType).sort();
    expect(localeKeys).toEqual(enumMembers);
  });

  it('every EventCategory member has a matching en.json "EventCategory" key, and no stale/extra key', () => {
    const enumMembers = Object.values(EventCategory).sort();
    const localeKeys = Object.keys(en.EventCategory).sort();
    expect(localeKeys).toEqual(enumMembers);
  });

  it('every en.EventCategory value is a non-empty string', () => {
    for (const value of Object.values(en.EventCategory)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

// Story 10.4 Part B: the `Jobs` namespace carries copy for every enum the server can send, and none of the OI-2
// placeholders (decisions D1, D3, D4 are still open with the owner: nothing renders them, so they are not merged).
describe('Jobs namespace (Story 10.4)', () => {
  const walk = (value: unknown, out: string[] = []): string[] => {
    if (typeof value === 'string') out.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach((v) => walk(v, out));
    return out;
  };

  it.each([['en', en], ['id', id]] as const)('%s has no lookup.* placeholder keys and no [OPEN ...] text', (_name, messages) => {
    expect(Object.keys(messages.Jobs)).not.toContain('lookup');
    expect(walk(messages.Jobs).filter((s) => s.includes('[OPEN'))).toEqual([]);
  });

  it.each([['en', en], ['id', id]] as const)('%s has a status, chip, type and reason text for every server value', (_name, messages) => {
    const jobs = messages.Jobs as unknown as Record<string, Record<string, string>>;
    for (const s of ['QUEUED', 'RUNNING', 'WAITING', 'SUCCEEDED', 'SUCCEEDED_WITH_LIMITS', 'FAILED', 'EXPIRED', 'CANCELLED']) expect(jobs.status[s]).toBeTruthy();
    for (const t of ['SUBSCRIBE', 'PROFILE_LOOKUP', 'ACCOUNT_REFRESH', 'CORRECTION', 'EXTRACT_FROM_URL', 'EXTRACT_SELECTED_POSTS', 'REEXTRACT_REFRESH', 'ADMIN_OPERATION', 'OTHER']) expect(jobs.type[t]).toBeTruthy();
    for (const r of ['ACCOUNT_NOT_FOUND', 'ACCOUNT_PRIVATE', 'NO_PROVIDER_REACHABLE', 'PROVIDER_OVER_QUOTA', 'ACCOUNT_TYPE_NOT_SCRAPED', 'POST_UNAVAILABLE', 'COOLDOWN', 'TIMED_OUT', 'CANCELLED', 'WAITED_TOO_LONG', 'SOME_POSTS_NOT_EXTRACTED', 'REFRESH_IN_PROGRESS', 'REFRESH_DID_NOT_HEAL_IMAGES', 'POST_NOT_FOUND', 'CHAIN_IN_FLIGHT', 'QUOTA_EXHAUSTED', 'EXTRACTION_FAILED', 'VENDOR_RUN_FAILED', 'GENERIC']) expect(jobs.reason[r]).toBeTruthy();
    expect(jobs.chip.done).toBeTruthy();
  });
});
