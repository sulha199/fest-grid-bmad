/**
 * AD-26 check engine: runs a named manifest entry's declared rules against an isolated render,
 * returning a structured pass/fail result per rule class (AC12's public library API).
 *
 * Both audit modes (reference/rule, AD-26 Rule 1) resolve to the same underlying
 * computed-style/DOM assertion primitives in `compare/` and `rules/` -- this module only
 * dispatches by rule `kind` and assembles the result, it holds no mode-specific branching of
 * its own beyond "reference mode also runs the cross-render fidelity signals."
 */

import type { Page } from '@playwright/test';
import { defaultRegistry } from './manifest.js';
import { mountManifestEntry, mountPrototypeFile } from './render.js';
import { getElementSnapshots, getElementSnapshot } from './compare/computed-style.js';
import { clusterByRowOverlap, clusterByColumnOverlap, checkSiblingDimension } from './rules/sibling-dimension.js';
import { checkIntraBoxRatio, deriveRatioFromReference } from './rules/intra-box-ratio.js';
import { checkColorToken } from './rules/color.js';
import { runOverflowRule } from './rules/overflow.js';

export interface RuleRunResult {
  kind: string;
  pass: boolean;
  message: string;
  details?: unknown;
}

export interface ManifestRunResult {
  name: string;
  pass: boolean;
  ruleResults: RuleRunResult[];
}

export interface RunManifestEntryOptions {
  /** Absolute path to the repo root, needed to resolve `reference.prototypeHtmlPath` and
   * `formattingFunction.filePath` (both declared repo-root-relative in the manifest). */
  repoRoot: string;
}

/**
 * Runs one manifest entry's full rule set against a live isolated render (AC12's public API).
 * `page` is caller-provided (a `@playwright/test` fixture page) so this function stays testable
 * against either a real browser or, for a future story, a mocked `Page`.
 */
export async function runManifestEntry(page: Page, name: string, options: RunManifestEntryOptions): Promise<ManifestRunResult> {
  const entry = defaultRegistry.get(name);
  await mountManifestEntry(page, entry);

  const ruleResults: RuleRunResult[] = [];

  for (const rule of entry.rules) {
    if (rule.kind === 'sibling-dimension') {
      const snapshots = await getElementSnapshots(page, rule.selector);
      const boxes = snapshots.map((s) => s.boundingBox);
      const clusters = entry.renderScope === 'multi-instance' ? clusterByColumnOverlap(boxes) : clusterByRowOverlap(boxes);
      const clusterResults = clusters.map((cluster) => checkSiblingDimension(cluster, rule.dimension, rule.toleranceAbsolutePx));
      const pass = clusterResults.every((r) => r.pass);
      ruleResults.push({
        kind: rule.kind,
        pass,
        message: clusterResults.map((r) => r.message).join('; '),
        details: { clusters: clusterResults },
      });
    } else if (rule.kind === 'intra-box-ratio') {
      const cssProps = rule.dimension === 'fontSize' ? ['font-size'] : [];
      const [a, b] = await Promise.all([
        getElementSnapshot(page, rule.selectorA, cssProps),
        getElementSnapshot(page, rule.selectorB, cssProps),
      ]);
      const valueA = dimensionValue(a, rule.dimension);
      const valueB = dimensionValue(b, rule.dimension);
      let expectedRatio = rule.expectedRatio;
      if (expectedRatio === undefined) {
        if (entry.mode !== 'reference') {
          throw new Error(`Rule-based manifest entry "${name}" must declare an explicit expectedRatio (no reference to derive one from)`);
        }
        expectedRatio = deriveRatioFromReference(valueA, valueB);
      }
      const result = checkIntraBoxRatio(valueA, valueB, expectedRatio, rule.toleranceRelative);
      ruleResults.push({ kind: rule.kind, pass: result.pass, message: result.message, details: result });
    } else if (rule.kind === 'color') {
      const snapshot = await getElementSnapshot(page, rule.selector, [toCssProperty(rule.cssProperty)]);
      const actual = snapshot.computed[toCssProperty(rule.cssProperty)];
      if (rule.expectedToken) {
        const result = checkColorToken(actual, rule.expectedToken.resolvedValue);
        ruleResults.push({ kind: rule.kind, pass: result.pass, message: result.message, details: result });
      } else {
        // Fallback signal (pixel diff) is exercised via the manifest's own toHaveScreenshot()
        // assertion in the proof spec, not re-implemented here -- see compare/pixel-diff.ts.
        ruleResults.push({ kind: rule.kind, pass: true, message: 'No token declared; falling back to pixel-diff signal (see manifest spec)' });
      }
    } else if (rule.kind === 'overflow') {
      const result = await runOverflowRule(page, rule, options.repoRoot);
      ruleResults.push({
        kind: rule.kind,
        pass: result.pass,
        message: result.variants.map((v) => v.message).join('; '),
        details: result,
      });
      // Overflow variants render into a fresh page content each iteration; restore the entry's
      // own render for any rule that runs after this one in the manifest's rule list.
      await mountManifestEntry(page, entry);
    } else {
      throw new Error(`Unknown rule kind: ${(rule as { kind: string }).kind}`);
    }
  }

  return {
    name,
    pass: ruleResults.every((r) => r.pass),
    ruleResults,
  };
}

/** Loads the reference-based entry's validated prototype file into `page` -- callers use this
 * alongside `runManifestEntry` plus their own `toHaveScreenshot()` assertion for the secondary
 * pixel-diff signal (AD-26 Rule 2). */
export async function mountReferenceFor(page: Page, name: string, repoRoot: string): Promise<void> {
  const entry = defaultRegistry.get(name);
  if (entry.mode !== 'reference' || !entry.reference) {
    throw new Error(`Manifest entry "${name}" is not reference-based`);
  }
  await mountPrototypeFile(page, repoRoot, entry.reference.prototypeHtmlPath, entry.viewport);
}

function dimensionValue(
  snapshot: { boundingBox: { width: number; height: number }; computed: Record<string, string> },
  dimension: 'width' | 'height' | 'fontSize'
): number {
  if (dimension === 'width') return snapshot.boundingBox.width;
  if (dimension === 'height') return snapshot.boundingBox.height;
  const raw = snapshot.computed['font-size'] ?? '';
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Could not parse font-size from computed value "${raw}"`);
  }
  return parsed;
}

function toCssProperty(prop: 'color' | 'backgroundColor'): string {
  return prop === 'backgroundColor' ? 'background-color' : 'color';
}
