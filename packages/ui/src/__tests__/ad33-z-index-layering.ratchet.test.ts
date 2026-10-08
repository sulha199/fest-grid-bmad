/**
 * Architecture Spine AD-33 (Z-Index Layering Tiers), Rule 4 — the ratchet.
 *
 * This is a repo-wide static-analysis sweep, NOT a per-component test — it is deliberately
 * located under `__tests__/` (distinct from `packages/ui`'s usual colocated `*.test.tsx`
 * convention) so a future reader doesn't mistake it for one. Same genre as the source-text
 * scan ratchets AD-33 Rule 4 cites as prior art (AD-30 Rule 2, AD-31 Rule 4): a plain Vitest
 * test that reads raw file text rather than asserting runtime behavior.
 *
 * It walks two source roots — this package's own `packages/ui/src`, and `apps/web/src` — and
 * fails if either contains:
 *   1. A raw Tailwind z-index class matching one of the four reserved tier *values*
 *      (40/45/50/60, bare or `z-[N]`) instead of its named token (AC1).
 *   2. A hardcoded `'z-overlay-modal'` literal instead of importing `OVERLAY_MODAL_Z`,
 *      outside the one file that is allowed to define it (AC2, AC3).
 *   3. A file that renders a `@radix-ui/*` `Portal` (every such portal is an overlay --
 *      dialog/sheet/popover/select/menu -- per AD-33 Rule 3's own enumeration) without also
 *      importing `OVERLAY_MODAL_Z` (FIND-081: a fifth Radix Portal wrapper,
 *      `confirm-action-dialog.tsx`, was missed by Rule 3's four-wrapper list and Assertions 1/2
 *      above cannot catch an *absent* tier, only a wrong or inlined one).
 *
 * `z-0`/`z-10`/`z-20`/`z-30` (Local tier) are deliberately never scanned (AC4) — AD-33 Rule 4
 * states there's no reliable static check for "does this component's root carry `isolate`,"
 * so Local-tier correctness stays a code-review convention, not a CI gate.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/** Directory path segments that exclude a path from the walk entirely. */
const EXCLUDED_SEGMENTS = ['__tests__', 'node_modules', 'generated'];

/** Filename substrings that exclude a file from the walk (test/spec/story files). */
const EXCLUDED_FILENAME_MARKERS = ['.test.', '.spec.', '.stories.'];

const INCLUDED_EXTENSIONS = ['.ts', '.tsx'];

/**
 * The one legitimate exception: `overlay-z.ts` must contain the literal `'z-overlay-modal'`
 * to define `OVERLAY_MODAL_Z` in the first place (AC2). It is exempted from Assertion 2 only
 * — it contains no raw numeral class, so Assertion 1 would never flag it regardless.
 */
const OVERLAY_Z_DEFINITION_FILE = path.resolve(__dirname, '../core/overlay-z.ts');

// Resolved relative to this test file's own location (not process.cwd(), which varies by how
// Vitest is invoked) so the walk works regardless of the working directory the suite runs from.
const UI_SRC_ROOT = path.resolve(__dirname, '..');
const WEB_SRC_ROOT = path.resolve(__dirname, '../../../../apps/web/src');

// Verify the empirically-derived relative climb to apps/web/src actually resolves before
// trusting it for the walk below (Task 1.2's explicit instruction).
if (!fs.existsSync(WEB_SRC_ROOT)) {
  throw new Error(
    `AD-33 ratchet: resolved apps/web/src root does not exist: ${WEB_SRC_ROOT}. ` +
      'The relative path climb from packages/ui/src/__tests__ needs to be re-verified.'
  );
}

function shouldSkipDirectory(dirName: string): boolean {
  return EXCLUDED_SEGMENTS.includes(dirName);
}

function shouldSkipFile(fileName: string): boolean {
  if (!INCLUDED_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
    return true;
  }
  return EXCLUDED_FILENAME_MARKERS.some((marker) => fileName.includes(marker));
}

/** Recursively collects every non-excluded `.ts`/`.tsx` file under `root`. */
function walk(root: string): string[] {
  const results: string[] = [];

  function visit(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) continue;
        visit(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        if (shouldSkipFile(entry.name)) continue;
        results.push(path.join(dir, entry.name));
      }
    }
  }

  visit(root);
  return results;
}

function collectFiles(): string[] {
  return [...walk(UI_SRC_ROOT), ...walk(WEB_SRC_ROOT)];
}

interface Hit {
  file: string;
  line: number;
  match: string;
}

