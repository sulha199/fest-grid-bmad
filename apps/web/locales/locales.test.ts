import { describe, it, expect } from 'vitest';
import { createTranslator } from 'next-intl';
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

// Story 10.3a (show the subscription cap refusal and the upgrade call to action): the `SubscriptionCap` namespace of
// copy-keys.md section 2 exists in both languages, every key is there, and the body reads right for 0, 1 and 2 reserved.
type Translate = (key: string, values: Record<string, number>) => string;

describe('SubscriptionCap namespace (Story 10.3a)', () => {
  const KEYS = ['title', 'body', 'hint', 'blockedNote', 'upgradeButton', 'comingSoonBadge', 'comingSoonNote', 'afterClickNote', 'manageLink', 'dialogTitle', 'closeButton', 'restoreFailedToast', 'announce'];
  const walk = (value: unknown, out: string[] = []): string[] => {
    if (typeof value === 'string') out.push(value);
    else if (value && typeof value === 'object') Object.values(value).forEach((v) => walk(v, out));
    return out;
  };

  it.each([['en', en], ['id', id]] as const)('%s has the namespace with every key, non-empty, and no [OPEN text', (_name, messages) => {
    const ns = (messages as unknown as Record<string, Record<string, string>>).SubscriptionCap;
    expect(ns).toBeTruthy();
    expect(Object.keys(ns).sort()).toEqual([...KEYS].sort());
    for (const k of KEYS) expect(ns[k].length).toBeGreaterThan(0);
    expect(walk(ns).filter((s) => s.includes('[OPEN'))).toEqual([]);
  });

  it('only body, announce and restoreFailedToast carry placeholders', () => {
    for (const messages of [en, id]) {
      const ns = (messages as unknown as Record<string, Record<string, string>>).SubscriptionCap;
      expect(KEYS.filter((k) => ns[k].includes('{')).sort()).toEqual(['announce', 'body', 'restoreFailedToast']);
    }
  });

  it('en body renders for 0, 1 and 2 reserved (and 7 of 5 above the cap)', () => {
    const t = createTranslator({ locale: 'en', messages: en as never, namespace: 'SubscriptionCap' as never }) as unknown as Translate;
    expect(t('body', { active: 5, reserved: 0, cap: 5 })).toBe('You have 5 accounts added. The limit is 5.');
    expect(t('body', { active: 4, reserved: 1, cap: 5 })).toBe('You have 4 accounts added and 1 more being added. The limit is 5.');
    expect(t('body', { active: 3, reserved: 2, cap: 5 })).toBe('You have 3 accounts added and 2 more being added. The limit is 5.');
    expect(t('body', { active: 7, reserved: 0, cap: 5 })).toBe('You have 7 accounts added. The limit is 5.');
    expect(t('body', { active: 1, reserved: 0, cap: 1 })).toBe('You have 1 account added. The limit is 1.');
  });

  it('id body renders for 0, 1 and 2 reserved', () => {
    const t = createTranslator({ locale: 'id', messages: id as never, namespace: 'SubscriptionCap' as never }) as unknown as Translate;
    expect(t('body', { active: 5, reserved: 0, cap: 5 })).toBe('Anda memiliki 5 akun yang sudah ditambahkan. Batasnya 5.');
    expect(t('body', { active: 4, reserved: 1, cap: 5 })).toBe('Anda memiliki 4 akun yang sudah ditambahkan dan 1 lagi sedang ditambahkan. Batasnya 5.');
    expect(t('body', { active: 3, reserved: 2, cap: 5 })).toBe('Anda memiliki 3 akun yang sudah ditambahkan dan 2 lagi sedang ditambahkan. Batasnya 5.');
  });
});
