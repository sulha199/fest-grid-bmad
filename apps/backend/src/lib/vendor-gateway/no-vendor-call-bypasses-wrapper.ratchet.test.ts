import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, sep } from 'path';

// AD-32's "Guarded Vendor-Call Wrapper" — two-property model (Binds/Prevents):
//   Property 1: the vendor SDK itself may only be imported by its one designated client module.
//   Property 2: the wrapper's internal call-making identifier may only be referenced by the
//   designated caller modules that route it through `callVendor`.
// Story 0.i2z builds the permanent ratchet for Gemini (fully, both properties) and for Apify's
// SDK-import confinement (property 1 only, already true today), plus a separate, explicitly
// temporary inventory check for the still-open Apify/Bright Data *caller* gap (see the
// TEMPORARY_APIFY_BRIGHTDATA_BYPASS_FILES section below). This is a pragmatic regex scan over
// source files, not a full AST parse -- the same style already established by
// `apps/backend/src/schema/events-postid-write-ratchet.test.ts` and
// `apps/backend/src/lib/events/event-account-match-ratchet.test.ts`.

const SRC_ROOT = resolve(process.cwd(), 'src');

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (entry === 'generated') continue;
      out.push(...collectTsFiles(fullPath));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(fullPath);
    }
  }
  return out;
}

function toRelative(filePath: string): string {
  return relative(SRC_ROOT, filePath).split(sep).join('/');
}

// ---------------------------------------------------------------------------------------------
// Check A (AC1, property 1): @google/genai import confinement.
// ---------------------------------------------------------------------------------------------

