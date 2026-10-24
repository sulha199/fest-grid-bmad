import test from 'node:test';
import * as assert from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { EventCategory, EventType, EVENT_CATEGORY_DEFINITIONS, CATEGORY_BOUNDARIES } from '@festgrid/shared-types';
import { renderEventCategoryGlossary } from './render-event-category-glossary.js';
import { buildGeminiExtractionRequest } from '../ai-processor/build-gemini-request.js';
import { buildFilterExtractionSystemInstruction } from '../ai-event-filters/build-filter-extraction-request.js';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';

// Story 0.52 (AD-44 Rule 4, AC4). Matches this codebase's existing ratchet style
// (`no-vendor-call-bypasses-wrapper.ratchet.test.ts`, `filter-consumer-no-bypass.ratchet.test.ts`):
// offender-list assertions + a positive confirmation the scan isn't vacuous + negative controls
// proving every check actually fires on a synthetic violation.

const ALL_CAPS_UNDERSCORE_TOKEN = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;
const KNOWN_TOKENS = new Set<string>([...Object.values(EventCategory), ...Object.values(EventType)]);

function findUnknownTokens(text: string): string[] {
  const matches = text.match(ALL_CAPS_UNDERSCORE_TOKEN) ?? [];
  return matches.filter((token) => !KNOWN_TOKENS.has(token));
}

// Minimal text-only ProcessingJobMessage, mirroring build-gemini-request.test.ts Case A -- no
// network/image mocking needed since the function returns before touching message.imageUrl.
const MINIMAL_MESSAGE: ProcessingJobMessage = {
  postId: 'ratchet-post-1',
  accountId: 'ratchet-account-1',
  content: 'A minimal post caption for ratchet testing.',
  postUrl: 'https://test.com/ratchet-post-1',
  publishedAt: '2026-10-23T12:00:00Z'
};

// ---------------------------------------------------------------------------------------------
// Check A: exhaustive/bounded definitions record.
// ---------------------------------------------------------------------------------------------

test('Check A: EVENT_CATEGORY_DEFINITIONS is exhaustive and every entry is well-formed', () => {
  const definitionKeys = Object.keys(EVENT_CATEGORY_DEFINITIONS).sort();
  const enumValues = [...Object.values(EventCategory)].sort();
  assert.deepStrictEqual(
    definitionKeys,
    enumValues,
    `EVENT_CATEGORY_DEFINITIONS keys must exactly match EventCategory members. Keys: ${definitionKeys.join(', ')}; Enum: ${enumValues.join(', ')}`
  );

  for (const category of Object.values(EventCategory)) {
    const entry = EVENT_CATEGORY_DEFINITIONS[category];
    assert.ok(entry, `Expected a definition entry for ${category}`);
    assert.ok(entry.definition.length > 0, `Definition for ${category} must be non-empty`);
    assert.ok(entry.definition.length <= 280, `Definition for ${category} must be <= 280 chars, got ${entry.definition.length}`);
    assert.ok(!entry.definition.includes('\n'), `Definition for ${category} must be single-line`);
    assert.ok(entry.aliases.length >= 1, `Definition for ${category} must have at least one alias`);
  }
});

test('Check A negative control: a synthetic violating record is actually flagged by the same assertions', () => {
  const brokenMissingKey: Record<string, { definition: string; aliases: readonly string[] }> = { ...EVENT_CATEGORY_DEFINITIONS };
  delete brokenMissingKey[EventCategory.OTHER];
  assert.notDeepStrictEqual(Object.keys(brokenMissingKey).sort(), [...Object.values(EventCategory)].sort());

  const emptyDefinition = { definition: '', aliases: ['x'] };
  assert.strictEqual(emptyDefinition.definition.length > 0, false);

  const tooLongDefinition = { definition: 'x'.repeat(281), aliases: ['x'] };
  assert.strictEqual(tooLongDefinition.definition.length <= 280, false);

  const multilineDefinition = { definition: 'line one\nline two', aliases: ['x'] };
  assert.ok(multilineDefinition.definition.includes('\n'), 'Expected the synthetic multiline definition to be detected as multiline');

  const noAliasDefinition = { definition: 'A definition.', aliases: [] as string[] };
  assert.strictEqual(noAliasDefinition.aliases.length >= 1, false);
});

// ---------------------------------------------------------------------------------------------
// Check B: no forward references -- every underscored ALL_CAPS token inside any definition or
// boundary rule string must be a real EventCategory or EventType member. This is the check that
// fails loudly if a not-yet-real token (e.g. TOOLS_AND_HARDWARE, SHOPPING_AND_RETAIL -- both
// still Deferred/Rejected by AD-44) or a typo of a real member ever appears here. As of Story
// 0.53, HOME_AND_LIVING/FASHION_AND_BEAUTY/FINANCE_AND_INVESTMENT/GADGETS_AND_DEVICES are real
// members, so they are legal to name -- see the "positive confirmation" test below.
// ---------------------------------------------------------------------------------------------

