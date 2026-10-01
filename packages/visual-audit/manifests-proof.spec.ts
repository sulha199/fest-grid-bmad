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

  test('runs the color and sibling-dimension checks against the real mounted component and passes', async ({ page }) => {
    const result = await runManifestEntry(page, NAME, { repoRoot: REPO_ROOT });
    for (const ruleResult of result.ruleResults) {
      expect(ruleResult.pass, `${ruleResult.kind}: ${ruleResult.message}`).toBe(true);
    }
    expect(result.pass).toBe(true);
  });
});

test.describe('react-component mount example: EventCardDateBox Clock-icon-hasTime-today (Review Follow-up, round 2)', () => {
  const NAME = 'event-card-date-box:clock-icon-has-time-today:220x160';

  test('manifest entry mounts the real, unmodified EventCardDateBox export', () => {
    expect(defaultRegistry.has(NAME)).toBe(true);
    const entry = defaultRegistry.get(NAME);
    expect(entry.component).toBe('EventCardDateBox');
    expect(entry.render.kind).toBe('react-component');
    expect(entry.mode).toBe('rule');
  });

  test('mounts cleanly, renders the real Clock icon inline with the month text, and passes', async ({ page }) => {
    // This is the actual regression proof: mounting EventCardDateBox previously threw
    // `ReferenceError: require is not defined` (lucide-react's dual-package hazard) before
    // reaching any assertion at all. Reaching runManifestEntry's result here at all is already
    // proof the mount mechanism works against the story's real motivating component, not just
    // the lucide-free CountBadge fallback.
    const result = await runManifestEntry(page, NAME, { repoRoot: REPO_ROOT });
    for (const ruleResult of result.ruleResults) {
      expect(ruleResult.pass, `${ruleResult.kind}: ${ruleResult.message}`).toBe(true);
    }
    expect(result.pass).toBe(true);

    // Confirms the Clock icon's own <svg> was actually found by the second color rule (which
    // throws on zero matches) -- i.e. the hasTime && dayDiff === 0 icon path genuinely rendered,
    // not just the plain month/day text.
    const iconColorResult = result.ruleResults[1];
    expect(iconColorResult.kind).toBe('color');
    expect(iconColorResult.pass).toBe(true);
  });
});

// BUG-047: the `EventCardDateBox` overflow/clipping-on-word/time-content proof (Story 1.i1n,
// BUG-040) is removed along with its manifest entry — the scenario it proved (dayVariant='word'
// sizing) is dead code now that no content source ever produces word/time content (AC-DATE-1).
// Replaced below by two durable checks for AC-DATE-4/AC-DATE-5 (added during BUG-047's own code
// review — the width/height fixes were originally verified only by a throwaway script + a unit
// test asserting an exact class-string match, which the reviewer correctly flagged as weaker
// coverage than what was removed).

test.describe('rule-based example: EventCardDateBox width-consistency-1-vs-2-digit (AC-DATE-4)', () => {
  const NAME = 'event-card-date-box:width-consistency-1-vs-2-digit:300x160';

  test('manifest entry is registered as rule-based, multi-instance', () => {
    expect(defaultRegistry.has(NAME)).toBe(true);
    const entry = defaultRegistry.get(NAME);
    expect(entry.component).toBe('EventCardDateBox');
    expect(entry.mode).toBe('rule');
    expect(entry.renderScope).toBe('multi-instance');
  });

  test('a 1-digit day ("3") and a 2-digit day ("23") render the date-box at the same width', async ({ page }) => {
    const result = await runManifestEntry(page, NAME, { repoRoot: REPO_ROOT });
    for (const ruleResult of result.ruleResults) {
      expect(ruleResult.pass, `${ruleResult.kind}: ${ruleResult.message}`).toBe(true);
    }
    expect(result.pass).toBe(true);
  });
});

