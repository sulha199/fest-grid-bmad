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
import path from 'node:path';
import { defaultRegistry } from './manifest.js';
import { mountManifestEntry, mountPrototypeFile } from './render.js';
import { getElementSnapshots, getElementSnapshot } from './compare/computed-style.js';
import { clusterByRowOverlap, clusterByColumnOverlap, checkSiblingDimension } from './rules/sibling-dimension.js';
import { checkIntraBoxRatio, deriveRatioFromReference } from './rules/intra-box-ratio.js';
import { checkColorToken } from './rules/color.js';
import { runOverflowRule } from './rules/overflow.js';
import { diffScreenshotAgainstReferencePng } from './compare/pixel-diff.js';

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
        // Review Follow-up (decision-needed item 2, RULING: mount real prototype as reference +
        // negative canary, 2026-09-22): the expected ratio must come from an *independently
        // rendered* reference (the validated prototype), never from the same live page/render
        // being checked -- otherwise this rule can never fail by construction. A separate page
        // in the same browser context mounts the reference via `mountReferenceFor`.
        const referencePage = await page.context().newPage();
        try {
          await mountReferenceFor(referencePage, name, options.repoRoot);
          const [refA, refB] = await Promise.all([
            getElementSnapshot(referencePage, rule.referenceSelectorA ?? rule.selectorA, cssProps),
            getElementSnapshot(referencePage, rule.referenceSelectorB ?? rule.selectorB, cssProps),
          ]);
          expectedRatio = deriveRatioFromReference(dimensionValue(refA, rule.dimension), dimensionValue(refB, rule.dimension));
        } finally {
          await referencePage.close();
        }
      }
      const result = checkIntraBoxRatio(valueA, valueB, expectedRatio, rule.toleranceRelative);
      ruleResults.push({ kind: rule.kind, pass: result.pass, message: result.message, details: result });
    } else if (rule.kind === 'color') {
      const snapshot = await getElementSnapshot(page, rule.selector, [toCssProperty(rule.cssProperty)]);
      const actual = snapshot.computed[toCssProperty(rule.cssProperty)];
      if (rule.expectedToken) {
        const result = checkColorToken(actual, rule.expectedToken.resolvedValue);
        ruleResults.push({ kind: rule.kind, pass: result.pass, message: result.message, details: result });
      } else if (entry.mode === 'reference' && entry.reference) {
        // Review Follow-up (patch item 5, 2026-09-22): a missing token previously reported
        // pass: true trivially, so the rule could never fail and a consumer trusting the
        // structured result got false confidence. AC10's actual fallback signal is a perceptual
        // pixel diff against the source PNG -- run that for real instead.
        //
        // Review Follow-up round 3 (decision-needed, RULING user 2026-09-25, option a): this
        // used to screenshot the individual rule's own `rule.selector` element and diff it
        // against the entry's whole-card `prototypePngPath` -- an element crop compared against
        // a full-card image, which `compare/pixel-diff.ts` itself documents as "meaningless."
        // Reuse the same framing convention the entry-level pixel-diff signal below already
        // uses (`pixelDiffSelector ?? page`) instead of inventing a second one.
        const fallbackLocator = entry.reference.pixelDiffSelector ? page.locator(entry.reference.pixelDiffSelector) : page;
        const elementScreenshot = await fallbackLocator.screenshot();
        const pngPath = path.resolve(options.repoRoot, entry.reference.prototypePngPath);
        const diffResult = await diffScreenshotAgainstReferencePng(elementScreenshot, pngPath, entry.reference.pixelDiffOptions);
        ruleResults.push({
          kind: rule.kind,
          pass: diffResult.pass,
          message: `No token declared; used pixel-diff fallback signal -- ${diffResult.message}`,
          details: diffResult,
        });
      } else {
        // Rule-based entries have no reference PNG to fall back to -- a color rule with no
        // token here is a genuine authoring gap, not something to silently pass.
        ruleResults.push({
          kind: rule.kind,
          pass: false,
          message: 'No token declared and no reference PNG available for the pixel-diff fallback signal (AC10) -- color fidelity cannot be verified',
        });
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

  // Review Follow-up (patch item 6, 2026-09-22): AC6 requires "a failure in either signal fails
  // the check" -- previously the pixel-diff signal was only ever exercised by the proof spec's
  // own separate `toHaveScreenshot()` test, never by `runManifestEntry` itself, so a future
  // consumer calling this API directly would never see a visual-divergence failure. Every
  // reference-mode entry with a declared PNG now runs the real pixel-diff signal here too.
  if (entry.mode === 'reference' && entry.reference) {
    await mountManifestEntry(page, entry);
    const locator = entry.reference.pixelDiffSelector ? page.locator(entry.reference.pixelDiffSelector) : page;
    const screenshotBuffer = await locator.screenshot();
    const pngPath = path.resolve(options.repoRoot, entry.reference.prototypePngPath);
    const diffResult = await diffScreenshotAgainstReferencePng(screenshotBuffer, pngPath, entry.reference.pixelDiffOptions);
    ruleResults.push({ kind: 'pixel-diff', pass: diffResult.pass, message: diffResult.message, details: diffResult });
  }

  return {
    name,
    pass: ruleResults.every((r) => r.pass),
    ruleResults,
  };
}

/** Loads a reference-based entry's validated prototype file into an independently-mounted
 * `page` -- distinct from the live render `runManifestEntry` checks. Used internally for
 * intra-box-ratio expected-ratio derivation and for `runManifestEntry`'s own pixel-diff signal,
 * which each need a render of the *reference* (not the render under test) to compare against.
 * (Review Follow-up round 3, patch item: the older doc comment describing a caller-added
 * `toHaveScreenshot()` assertion is stale -- that mechanism was removed in the prior review
 * round; the pixel-diff signal now runs inside `runManifestEntry` itself.) */
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
