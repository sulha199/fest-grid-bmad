import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `packages/domain` is an ESM package (NodeNext) — no `__dirname` global, so it is derived from
// `import.meta.url` the standard ESM way, then used exactly like the CommonJS `__dirname` the
// `ad33-z-index-layering.ratchet.test.ts` precedent relies on.
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Story 9.9z — the epic's own named "ratchet" closer. Story 9.2 extracted ten per-field
 * "leaf builder" identifiers (plus the shared `resolveZonedToday` helper) out of the legacy
 * flat `buildEventsQueryCondition.ts` so both the flat path and Story 9.2's expression compiler
 * (`compile-filter-node.ts`) share one implementation per field. This test is the permanent
 * guard that keeps it that way: a second, independently-reimplemented filter path must not
 * silently reappear as the codebase grows.
 *
 * Two complementary, regex-based checks, not a full AST parse — matching this repo's own
 * established convention (explicitly cited by
 * `apps/backend/src/lib/vendor-gateway/no-vendor-call-bypasses-wrapper.ratchet.test.ts`'s own
 * header comment, and by `packages/ui/src/__tests__/ad33-z-index-layering.ratchet.test.ts`):
 *
 *   - Check 1 (leaf-builder confinement): none of the ten leaf-builder identifiers may be
 *     *referenced* anywhere outside the file that defines them (`buildEventsQueryCondition.ts`)
 *     and the one file that is allowed to call them directly (`compile-filter-node.ts`).
 *   - Check 2 (no silent reimplementation): a file cannot reference `EventFilterInput`/
 *     `FilterNode` and separately hand-build a `QueryCondition`-shaped group literal
 *     (`operator: 'and' | 'or' | 'not'` alongside `conditions:`) without also importing one of
 *     the four sanctioned shared-compiler entry points — this catches a brand-new reimplementation
 *     that never references any of the ten named leaf-builder identifiers at all (Check 1 alone
 *     cannot see that case).
 *
 * Deliberately located under `__tests__/` (this package's first use of that convention — see
 * `packages/ui/src/__tests__/`), not colocated as a plain sibling `.test.ts`, so a future reader
 * doesn't mistake it for a per-module unit test rather than a repo-wide static-analysis sweep.
 * `packages/domain`'s `test` script (a recursive `tsx --test` glob over every `.test.ts` file
 * under `src/`) already recurses into subdirectories, so no script change is needed to pick
 * this file up.
 *
 * Using Node's `fs`/`path` here does not violate `project-context.md`'s `packages/domain`
 * purity restriction (no Node-runtime-only dependencies in *production* code) — this is a
 * `.test.ts` file, never bundled or shipped, exactly like
 * `packages/ui/src/__tests__/ad33-z-index-layering.ratchet.test.ts`'s own precedent one package
 * over.
 */

// This package's own `src` (one directory up from `ai-event-filters`, two up from `__tests__`).
const DOMAIN_SRC_ROOT = resolve(__dirname, '..', '..');

// Climbed relative to this file's own location (not process.cwd(), which varies by how the test
// runner is invoked), mirroring `ad33-z-index-layering.ratchet.test.ts`'s own pattern.
const REPO_ROOT = resolve(__dirname, '../../../../..');
const BACKEND_SRC_ROOT = resolve(REPO_ROOT, 'apps', 'backend', 'src');
const WEB_SRC_ROOT = resolve(REPO_ROOT, 'apps', 'web', 'src');

// Verify the empirically-derived relative climbs actually resolve before trusting them for the
// walk below — if either is wrong, fail loudly with a descriptive error rather than silently
// scanning zero files (and thus vacuously "passing").
for (const [label, root] of [
  ['apps/backend/src', BACKEND_SRC_ROOT],
  ['apps/web/src', WEB_SRC_ROOT],
] as const) {
  if (!existsSync(root)) {
    throw new Error(
      `filter-consumer-no-bypass ratchet: resolved ${label} root does not exist: ${root}. ` +
        'The relative path climb from packages/domain/src/ai-event-filters/__tests__ needs to be re-verified.'
    );
  }
}

/**
 * Directories never worth walking: build output, vendored deps, and generated/codegen output.
 * `__tests__` is deliberately NOT in this list — this file itself lives there, and any future
 * sibling file added under it should still be scanned like any other source file. This file is
 * excluded from the results below purely because its own name ends in `.test.ts` (same filter
 * every other `*.test.ts(x)` file in the repo is excluded by), not because of its directory.
 */
const EXCLUDED_DIR_SEGMENTS = new Set(['node_modules', 'generated', 'dist']);

function isTestFileName(name: string): boolean {
  return /\.test\.tsx?$/.test(name);
}

function isSourceFileName(name: string): boolean {
  return /\.tsx?$/.test(name) && !isTestFileName(name);
}