test.describe('rule-based example: EventCardDateBox date-box-height-matches-thumbnail (AC-DATE-5)', () => {
  const NAME = 'event-card-date-box:date-box-height-matches-thumbnail:400x400';

  test('manifest entry mounts the real, unmodified EventCard masonry-default composition', () => {
    expect(defaultRegistry.has(NAME)).toBe(true);
    const entry = defaultRegistry.get(NAME);
    expect(entry.component).toBe('EventCard');
    expect(entry.render.kind).toBe('react-component');
    expect(entry.mode).toBe('rule');
  });

  test('the visible date-box and the adjacent thumbnail render at the same height', async ({ page }) => {
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

test.describe('rule-based example: GridContainer masonry-real-eventcard (Story 0.45 AC9, real GridContainer + EventCard)', () => {
  const NAME = 'grid-container:masonry-real-eventcard:900x700';

  test('manifest entry mounts the real, unmodified GridContainer(layout="masonry") + EventCard, not a fixture replica', () => {
    expect(defaultRegistry.has(NAME)).toBe(true);
    const entry = defaultRegistry.get(NAME);
    expect(entry.component).toBe('GridContainer');
    expect(entry.render.kind).toBe('react-component');
    expect(entry.mode).toBe('rule');
    expect(entry.renderScope).toBe('multi-instance');
  });

  test('columns share one width and the leading items land one-per-column in index order, and passes', async ({ page }) => {
    const result = await runManifestEntry(page, NAME, { repoRoot: REPO_ROOT });

    for (const ruleResult of result.ruleResults) {
      expect(ruleResult.pass, `${ruleResult.kind}: ${ruleResult.message}`).toBe(true);
    }
    expect(result.pass).toBe(true);

    const kinds = result.ruleResults.map((r) => r.kind);
    expect(kinds).toEqual(['sibling-dimension', 'intra-box-ratio', 'intra-box-ratio', 'placement-order']);

    // AC9(b)'s real signal: the first N items (N = column count) land one-per-column, left to
    // right, in index order -- the SSR/first-paint round-robin estimate this static server render
    // always exercises (no client hydration runs in this harness — see the manifest file's own
    // header for why that's the correct, deterministic thing to check here).
    const placementResult = result.ruleResults.find((r) => r.kind === 'placement-order');
    const details = placementResult?.details as { actualLeadingIndices: number[] } | undefined;
    expect(details?.actualLeadingIndices).toEqual([0, 1, 2]);
  });

  test('AD-27 Rule 1 — columns actually vary in HEIGHT independently (not CSS Grid row-locked)', async ({ page }) => {
    // The two width checks above prove the tracks are structurally equal-width columns; this
    // test proves the other half of AD-27's actual regression: unlike plain CSS Grid (which
    // shares row height across every column), each `[data-grid-container-column]` here is its
    // own independent flex-col box, so genuinely different card content (varying eventName
    // length / locationName presence, per FIXTURE_CARDS) produces genuinely different column
    // heights — not one row height shared/stretched across all three.
    await runManifestEntry(page, NAME, { repoRoot: REPO_ROOT });
    const heights: number[] = await page.$$eval('[data-grid-container-column]', (cols) =>
      cols.map((c) => c.getBoundingClientRect().height)
    );
    expect(heights).toHaveLength(3);
    const distinctHeights = new Set(heights.map((h) => Math.round(h)));
    // At least two of the three columns must differ by more than a rounding artifact --
    // proving real independent per-column height flow, not three uniformly-stretched boxes.
    expect(distinctHeights.size).toBeGreaterThan(1);
  });

  test('negative canary: a deliberately mismatched column width fails the intra-box-ratio check', async ({ page }) => {
    // Proves the real load-bearing width check can actually fail (see the manifest file's own
    // comment on why the sibling-dimension rule alone cannot): mutate one column's width class
    // in the live render so it clearly diverges from its siblings, and confirm the check catches it.
    const CANARY_NAME = 'grid-container:masonry-real-eventcard-canary:900x700';
    if (!defaultRegistry.has(CANARY_NAME)) {
      const baseEntry = defaultRegistry.get(NAME);
      const canaryEntry: ManifestEntry = {
        ...baseEntry,
        variant: 'masonry-real-eventcard-canary',
        render: {
          kind: 'react-component',
          // Reuses the real fixture, but wraps it so column 0 gets forced to double width via
          // an inline style injected after render -- a targeted DOM mutation, not a hand-typed
          // markup replica, kept minimal by post-processing the real render's own HTML.
          render: baseEntry.render.kind === 'react-component' ? baseEntry.render.render : () => { throw new Error('unreachable'); },
          documentTemplate: (bodyHtml: string) => `
<script src="https://cdn.tailwindcss.com"></script>
<style>body{font-family:Inter,sans-serif; margin:0;}
[data-grid-container-column-index="0"] { flex-grow: 4 !important; }
</style>
<div class="p-6 bg-slate-100">${bodyHtml}</div>
`,
        },
      };
      registerManifestEntry(CANARY_NAME, canaryEntry);
    }

    const result = await runManifestEntry(page, CANARY_NAME, { repoRoot: REPO_ROOT });
    expect(result.pass).toBe(false);
    const ratioResults = result.ruleResults.filter((r) => r.kind === 'intra-box-ratio');
    expect(ratioResults.some((r) => !r.pass)).toBe(true);
  });
});
