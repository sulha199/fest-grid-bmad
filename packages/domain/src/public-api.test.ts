import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Every `index.ts` barrel is a public entry point (see the `exports` map in package.json). Loading
// each one proves the surface still resolves, and keeps the barrels inside the 100% coverage gate
// (`.c8rc.json`) instead of excusing them from it.
const srcDir = dirname(fileURLToPath(import.meta.url));

function findBarrels(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return findBarrels(path);
    return entry === 'index.ts' ? [path] : [];
  });
}

const barrels = findBarrels(srcDir);

test('finds the root barrel and every sub-path barrel declared in package.json exports', () => {
  assert.ok(barrels.length >= 12, `expected at least 12 barrels, found ${barrels.length}`);
  assert.ok(barrels.includes(join(srcDir, 'index.ts')));
});

for (const barrel of barrels) {
  test(`barrel ${barrel.slice(srcDir.length + 1)} loads`, async () => {
    const loaded = await import(pathToFileURL(barrel).href);
    assert.equal(typeof loaded, 'object');
  });
}