function formatHits(hits: Hit[]): string {
  return hits
    .map((hit) => `  ${path.relative(process.cwd(), hit.file)}:${hit.line} -> \`${hit.match}\``)
    .join('\n');
}

/**
 * Whole-token match of the four reserved tier *values* (40/45/50/60), bare or `z-[N]`.
 * The negative lookbehind/lookahead on word chars and `-` prevents matching inside a longer
 * identifier (e.g. `z-400`) or substring (e.g. a CSS custom property name).
 */
const RAW_TIER_VALUE_PATTERN = /(?<![\w-])z-(?:40|45|50|60|\[40\]|\[45\]|\[50\]|\[60\])(?![\w-])/g;

/** Hardcoded `'z-overlay-modal'` string literal, either quote style. */
const OVERLAY_MODAL_LITERAL_PATTERN = /['"]z-overlay-modal['"]/g;

/** A `from '@radix-ui/...'` / `from "@radix-ui/..."` import (any quote style). */
const RADIX_IMPORT_PATTERN = /from\s+['"]@radix-ui\//;

/** Use of a Radix primitive's `Portal` (e.g. `Dialog.Portal`, `SheetPrimitive.Portal`). */
const RADIX_PORTAL_USAGE_PATTERN = /\.Portal\b/;

/** An `OVERLAY_MODAL_Z` import or reference anywhere in the file. */
const OVERLAY_MODAL_Z_REFERENCE_PATTERN = /OVERLAY_MODAL_Z/;

/**
 * Blanks out comment content (block `/* ... *\/` and line `// ...`) before scanning, so a
 * comment that merely *mentions* a tier-value class or the overlay-modal literal in prose
 * (e.g. explaining the anti-pattern it prevents, or transcribing a design-token source value)
 * isn't mistaken for an actual usage. Replaces comment characters with spaces rather than
 * removing them, so line numbers in reported hits stay accurate against the original file.
 */
function stripComments(text: string): string {
  const noBlockComments = text.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));
  return noBlockComments.replace(/\/\/.*$/gm, (match) => ' '.repeat(match.length));
}

function scanFile(file: string, pattern: RegExp): Hit[] {
  const text = stripComments(fs.readFileSync(file, 'utf8'));
  const lines = text.split('\n');
  const hits: Hit[] = [];

  lines.forEach((lineText, index) => {
    const lineMatches = lineText.match(pattern);
    if (lineMatches) {
      for (const match of lineMatches) {
        hits.push({ file, line: index + 1, match });
      }
    }
  });

  return hits;
}

describe('AD-33 z-index layering ratchet', () => {
  it('contains no raw tier-value z-index class (z-40/45/50/60, bare or z-[N])', () => {
    const files = collectFiles();
    const hits: Hit[] = [];

    for (const file of files) {
      hits.push(...scanFile(file, RAW_TIER_VALUE_PATTERN));
    }

    expect(
      hits,
      `Found raw tier-value z-index class(es). Use the named AD-33 tier token instead of the ` +
        `numeral:\n${formatHits(hits)}`
    ).toHaveLength(0);
  });

  it("contains no inlined 'z-overlay-modal' literal outside its definition file", () => {
    const files = collectFiles().filter((file) => file !== OVERLAY_Z_DEFINITION_FILE);
    const hits: Hit[] = [];

    for (const file of files) {
      hits.push(...scanFile(file, OVERLAY_MODAL_LITERAL_PATTERN));
    }

    expect(
      hits,
      `Found hardcoded 'z-overlay-modal' literal(s). Import OVERLAY_MODAL_Z from ` +
        `packages/ui/src/core/overlay-z.ts instead of inlining the class name:\n${formatHits(hits)}`
    ).toHaveLength(0);
  });

  it('every file using a Radix Portal imports OVERLAY_MODAL_Z (FIND-081)', () => {
    const files = collectFiles().filter((file) => file !== OVERLAY_Z_DEFINITION_FILE);
    const offenders: string[] = [];

    for (const file of files) {
      const text = stripComments(fs.readFileSync(file, 'utf8'));
      const usesRadixPortal = RADIX_IMPORT_PATTERN.test(text) && RADIX_PORTAL_USAGE_PATTERN.test(text);
      if (usesRadixPortal && !OVERLAY_MODAL_Z_REFERENCE_PATTERN.test(text)) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }

    expect(
      offenders,
      `Found Radix Portal-using file(s) with no OVERLAY_MODAL_Z import. Every dialog/sheet/` +
        `popover/select/menu built on a Radix Portal must use the shared AD-33 tier token:\n` +
        offenders.map((f) => `  ${f}`).join('\n')
    ).toHaveLength(0);
  });
});
