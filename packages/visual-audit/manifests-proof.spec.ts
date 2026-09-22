/**
 * Integration proof (Story 0.44's testing tier, AC13): browser-automation/AST-analysis surfaces
 * that can't be meaningfully unit-tested without mocking away the thing being verified are
 * proved here by actually running the example manifest entries end-to-end (isolated render,
 * both audit modes, all five AD-26 Rule 5/6 rule classes, and the pixel-diff secondary signal).
 */

import { test, expect } from '@playwright/test';
import path from 'node:path';
import './manifests/index.js';
import { runManifestEntry } from './src/engine.js';
import { defaultRegistry } from './src/manifest.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

test.describe('reference-based example: EventCardMasonry default-thumbnail-fallback (mobile)', () => {
  const NAME = 'event-card-masonry:default-thumbnail-fallback:175x400';

  test('manifest entry is registered under the expected component/variant/viewport triple', () => {
    expect(defaultRegistry.has(NAME)).toBe(true);
    const entry = defaultRegistry.get(NAME);
    expect(entry.mode).toBe('reference');
    expect(entry.renderScope).toBe('single-instance');
  });

  test('runs all declared rule classes (sibling-dimension, intra-box-ratio, overflow, color) and passes', async ({ page }) => {
    const result = await runManifestEntry(page, NAME, { repoRoot: REPO_ROOT });

    for (const ruleResult of result.ruleResults) {
      expect(ruleResult.pass, `${ruleResult.kind}: ${ruleResult.message}`).toBe(true);
    }
    expect(result.pass).toBe(true);

    const kinds = result.ruleResults.map((r) => r.kind).sort();
    expect(kinds).toEqual(['color', 'intra-box-ratio', 'overflow', 'sibling-dimension']);

    // The overflow rule enumerated formatEventStatus's real branches via ts-morph, not a
    // hand-authored list -- confirm more than the prototype's own single depicted "Now" state
    // was actually exercised (AC9's whole point).
    const overflowResult = result.ruleResults.find((r) => r.kind === 'overflow');
    const variantCount = (overflowResult?.details as { variants: unknown[] } | undefined)?.variants.length ?? 0;
    expect(variantCount).toBeGreaterThan(1);
  });

  test('secondary pixel-diff signal: isolated render matches the committed baseline screenshot', async ({ page }) => {
    const entry = defaultRegistry.get(NAME);
    await page.setViewportSize(entry.viewport);
    if (entry.render.kind !== 'isolated-html') {
      throw new Error('Expected an isolated-html render spec for this example manifest entry');
    }
    const html = typeof entry.render.html === 'function' ? entry.render.html({}) : entry.render.html;
    await page.setContent(html, { waitUntil: 'load' });
    const card = page.locator('[data-testid="masonry-card"]');
    await expect(card).toHaveScreenshot('event-card-masonry-thumbnail-fallback-mobile.png', {
      maxDiffPixelRatio: 0.02,
    });
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
