/**
 * Integration proof (Story 0.44's testing tier, AC13): browser-automation/AST-analysis surfaces
 * that can't be meaningfully unit-tested without mocking away the thing being verified are
 * proved here by actually running the example manifest entries end-to-end (isolated render,
 * both audit modes, all five AD-26 Rule 5/6 rule classes, and the pixel-diff secondary signal).
 *
 * Review Follow-up (2026-09-22): the previous `toHaveScreenshot()`-based pixel-diff test is
 * removed -- it diffed a self-captured baseline against the exact same render being checked, so
 * it could never fail by construction, and it pinned a win32-qualified snapshot file that would
 * fail outright on Linux CI (decision-needed item 3 / patch item 8). The real pixel-diff signal
 * (against `reference.prototypePngPath`'s actual source PNG, via `compare/pixel-diff.ts`) is now
 * exercised as part of `runManifestEntry` itself (patch item 6) and asserted below alongside the
 * other rule classes -- no separate snapshot mechanism, no committed platform-specific baseline.
 */

import { test, expect } from '@playwright/test';
import path from 'node:path';
import './manifests/index.js';
import { runManifestEntry } from './src/engine.js';
import { defaultRegistry, registerManifestEntry, type ManifestEntry } from './src/manifest.js';
import { MOBILE_PANEL_HTML } from './manifests/event-card-masonry-thumbnail-fallback.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

test.describe('reference-based example: EventCardMasonry default-thumbnail-fallback (mobile)', () => {
  const NAME = 'event-card-masonry:default-thumbnail-fallback:175x400';

  test('manifest entry is registered under the expected component/variant/viewport triple', () => {
    expect(defaultRegistry.has(NAME)).toBe(true);
    const entry = defaultRegistry.get(NAME);
    expect(entry.mode).toBe('reference');
    expect(entry.renderScope).toBe('single-instance');
  });

  test('runs all declared rule classes plus the pixel-diff signal, and passes', async ({ page }) => {
    const result = await runManifestEntry(page, NAME, { repoRoot: REPO_ROOT });

    for (const ruleResult of result.ruleResults) {
      expect(ruleResult.pass, `${ruleResult.kind}: ${ruleResult.message}`).toBe(true);
    }
    expect(result.pass).toBe(true);

    const kinds = result.ruleResults.map((r) => r.kind).sort();
    // 'pixel-diff' (patch item 6): the secondary signal is now part of the engine's own result,
    // not just a separate toHaveScreenshot() test -- AC6's "failure in either signal fails the
    // check" is enforced by runManifestEntry itself.
    expect(kinds).toEqual(['color', 'intra-box-ratio', 'overflow', 'pixel-diff', 'sibling-dimension']);

    // The pixel-diff result really read the source-of-truth PNG (decision-needed item 3) --
    // confirm it reports real pixel counts against that file, not a self-captured baseline.
    const pixelDiffResult = result.ruleResults.find((r) => r.kind === 'pixel-diff');
    const details = pixelDiffResult?.details as { totalPixels: number; diffPixelCount: number } | undefined;
    expect(details?.totalPixels).toBeGreaterThan(0);
    expect(pixelDiffResult?.message).toContain('default-thumbnail-fallback.png');

    // The overflow rule enumerated formatEventStatus's real branches via ts-morph, not a
    // hand-authored list -- confirm more than the prototype's own single depicted "Now" state
    // was actually exercised (AC9's whole point).
    const overflowResult = result.ruleResults.find((r) => r.kind === 'overflow');
    const variantCount = (overflowResult?.details as { variants: unknown[] } | undefined)?.variants.length ?? 0;
    expect(variantCount).toBeGreaterThan(1);
  });

  test('negative canary: a deliberately wrong live render fails the intra-box-ratio check (Review Follow-up item 2)', async ({ page }) => {
    // Proves the fix actually closes the "can never fail" gap: the expected ratio is derived
    // from an *independently mounted* reference render (via mountReferenceFor), never from the
    // same live page being checked -- so mutating only the live page's markup here must make the
    // check fail, since the reference-derived expected ratio is unaffected by the mutation.
    const CANARY_NAME = 'event-card-masonry:default-thumbnail-fallback-canary:175x400';
    if (!defaultRegistry.has(CANARY_NAME)) {
      const baseEntry = defaultRegistry.get(NAME);
      // Shrink the month text drastically (text-xs -> text-[1px]) so the live render's actual
      // month:day font-size ratio is nowhere near the reference's real ~0.5 (12px/24px) ratio.
      const mutatedHtml = MOBILE_PANEL_HTML.replace(
        'text-xs font-bold uppercase tracking-wide pt-1.5" data-testid="date-month"',
        'text-[1px] font-bold uppercase tracking-wide pt-1.5" data-testid="date-month"'
      );
      expect(mutatedHtml).not.toBe(MOBILE_PANEL_HTML);

      const canaryEntry: ManifestEntry = {
        ...baseEntry,
        variant: 'default-thumbnail-fallback-canary',
        render: { kind: 'isolated-html', html: mutatedHtml },
        rules: [
          {
            kind: 'intra-box-ratio',
            selectorA: '[data-testid="date-month"]',
            selectorB: '[data-testid="date-day"]',
            dimension: 'fontSize',
            referenceSelectorA: '.text-xs.font-bold.uppercase.tracking-wide',
            referenceSelectorB: '.text-2xl.font-extrabold.leading-none',
          },
        ],
      };
      registerManifestEntry(CANARY_NAME, canaryEntry);
    }

    const result = await runManifestEntry(page, CANARY_NAME, { repoRoot: REPO_ROOT });
    expect(result.pass).toBe(false);
    const ratioResult = result.ruleResults[0];
    expect(ratioResult.kind).toBe('intra-box-ratio');
    expect(ratioResult.pass).toBe(false);
  });
});

