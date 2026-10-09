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
// Check D (Story 0.i2d, AC7, property 1-equivalent for Apify's *internal* client getter):
// getApifyClient() identifier confinement. Story 0.i2d routed all 4 real Apify bypass sites
// through the new shared callApifyClient helper in instagram-adapter.ts -- getApifyClient
// itself must now only ever be referenced from its own defining module (callApifyClient's
// internal call-site), replacing the TEMPORARY_APIFY_BRIGHTDATA_BYPASS_FILES inventory this
// check supersedes.
// ---------------------------------------------------------------------------------------------

const GET_APIFY_CLIENT_IDENTIFIER_PATTERN = /\bgetApifyClient\b/;
const GET_APIFY_CLIENT_ALLOWED_FILE = join(SRC_ROOT, 'lib', 'scraper', 'instagram-adapter.ts');

test('Check D: getApifyClient is only referenced inside its own defining module (instagram-adapter.ts)', () => {
  const files = collectTsFiles(SRC_ROOT);
  const offenders = files
    .filter((f) => resolve(f) !== resolve(GET_APIFY_CLIENT_ALLOWED_FILE))
    .filter((f) => GET_APIFY_CLIENT_IDENTIFIER_PATTERN.test(readFileSync(f, 'utf8')))
    .map(toRelative);

  assert.deepStrictEqual(
    offenders,
    [],
    `Found getApifyClient reference(s) outside the allowed module (lib/scraper/instagram-adapter.ts): ${offenders.join(', ')}`
  );

  assert.ok(
    GET_APIFY_CLIENT_IDENTIFIER_PATTERN.test(readFileSync(GET_APIFY_CLIENT_ALLOWED_FILE, 'utf8')),
    'Expected instagram-adapter.ts to still reference getApifyClient'
  );
});

test('Check D negative control: a synthetic bypass reference outside the allowed module is flagged', () => {
  const bypassSnippet = `
    import { getApifyClient } from './instagram-adapter.js';
    export async function someOtherModule() {
      return getApifyClient().actor('x').call({});
    }
  `;
  assert.strictEqual(
    GET_APIFY_CLIENT_IDENTIFIER_PATTERN.test(bypassSnippet),
    true,
    'Expected the getApifyClient pattern to flag a synthetic bypass reference'
  );

  const unrelatedSnippet = `export function getApifyClientFactorySomethingElse() {}`;
  assert.strictEqual(
    GET_APIFY_CLIENT_IDENTIFIER_PATTERN.test(unrelatedSnippet),
    false,
    'Expected the word-boundary pattern to NOT match a longer, unrelated identifier'
  );
});

// ---------------------------------------------------------------------------------------------
// Check E (Story 0.i2d, AC7, property-1-equivalent for Bright Data's host): the literal
// "api.brightdata.com" host string must only ever appear in brightdata-client.ts, Bright
// Data's own defining/calling module (mirroring Check B's apify-client SDK-import confinement,
// but for a raw-fetch vendor with no SDK import to anchor on).
// ---------------------------------------------------------------------------------------------

const BRIGHTDATA_HOST_PATTERN = /api\.brightdata\.com/;
const BRIGHTDATA_HOST_ALLOWED_FILE = join(SRC_ROOT, 'lib', 'scraper', 'brightdata-client.ts');

test('Check E: api.brightdata.com is only referenced inside brightdata-client.ts', () => {
  const files = collectTsFiles(SRC_ROOT);
  const offenders = files
    .filter((f) => resolve(f) !== resolve(BRIGHTDATA_HOST_ALLOWED_FILE))
    .filter((f) => BRIGHTDATA_HOST_PATTERN.test(readFileSync(f, 'utf8')))
    .map(toRelative);

  assert.deepStrictEqual(
    offenders,
    [],
    `Found api.brightdata.com reference(s) outside the allowed module (lib/scraper/brightdata-client.ts): ${offenders.join(', ')}`
  );

  assert.ok(
    BRIGHTDATA_HOST_PATTERN.test(readFileSync(BRIGHTDATA_HOST_ALLOWED_FILE, 'utf8')),
    'Expected brightdata-client.ts to still reference api.brightdata.com'
  );
});

test('Check E negative control: a synthetic reference outside the allowed module is flagged', () => {
  const bypassSnippet = `
    const response = await fetch('https://api.brightdata.com/datasets/v3/trigger');
  `;
  assert.strictEqual(
    BRIGHTDATA_HOST_PATTERN.test(bypassSnippet),
    true,
    'Expected the api.brightdata.com pattern to flag a synthetic bypass reference'
  );

  const unrelatedSnippet = `const host = 'api.other-vendor.com';`;
  assert.strictEqual(
    BRIGHTDATA_HOST_PATTERN.test(unrelatedSnippet),
    false,
    'Expected the pattern to NOT match an unrelated host'
  );
});