test('Check B: no unknown ALL_CAPS tokens in any definition or boundary rule', () => {
  const offenders: string[] = [];

  for (const category of Object.values(EventCategory)) {
    const entry = EVENT_CATEGORY_DEFINITIONS[category];
    const unknown = findUnknownTokens(entry.definition);
    if (unknown.length > 0) {
      offenders.push(`${category} definition: ${unknown.join(', ')}`);
    }
  }

  for (const boundary of CATEGORY_BOUNDARIES) {
    const unknown = findUnknownTokens(boundary.rule);
    if (unknown.length > 0) {
      offenders.push(`boundary ${boundary.id}: ${unknown.join(', ')}`);
    }
  }

  assert.deepStrictEqual(offenders, [], `Found unknown ALL_CAPS token(s) outside EventCategory/EventType: ${offenders.join('; ')}`);

  // Positive confirmation the scan isn't vacuous: at least one real EventCategory member DOES
  // appear across the boundary rules (they deliberately name categories to state routing rules).
  const allBoundaryText = CATEGORY_BOUNDARIES.map((b) => b.rule).join(' ');
  assert.ok(
    Object.values(EventCategory).some((c) => allBoundaryText.includes(c)),
    'Expected at least one real EventCategory member name to appear in the boundary rules (vacuous-scan guard)'
  );
});

test('Check B negative control: a synthetic forward-reference token is flagged, and a non-underscored word is not', () => {
  // Story 0.53: HOME_AND_LIVING, FASHION_AND_BEAUTY, FINANCE_AND_INVESTMENT, and
  // GADGETS_AND_DEVICES are now real EventCategory members (added by this story), so
  // findUnknownTokens correctly no longer flags them -- see the "positive confirmation" test
  // below for that behavior flip. This negative control now exercises tokens that remain
  // genuinely unknown at 22 values: TOOLS_AND_HARDWARE and SHOPPING_AND_RETAIL, both explicitly
  // Deferred/Rejected by AD-44 (not planned without a further architecture change), so they are
  // safe, stable choices that won't themselves become real members out from under this test.
  const forbiddenSnippet = 'Hardware and power tools route to TOOLS_AND_HARDWARE, not OTHER.';
  assert.deepStrictEqual(findUnknownTokens(forbiddenSnippet), ['TOOLS_AND_HARDWARE']);

  assert.deepStrictEqual(
    findUnknownTokens('Mall-wide sales route to SHOPPING_AND_RETAIL, not OTHER.'),
    ['SHOPPING_AND_RETAIL']
  );

  // The regex only targets underscored ALL_CAPS tokens (per AC4(b)'s own scope) -- a single-word
  // typo like "MUSICC" has no underscore and is intentionally out of scope for this check. An
  // underscored typo of a real member IS caught:
  const typoSnippet = 'Route to BUSINESS_AND_NETWORKED when unsure.';
  assert.deepStrictEqual(findUnknownTokens(typoSnippet), ['BUSINESS_AND_NETWORKED']);

  const safeSnippet = 'Route to MUSIC or OTHER when unsure, never UMKM alone.';
  assert.deepStrictEqual(findUnknownTokens(safeSnippet), []);
});

test('Check B positive confirmation: all 4 of Story 0.53\'s new tokens appear in real boundary/definition prose, unflagged', () => {
  // Proves the behavior actually flipped from "forbidden" to "legal" for these four tokens,
  // rather than only inferring it from Check A/B passing overall.
  const newTokens = ['HOME_AND_LIVING', 'FASHION_AND_BEAUTY', 'FINANCE_AND_INVESTMENT', 'GADGETS_AND_DEVICES'] as const;

  const allDefinitionText = Object.values(EVENT_CATEGORY_DEFINITIONS)
    .map((entry) => entry.definition)
    .join(' ');
  const allBoundaryText = CATEGORY_BOUNDARIES.map((b) => b.rule).join(' ');
  const haystack = `${allDefinitionText} ${allBoundaryText}`;

  for (const token of newTokens) {
    assert.ok(haystack.includes(token), `Expected ${token} to appear somewhere in real definitions/boundaries`);
    assert.deepStrictEqual(findUnknownTokens(token), [], `Expected ${token} to no longer be flagged as an unknown token`);
  }
});

// ---------------------------------------------------------------------------------------------
// Check C/D: render-and-assert on the ACTUAL built prompts (not a source grep).
// ---------------------------------------------------------------------------------------------

function countDistinctCategoryMentions(text: string): Set<string> {
  const found = new Set<string>();
  for (const category of Object.values(EventCategory)) {
    const pattern = new RegExp(`\\b${category}\\b`);
    if (pattern.test(text)) {
      found.add(category);
    }
  }
  return found;
}

function occurrencesOutsideGlossary(text: string, glossary: string): string {
  const index = text.indexOf(glossary);
  assert.notStrictEqual(index, -1, 'Expected the glossary block to be present in the built prompt');
  return text.slice(0, index) + text.slice(index + glossary.length);
}