/** Recursively collects every non-excluded `.ts`/`.tsx` file under `root`, skipping test files. */
function collectTsFiles(root: string): string[] {
  const out: string[] = [];

  function visit(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        if (EXCLUDED_DIR_SEGMENTS.has(entry)) continue;
        visit(fullPath);
      } else if (stats.isFile() && isSourceFileName(entry)) {
        out.push(fullPath);
      }
    }
  }

  visit(root);
  return out;
}

function collectAllFiles(): string[] {
  return [...collectTsFiles(DOMAIN_SRC_ROOT), ...collectTsFiles(BACKEND_SRC_ROOT), ...collectTsFiles(WEB_SRC_ROOT)];
}

function toRepoRelative(filePath: string): string {
  return relative(REPO_ROOT, filePath).split('\\').join('/');
}

// ---------------------------------------------------------------------------------------------
// Check 1 (AC1): leaf-builder identifier confinement.
// ---------------------------------------------------------------------------------------------

const LEAF_BUILDER_IDENTIFIERS = [
  'buildAccountIdCondition',
  'buildTypesCondition',
  'buildCategoriesCondition',
  'buildKeywordCondition',
  'buildDateRangeAndDayOfWeekCondition',
  'buildLocationCondition',
  'buildVenueTypeCondition',
  'buildIsFreeCondition',
  'buildTemporalCondition',
  'resolveZonedToday',
];

const LEAF_BUILDER_DEFINITION_FILE = resolve(DOMAIN_SRC_ROOT, 'events', 'buildEventsQueryCondition.ts');
const COMPILE_FILTER_NODE_FILE = resolve(DOMAIN_SRC_ROOT, 'ai-event-filters', 'compile-filter-node.ts');
const CHECK1_ALLOWED_FILES = new Set([LEAF_BUILDER_DEFINITION_FILE, COMPILE_FILTER_NODE_FILE]);

function identifierPattern(identifier: string): RegExp {
  return new RegExp(`\\b${identifier}\\b`);
}

test('Check 1: leaf-builder identifiers are confined to buildEventsQueryCondition.ts and compile-filter-node.ts', () => {
  const files = collectAllFiles();
  const allOffenders: string[] = [];

  for (const identifier of LEAF_BUILDER_IDENTIFIERS) {
    const pattern = identifierPattern(identifier);
    const offenders = files
      .filter((f) => !CHECK1_ALLOWED_FILES.has(resolve(f)))
      .filter((f) => pattern.test(readFileSync(f, 'utf8')))
      .map(toRepoRelative);

    if (offenders.length > 0) {
      allOffenders.push(`${identifier}: ${offenders.join(', ')}`);
    }
  }

  assert.deepStrictEqual(
    allOffenders,
    [],
    `Found leaf-builder identifier(s) referenced outside buildEventsQueryCondition.ts/` +
      `compile-filter-node.ts:\n${allOffenders.join('\n')}`
  );

  // Positive confirmation: the definition file still actually references every identifier —
  // not a vacuous pass because the allowlist is wrong or the file has changed shape.
  const definitionText = readFileSync(LEAF_BUILDER_DEFINITION_FILE, 'utf8');
  for (const identifier of LEAF_BUILDER_IDENTIFIERS) {
    assert.ok(
      identifierPattern(identifier).test(definitionText),
      `Expected buildEventsQueryCondition.ts to still define/reference ${identifier}`
    );
  }
});

test('Check 1 negative control: a synthetic bypass reference outside the allowlist is flagged', () => {
  const pattern = identifierPattern('buildTypesCondition');

  const bypassSnippet = `
    import { buildTypesCondition } from '../events/buildEventsQueryCondition.js';
    export function sneakyReimplementation(types: string[]) {
      return buildTypesCondition(types);
    }
  `;
  assert.strictEqual(
    pattern.test(bypassSnippet),
    true,
    'Expected the word-boundary pattern to flag a synthetic bypass reference'
  );

  // Word-boundary matching must not falsely match a longer identifier that merely starts with
  // the same text.
  const unrelatedSnippet = `export function buildTypesConditionSomethingElse() {}`;
  assert.strictEqual(
    pattern.test(unrelatedSnippet),
    false,
    'Expected the word-boundary pattern to NOT match a longer, unrelated identifier'
  );
});

// ---------------------------------------------------------------------------------------------
// Check 2 (AC1): no silent reimplementation. Catches a brand-new file that hand-builds a
// QueryCondition group for EventFilterInput/FilterNode without ever referencing any of the ten
// leaf-builder identifiers at all — the one shape Check 1 cannot see.
// ---------------------------------------------------------------------------------------------

const SHARED_COMPILER_ENTRY_POINTS = [
  'buildEventsQueryCondition',
  'buildFeedQueryCondition',
  'buildAccountEventsQueryCondition',
  'compileFilterNodeToQueryCondition',
];