const GEMINI_SDK_IMPORT_PATTERN = /from\s+['"]@google\/genai['"]/;
const GEMINI_SDK_ALLOWED_FILE = join(SRC_ROOT, 'lib', 'ai-gateway', 'gemini-client.ts');

test('Check A: only gemini-client.ts imports @google/genai', () => {
  const files = collectTsFiles(SRC_ROOT);
  const offenders = files
    .filter((f) => resolve(f) !== resolve(GEMINI_SDK_ALLOWED_FILE))
    .filter((f) => GEMINI_SDK_IMPORT_PATTERN.test(readFileSync(f, 'utf8')))
    .map(toRelative);

  assert.deepStrictEqual(
    offenders,
    [],
    `Found @google/genai import(s) outside the allowed module (lib/ai-gateway/gemini-client.ts): ${offenders.join(', ')}`
  );

  // Positive confirmation the allowed file itself is still the real importer, not that the
  // pattern simply never matches anything (a vacuous-pass guard).
  assert.ok(
    GEMINI_SDK_IMPORT_PATTERN.test(readFileSync(GEMINI_SDK_ALLOWED_FILE, 'utf8')),
    'Expected gemini-client.ts to still import @google/genai'
  );
});

// ---------------------------------------------------------------------------------------------
// Check B (AC1, property 1): apify-client import confinement, with a false-positive guard
// against the unrelated `geoapify-client` module (whose name contains "apify-client" as a bare
// substring -- see Dev Notes "False-positive guard"). The pattern anchors on the exact quoted
// import specifier, not a bare substring.
// ---------------------------------------------------------------------------------------------

const APIFY_SDK_IMPORT_PATTERN = /from\s+['"]apify-client['"]/;
const APIFY_SDK_ALLOWED_FILE = join(SRC_ROOT, 'lib', 'scraper', 'instagram-adapter.ts');

test('Check B: only instagram-adapter.ts imports apify-client (geoapify-client is not a false positive)', () => {
  const files = collectTsFiles(SRC_ROOT);
  const offenders = files
    .filter((f) => resolve(f) !== resolve(APIFY_SDK_ALLOWED_FILE))
    .filter((f) => APIFY_SDK_IMPORT_PATTERN.test(readFileSync(f, 'utf8')))
    .map(toRelative);

  assert.deepStrictEqual(
    offenders,
    [],
    `Found apify-client import(s) outside the allowed module (lib/scraper/instagram-adapter.ts): ${offenders.join(', ')}`
  );

  assert.ok(
    APIFY_SDK_IMPORT_PATTERN.test(readFileSync(APIFY_SDK_ALLOWED_FILE, 'utf8')),
    'Expected instagram-adapter.ts to still import apify-client'
  );
});

test('Check B negative control: the scan is actually tuned correctly (geoapify-client false positive + a real violation shape)', () => {
  // The exact false positive this story's Dev Notes call out: a plain substring search for
  // "apify-client" also matches "geoapify-client.js"/".ts". The anchored pattern must NOT flag
  // it.
  const geoapifySnippet = `import { GeoapifyClient } from './geoapify-client.js';`;
  assert.strictEqual(
    APIFY_SDK_IMPORT_PATTERN.test(geoapifySnippet),
    false,
    'Expected the anchored apify-client pattern to NOT flag a geoapify-client.js import'
  );

  // A real violation shape -- some other file importing apify-client directly -- must be
  // flagged, so the scan is not vacuously passing just because it never matches anything.
  const realViolationSnippet = `import { ApifyApiError, ApifyClient } from 'apify-client';`;
  assert.strictEqual(
    APIFY_SDK_IMPORT_PATTERN.test(realViolationSnippet),
    true,
    'Expected the anchored apify-client pattern to flag a direct apify-client import'
  );
});

// ---------------------------------------------------------------------------------------------
// Check C (AC2, property 2): callGeminiGenerateContent caller allowlist. Test files are excluded
// the same way `collectTsFiles` already excludes them in the precedent ratchets, since they
// reference the seam only to mock it (`setCallGeminiGenerateContent`), not as a production
// bypass.
// ---------------------------------------------------------------------------------------------

const CALL_GEMINI_IDENTIFIER_PATTERN = /\bcallGeminiGenerateContent\b/;
const CALL_GEMINI_ALLOWED_FILES = [
  join(SRC_ROOT, 'lib', 'ai-gateway', 'gemini-client.ts'),
  join(SRC_ROOT, 'lib', 'ai-gateway', 'adapter.ts'),
  join(SRC_ROOT, 'lib', 'ai-gateway', 'system-key-adapter.ts'),
].map((p) => resolve(p));

test('Check C: callGeminiGenerateContent is only referenced by its allowed callers', () => {
  const files = collectTsFiles(SRC_ROOT);
  const offenders = files
    .filter((f) => !CALL_GEMINI_ALLOWED_FILES.includes(resolve(f)))
    .filter((f) => CALL_GEMINI_IDENTIFIER_PATTERN.test(readFileSync(f, 'utf8')))
    .map(toRelative);

  assert.deepStrictEqual(
    offenders,
    [],
    `Found callGeminiGenerateContent reference(s) outside the AD-32 allowlist (gemini-client.ts, adapter.ts, system-key-adapter.ts): ${offenders.join(', ')}`
  );

  // Positive confirmation all three allowed files actually reference it -- not a vacuous pass.
  for (const allowed of CALL_GEMINI_ALLOWED_FILES) {
    assert.ok(
      CALL_GEMINI_IDENTIFIER_PATTERN.test(readFileSync(allowed, 'utf8')),
      `Expected ${toRelative(allowed)} to reference callGeminiGenerateContent`
    );
  }
});

test('Check C negative control: a synthetic bypass reference outside the allowlist is flagged', () => {
  const bypassSnippet = `
    import { callGeminiGenerateContent } from './gemini-client.js';
    export async function someOtherModule() {
      return callGeminiGenerateContent({});
    }
  `;
  assert.strictEqual(
    CALL_GEMINI_IDENTIFIER_PATTERN.test(bypassSnippet),
    true,
    'Expected the callGeminiGenerateContent pattern to flag a synthetic bypass reference'
  );

  const unrelatedSnippet = `export function callGeminiGenerateContentSomethingElse() {}`;
  // Word-boundary matching must not falsely match a longer identifier that merely starts with
  // the same text.
  assert.strictEqual(
    CALL_GEMINI_IDENTIFIER_PATTERN.test(unrelatedSnippet),
    false,
    'Expected the word-boundary pattern to NOT match a longer, unrelated identifier'
  );
});

// ---------------------------------------------------------------------------------------------
// Task 3 (AC3): Apify/Bright Data vendor-call bypass -- TEMPORARY inventory check.
//
// Story 0.i2d (backlog) must route each of the files below through `callVendor` and then EMPTY
// this list. Once TEMPORARY_APIFY_BRIGHTDATA_BYPASS_FILES is empty, this whole check must be
// DELETED and Check A/Check B/Check C above must be extended to cover Apify/Bright Data the same
// way they cover Gemini today (see Story 0.i2z Dev Notes "Why this story does not just extend
// AC1/AC2 to cover Apify/Bright Data directly").
//
// This check intentionally asserts the list is non-empty (so the gap can't be silently forgotten
// and this check can't vacuously pass) AND that each named file still contains its named bypass
// pattern (a staleness guard -- if the file's shape has drifted, this check fails loudly instead
// of silently continuing to "pass" against code that no longer matches the inventory).
// ---------------------------------------------------------------------------------------------

interface BypassEntry {
  relativePath: string;
  pattern: RegExp;
  description: string;
}

const TEMPORARY_APIFY_BRIGHTDATA_BYPASS_FILES: BypassEntry[] = [
  {
    relativePath: 'lib/scraper/trigger-apify-for-target.ts',
    pattern: /getApifyClient\(\)/,
    description: 'calls getApifyClient() directly, bypassing callVendor',
  },
  {
    relativePath: 'lib/scraper/fetch-vendor-run-output.ts',
    pattern: /getApifyClient\(\)/,
    description: 'calls getApifyClient() directly, bypassing callVendor (also imports Bright Data read helpers below)',
  },
  {
    relativePath: 'lambdas/apify-webhook.ts',
    pattern: /getApifyClient\(\)/,
    description: 'calls getApifyClient() directly, bypassing callVendor',
  },
  {
    relativePath: 'lib/scraper/trigger-brightdata-for-target.ts',
    pattern: /from\s+['"]\.\/brightdata-client\.js['"]/,
    description: "imports brightdata-client.ts's exported functions directly, bypassing callVendor",
  },
];

test('Task 3: the temporary Apify/Bright Data bypass inventory is non-empty (Story 0.i2d must empty it)', () => {
  assert.ok(
    TEMPORARY_APIFY_BRIGHTDATA_BYPASS_FILES.length > 0,
    'TEMPORARY_APIFY_BRIGHTDATA_BYPASS_FILES must stay non-empty until Story 0.i2d actually routes ' +
      'each entry through callVendor. If this fires, either the list was emptied without deleting ' +
      'this check (finish 0.i2d: delete this check and extend Check A/B/C to cover Apify/Bright ' +
      'Data), or the list was emptied by mistake.'
  );
});

test('Task 3: each named bypass file still contains its named bypass pattern (staleness guard)', () => {
  const stale: string[] = [];
  for (const entry of TEMPORARY_APIFY_BRIGHTDATA_BYPASS_FILES) {
    const fullPath = join(SRC_ROOT, entry.relativePath);
    const content = readFileSync(fullPath, 'utf8');
    if (!entry.pattern.test(content)) {
      stale.push(`${entry.relativePath} (expected to still ${entry.description})`);
    }
  }

  assert.deepStrictEqual(
    stale,
    [],
    `The following TEMPORARY_APIFY_BRIGHTDATA_BYPASS_FILES entries no longer match their named bypass ` +
      `pattern -- the inventory has gone stale and must be updated (or, if the bypass was actually ` +
      `fixed via Story 0.i2d, removed from the list): ${stale.join('; ')}`
  );
});