test('Check C/D: both built prompts embed renderEventCategoryGlossary() output verbatim exactly once, and name fewer than 3 distinct categories outside it', async () => {
  const glossary = renderEventCategoryGlossary();

  const { request } = await buildGeminiExtractionRequest(MINIMAL_MESSAGE);
  const geminiPrompt = request.systemInstruction ?? '';
  const geminiOccurrences = geminiPrompt.split(glossary).length - 1;
  assert.strictEqual(geminiOccurrences, 1, `Expected buildGeminiExtractionRequest's prompt to contain the glossary exactly once, found ${geminiOccurrences}`);
  const geminiOutside = occurrencesOutsideGlossary(geminiPrompt, glossary);
  const geminiOutsideCategories = countDistinctCategoryMentions(geminiOutside);
  assert.ok(
    geminiOutsideCategories.size < 3,
    `Expected fewer than 3 distinct EventCategory names outside the glossary block in the extraction prompt, found: ${[...geminiOutsideCategories].join(', ')}`
  );

  const filterPrompt = buildFilterExtractionSystemInstruction();
  const filterOccurrences = filterPrompt.split(glossary).length - 1;
  assert.strictEqual(filterOccurrences, 1, `Expected buildFilterExtractionSystemInstruction's prompt to contain the glossary exactly once, found ${filterOccurrences}`);
  const filterOutside = occurrencesOutsideGlossary(filterPrompt, glossary);
  const filterOutsideCategories = countDistinctCategoryMentions(filterOutside);
  assert.ok(
    filterOutsideCategories.size < 3,
    `Expected fewer than 3 distinct EventCategory names outside the glossary block in the filter prompt, found: ${[...filterOutsideCategories].join(', ')}`
  );
});

test('Check C negative control: a synthetic prompt built without calling the renderer fails the verbatim-inclusion check', () => {
  const glossary = renderEventCategoryGlossary();
  const syntheticPrompt = 'Pick categories from this bespoke, hand-typed list: MUSIC, OTHER.';
  const occurrences = syntheticPrompt.split(glossary).length - 1;
  assert.strictEqual(occurrences, 0, 'Expected a synthetic prompt that never calls the renderer to contain zero copies of its output');
});

test('Check D negative control: a synthetic prompt with a second, separately-typed list of 3+ categories is flagged', () => {
  const glossary = renderEventCategoryGlossary();
  const syntheticPrompt =
    `${glossary}\n\nAlso remember: MUSIC, ARTS_AND_CULTURE, and FOOD_AND_DRINK are especially common.`;
  const outside = occurrencesOutsideGlossary(syntheticPrompt, glossary);
  const outsideCategories = countDistinctCategoryMentions(outside);
  assert.ok(
    outsideCategories.size >= 3,
    `Expected the synthetic second list to be detected as 3+ distinct categories outside the glossary, found: ${[...outsideCategories].join(', ')}`
  );
});

// Check E (found 2026-10-24: Story 0.52 added `export * from './event-category-definitions.js'` to
// shared-types, which broke `next build` -- webpack cannot resolve a `.js` specifier against a raw
// `.ts` file, and shared-types' `main` is its TypeScript source, not a compiled dist). shared-types
// is a CommonJS package, so extensionless relative imports are legal under NodeNext too. Guard it.
const RELATIVE_JS_IMPORT = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]*\.js)['"]/g;

function findRelativeJsImports(source: string): string[] {
  return [...source.matchAll(RELATIVE_JS_IMPORT)].map((m) => m[1]);
}

const SHARED_TYPES_SRC = resolve(process.cwd(), '..', '..', 'packages', 'shared-types', 'src');

test('Check E: shared-types source files use no `.js`-suffixed relative imports (they break next build)', () => {
  // Recursive, so a file added in a subdirectory later is scanned too.
  const listTsFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return listTsFiles(full);
      return entry.endsWith('.ts') && !entry.endsWith('.d.ts') ? [full] : [];
    });
  const files = listTsFiles(SHARED_TYPES_SRC);
  assert.ok(files.length >= 2, `Expected to scan at least index.ts and event-category-definitions.ts, found: ${files.join(', ')}`);
  const offenders: string[] = [];
  let relativeImportsSeen = 0;
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    relativeImportsSeen += (source.match(/(?:from|import)\s*\(?\s*['"]\.{1,2}\//g) ?? []).length;
    for (const spec of findRelativeJsImports(source)) offenders.push(`${file.replace(SHARED_TYPES_SRC, '')}: ${spec}`);
  }
  // Positive confirmation the scan is not vacuous: shared-types does have relative imports today.
  assert.ok(relativeImportsSeen >= 2, `Expected to see the index.ts re-export and the type-only import, saw ${relativeImportsSeen}`);
  assert.deepStrictEqual(offenders, [], `Remove the .js extension from these shared-types imports: ${offenders.join('; ')}`);
});

test('Check E negative control: a synthetic `.js` relative import is flagged, an extensionless one is not', () => {
  assert.deepStrictEqual(findRelativeJsImports("export * from './foo.js';"), ['./foo.js']);
  assert.deepStrictEqual(findRelativeJsImports("import type { X } from '../bar.js';"), ['../bar.js']);
  assert.deepStrictEqual(findRelativeJsImports("export * from './foo';"), []);
  assert.deepStrictEqual(findRelativeJsImports("import x from 'some-package/thing.js';"), []);
});
