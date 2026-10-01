import test from 'node:test';
import * as assert from 'node:assert';
import { ManifestRegistry, DuplicateManifestEntryError, ManifestEntryNotFoundError, type ManifestEntry } from './src/manifest.js';

function ruleEntry(overrides: Partial<ManifestEntry> = {}): ManifestEntry {
  return {
    component: 'EventCardMasonry',
    variant: 'default-thumbnail-fallback',
    viewport: { width: 175, height: 400 },
    renderScope: 'single-instance',
    mode: 'rule',
    render: { kind: 'isolated-html', html: '<div></div>' },
    rules: [],
    ...overrides,
  };
}

test('ManifestRegistry', async (t) => {
  await t.test('registers and retrieves an entry by name', () => {
    const registry = new ManifestRegistry();
    registry.register('masonry-fallback-mobile', ruleEntry());
    assert.ok(registry.has('masonry-fallback-mobile'));
    assert.strictEqual(registry.get('masonry-fallback-mobile').component, 'EventCardMasonry');
  });

  await t.test('rejects a second entry with the same component/variant/viewport triple', () => {
    const registry = new ManifestRegistry();
    registry.register('first', ruleEntry());
    assert.throws(
      () => registry.register('second', ruleEntry()),
      DuplicateManifestEntryError
    );
  });

  await t.test('allows the same component/variant with a different viewport', () => {
    const registry = new ManifestRegistry();
    registry.register('mobile', ruleEntry({ viewport: { width: 175, height: 400 } }));
    registry.register('desktop', ruleEntry({ viewport: { width: 269, height: 400 } }));
    assert.strictEqual(registry.list().length, 2);
  });

  await t.test('throws a typed error for a missing entry', () => {
    const registry = new ManifestRegistry();
    assert.throws(() => registry.get('nope'), ManifestEntryNotFoundError);
  });

  await t.test('rejects mode "reference" without a reference source', () => {
    const registry = new ManifestRegistry();
    assert.throws(() => registry.register('bad', ruleEntry({ mode: 'reference' })), /reference source/);
  });

  await t.test('accepts mode "reference" with a reference source', () => {
    const registry = new ManifestRegistry();
    registry.register(
      'good',
      ruleEntry({
        mode: 'reference',
        reference: {
          prototypeHtmlPath: 'design-artifacts/UX-festgrid-run-1/prototypes/event-card-masonry/default-thumbnail-fallback.html',
          prototypePngPath: 'design-artifacts/UX-festgrid-run-1/imports/event-card-masonry/default-thumbnail-fallback.png',
        },
      })
    );
    assert.ok(registry.has('good'));
  });
});
