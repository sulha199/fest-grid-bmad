import test from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Ratchet on explicit `any` in backend source (`as any` and `: any`). The count may only go down:
// when you remove some, lower BASELINE in the same change; when a new one looks necessary, type it
// instead. The biggest remaining cluster is src/schema/resolvers.ts, where field resolvers take raw
// database rows as `parent`; typing those properly needs codegen `mappers` for the GraphQL types
// that differ from their rows (SocialMediaAccountProfile, Event, Subscription, ...).
const BASELINE = 206;

const SRC = path.resolve(process.cwd(), 'src');
const EXPLICIT_ANY = /\bas any\b|: any\b/g;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'generated' || entry.name === 'node_modules') continue;
      out.push(...sourceFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

test('explicit any in backend source does not grow (ratchet)', () => {
  const perFile = new Map<string, number>();
  let total = 0;
  for (const file of sourceFiles(SRC)) {
    const count = (fs.readFileSync(file, 'utf8').match(EXPLICIT_ANY) ?? []).length;
    if (count > 0) perFile.set(path.relative(SRC, file), count);
    total += count;
  }
  const worst = [...perFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([file, count]) => `${file}: ${count}`).join(', ');
  assert.ok(
    total <= BASELINE,
    `explicit any rose to ${total} (baseline ${BASELINE}). Type the new code instead of using any. Largest files: ${worst}`
  );
});