test.describe('react-component mount example: CountBadge (Review Follow-up item 1)', () => {
  const NAME = 'count-badge:react-mount-overflow:200x100';

  test('manifest entry mounts a real @festgrid/ui component, not a hand-typed markup replica', () => {
    expect(defaultRegistry.has(NAME)).toBe(true);
    const entry = defaultRegistry.get(NAME);
    expect(entry.render.kind).toBe('react-component');
    expect(entry.mode).toBe('rule');
  });

  test('runs the color and intra-box-ratio checks against the real mounted component and passes', async ({ page }) => {
    const result = await runManifestEntry(page, NAME, { repoRoot: REPO_ROOT });
    for (const ruleResult of result.ruleResults) {
      expect(ruleResult.pass, `${ruleResult.kind}: ${ruleResult.message}`).toBe(true);
    }
    expect(result.pass).toBe(true);
  });
});

test.describe('rule-based example: GridContainer masonry-columns-synthetic (multi-instance)', () => {
  const NAME = 'grid-container:masonry-columns-synthetic:800x600';

  test('manifest entry is registered as rule-based, multi-instance, with no reference source', () => {
    expect(defaultRegistry.has(NAME)).toBe(true);
    const entry = defaultRegistry.get(NAME);
    expect(entry.mode).toBe('rule');
    expect(entry.renderScope).toBe('multi-instance');
    expect(entry.reference).toBeUndefined();
  });

  test('sibling-dimension rule clusters across instances (columns) and passes the AD-27 width invariant', async ({ page }) => {
    const result = await runManifestEntry(page, NAME, { repoRoot: REPO_ROOT });
    expect(result.pass).toBe(true);

    const rule = result.ruleResults[0];
    expect(rule.kind).toBe('sibling-dimension');
    const clusters = (rule.details as { clusters: Array<{ values: number[] }> }).clusters;
    // Multi-instance render scope (AC3): three independent column instances, clustered as three
    // separate single-member clusters (by horizontal overlap), not one row cluster -- proving
    // Rule 5's clustering actually operates over what this manifest rendered (Rule 1a), not
    // hardcoded to assume single-instance.
    expect(clusters.length).toBe(3);
  });
});
