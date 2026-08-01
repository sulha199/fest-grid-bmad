import { describe, it, expect } from 'vitest';
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
