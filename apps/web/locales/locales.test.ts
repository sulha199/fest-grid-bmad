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
  it('every EventType member has a matching en.json "EventType" key', () => {
    const enumMembers = Object.values(EventType).sort();
    const localeKeys = Object.keys(en.EventType).sort();
    expect(localeKeys).toEqual(expect.arrayContaining(enumMembers));
  });

  it('every EventCategory member has a matching en.json "EventCategory" key', () => {
    const enumMembers = Object.values(EventCategory).sort();
    const localeKeys = Object.keys(en.EventCategory).sort();
    expect(localeKeys).toEqual(expect.arrayContaining(enumMembers));
  });
});