const CHECK2_DEFINITION_FILES = new Set(
  [
    resolve(DOMAIN_SRC_ROOT, 'events', 'buildEventsQueryCondition.ts'),
    resolve(DOMAIN_SRC_ROOT, 'events', 'buildFeedQueryCondition.ts'),
    resolve(DOMAIN_SRC_ROOT, 'events', 'buildAccountEventsQueryCondition.ts'),
    resolve(DOMAIN_SRC_ROOT, 'ai-event-filters', 'compile-filter-node.ts'),
  ].map((p) => resolve(p))
);

/** Condition (a): the file references EventFilterInput or FilterNode as a type name/import. */
const FILTER_TYPE_REFERENCE_PATTERN = /\b(EventFilterInput|FilterNode)\b/;

/** Condition (b), part 1: a QueryCondition-shaped group operator literal. */
const QUERY_CONDITION_GROUP_OPERATOR_PATTERN = /operator:\s*['"](and|or|not)['"]/;

/** Condition (b), part 2: a `conditions:` key, alongside the group-operator literal above. */
const CONDITIONS_KEY_PATTERN = /\bconditions\s*:/;

function referencesFilterType(text: string): boolean {
  return FILTER_TYPE_REFERENCE_PATTERN.test(text);
}

function buildsQueryConditionGroupLiteral(text: string): boolean {
  return QUERY_CONDITION_GROUP_OPERATOR_PATTERN.test(text) && CONDITIONS_KEY_PATTERN.test(text);
}

/** Condition (c): does the file import at least one sanctioned shared-compiler entry point? */
function importsSanctionedEntryPoint(text: string): boolean {
  return SHARED_COMPILER_ENTRY_POINTS.some((name) => identifierPattern(name).test(text));
}

test('Check 2: no file builds a QueryCondition group literal for EventFilterInput/FilterNode without a sanctioned shared-compiler import', () => {
  const files = collectAllFiles().filter((f) => !CHECK2_DEFINITION_FILES.has(resolve(f)));
  const offenders: string[] = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (referencesFilterType(text) && buildsQueryConditionGroupLiteral(text) && !importsSanctionedEntryPoint(text)) {
      offenders.push(toRepoRelative(file));
    }
  }

  assert.deepStrictEqual(
    offenders,
    [],
    `Found file(s) referencing EventFilterInput/FilterNode and hand-building a QueryCondition ` +
      `group literal without importing a sanctioned shared-compiler entry point ` +
      `(buildEventsQueryCondition/buildFeedQueryCondition/buildAccountEventsQueryCondition/` +
      `compileFilterNodeToQueryCondition): ${offenders.join(', ')}`
  );
});

test('Check 2 positive confirmation: the five known live EventFilterInput/FilterNode consumers each import a sanctioned entry point', () => {
  // Spot-checks the check isn't vacuously passing because condition (a)/(b) never matches
  // anything real — these are the five known live consumers identified during story drafting.
  const knownConsumers = [
    'apps/web/src/app/[locale]/home-content.tsx',
    'apps/web/src/app/[locale]/feed/feed-content.tsx',
    'apps/web/src/app/[locale]/favorites/favorites-content.tsx',
    'apps/web/src/app/[locale]/[platformSlug]/[username]/account-content.tsx',
    'apps/backend/src/schema/resolvers.ts',
  ];

  for (const relPath of knownConsumers) {
    const fullPath = resolve(REPO_ROOT, relPath);
    const text = readFileSync(fullPath, 'utf8');
    assert.ok(
      importsSanctionedEntryPoint(text),
      `Expected known consumer ${relPath} to still import a sanctioned shared-compiler entry point ` +
        '(this check is not vacuously passing)'
    );
  }
});

test('Check 2 negative control: a synthetic reimplementation with no sanctioned import is flagged', () => {
  const bypassSnippet = `
    import type { EventFilterInput } from '@festgrid/domain/events';

    function buildConditionsFromScratch(filter: EventFilterInput) {
      const conditions = [];
      if (filter.types) conditions.push({ field: 'types', operator: 'in', value: filter.types });
      return { operator: 'and', conditions: conditions };
    }
  `;

  assert.strictEqual(
    referencesFilterType(bypassSnippet) && buildsQueryConditionGroupLiteral(bypassSnippet),
    true,
    'Expected the synthetic bypass snippet to satisfy conditions (a) and (b)'
  );
  assert.strictEqual(
    importsSanctionedEntryPoint(bypassSnippet),
    false,
    'Expected the synthetic bypass snippet to have no sanctioned shared-compiler import'
  );

  const sanctionedSnippet = `
    import type { EventFilterInput } from '@festgrid/domain/events';
    import { buildEventsQueryCondition } from '@festgrid/domain/events';

    function wrap(filter: EventFilterInput) {
      return { operator: 'and', conditions: [buildEventsQueryCondition({ filter })] };
    }
  `;
  assert.strictEqual(
    importsSanctionedEntryPoint(sanctionedSnippet),
    true,
    'Expected the sanctioned snippet to be recognized as importing a sanctioned shared-compiler entry point'
  );
});
