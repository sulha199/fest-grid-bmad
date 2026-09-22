/**
 * Reference-based example manifest entry (AC2, AC11): checks the mobile panel of the
 * already-validated `event-card-masonry/default-thumbnail-fallback.html` prototype (see
 * `design-artifacts/UX-festgrid-run-1/prototypes/validation-log.md`) against a "live render".
 *
 * Judgment call (documented): this story ships no consumer of `packages/visual-audit` yet with
 * a real React component to mount (the tool's real adopters -- BUG-040's fix, AD-27's masonry
 * engine -- are future stories, see AC11/Out of Scope). To prove the engine mechanism end-to-end
 * without inventing a throwaway React component, the "live render" here is the validated
 * prototype's own markup, isolated-rendered via `page.setContent()` (AD-26 Rule 4 -- no server/
 * DB/auth either way). This trivially matches its own reference by construction; it exists to
 * prove the check machinery runs correctly (computed-style extraction, pixel-diff wiring,
 * sibling-clustering, ratio-checking, ts-morph overflow enumeration, color-token matching), not
 * to catch a defect in this specific card. A real future consumer swaps in an actual component
 * render via the same `RenderSpec` shape.
 */

import { registerManifestEntry, type ManifestEntry } from '../src/manifest.js';

// The mobile panel's markup, extracted verbatim from the validated prototype file so the
// isolated render and the reference file share exactly the same DOM (see judgment call above).
// Exported so the proof spec's negative "canary" test (Review Follow-up item 2) can mutate a
// copy of it without duplicating the whole fixture.
export const MOBILE_PANEL_HTML = `
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          background: 'hsl(210 20% 98%)',
          foreground: 'hsl(221 39% 11%)',
          card: 'hsl(0 0% 100%)',
          primary: 'hsl(217 33% 17%)',
          secondary: 'hsl(238 82% 67%)',
          'secondary-foreground': 'hsl(210 40% 98%)',
          muted: 'hsl(210 40% 96.1%)',
          'muted-foreground': 'hsl(215.4 16.3% 46.9%)',
        }
      }
    }
  }
</script>
<style>body{font-family:Inter,sans-serif; margin:0;}</style>
<div class="p-6 bg-slate-100">
  <div class="w-[175px] rounded-lg shadow-md bg-background overflow-hidden" data-testid="masonry-card">
    <div class="p-2 flex items-stretch gap-1.5">
      <div class="relative flex flex-col justify-center gap-0.5 px-2.5 py-2 rounded-md bg-slate-800 text-white shadow-sm shrink-0 leading-none" data-testid="date-box">
        <span class="absolute -top-1.5 -left-1.5 z-20 px-1.5 py-1 rounded-full bg-amber-700 text-white text-xs font-semibold leading-none shadow-sm whitespace-nowrap">TILL</span>
        <span class="text-xs font-bold uppercase tracking-wide pt-1.5" data-testid="date-month">Oct</span>
        <span class="text-2xl font-extrabold leading-none" data-testid="date-day">12</span>
      </div>
      <div class="relative flex-1 h-full min-w-0 rounded-md flex items-center justify-center">
        <button type="button" class="flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-11 text-sm font-medium text-foreground">
          <svg class="w-10 h-10 text-rose-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21s-6.7-4.35-9.3-8.13C.6 9.9 1.4 6.4 4.3 5.1c2-.9 4.2-.2 5.7 1.5C11.5 4.9 13.7 4.2 15.7 5.1c2.9 1.3 3.7 4.8 1.6 7.77C18.7 16.65 12 21 12 21z"/></svg>
          <span>1.2k</span>
        </button>
      </div>
    </div>
    <div class="px-2 pb-2 flex flex-col gap-1">
      <div class="flex items-center gap-1 flex-wrap" data-testid="badge-row">
        <span class="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0 bg-secondary text-secondary-foreground" data-testid="badge-distance">
          <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          4.1 km
        </span>
        <span class="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0 bg-emerald-600 text-white" data-testid="badge-status">Now</span>
      </div>
      <div class="text-sm font-bold text-foreground leading-tight line-clamp-2">AI Tech Summit 2026: International Edition</div>
      <div class="text-xs text-muted-foreground truncate">Blue Note Lounge</div>
    </div>
  </div>
</div>
`;

/** Overflow fixture: renders one enumerated `formatEventStatus` branch's return-expression text
 * into the same fixed-width status-badge slot the card actually uses, at the card's narrowest
 * real width (175px, mobile 2-col) -- the exact class the badge ships with in production
 * (`text-[11px] px-1.5 py-0.5 rounded ... shrink-0`), so a too-long variant would genuinely wrap
 * or overflow the same way it would in the real card. */
function buildStatusBadgeOverflowFixture(variantText: string): string {
  return `
<script src="https://cdn.tailwindcss.com"></script>
<style>body{font-family:Inter,sans-serif; margin:0;}</style>
<div class="p-6 bg-slate-100">
  <div class="w-[175px] flex items-center gap-1 flex-wrap">
    <span class="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0 bg-emerald-600 text-white max-w-[80px] overflow-hidden whitespace-nowrap" data-testid="status-slot">${escapeHtml(variantText)}</span>
  </div>
</div>
`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const REPO_ROOT_RELATIVE_FORMAT_EVENT_DATE = 'packages/ui/src/features/events/format-event-date.ts';

export const entry: ManifestEntry = {
  component: 'EventCardMasonry',
  variant: 'default-thumbnail-fallback',
  viewport: { width: 175, height: 400 },
  renderScope: 'single-instance',
  mode: 'reference',
  render: { kind: 'isolated-html', html: MOBILE_PANEL_HTML },
  reference: {
    prototypeHtmlPath: 'design-artifacts/UX-festgrid-run-1/prototypes/event-card-masonry/default-thumbnail-fallback.html',
    prototypePngPath: 'design-artifacts/UX-festgrid-run-1/imports/event-card-masonry/default-thumbnail-fallback.png',
    // Scope the pixel-diff secondary signal (Review Follow-up items 3/6) to the whole card --
    // the source PNG is a crop of the whole card, not a crop of any one sub-element, and this
    // comparison resizes the *whole* reference PNG to the rendered screenshot's own dimensions
    // (see compare/pixel-diff.ts), so both sides must represent the same framing; a sub-element
    // crop (e.g. just the date box) squashes the whole-card PNG into that small region and
    // produces a meaningless diff. Empirically measured at ~40% for this card (see
    // pixelDiffOptions below for why that's the accepted tolerance here, not the 2% default).
    pixelDiffSelector: '[data-testid="masonry-card"]',
    pixelDiffOptions: {
      // Per validation-log.md, this prototype's badge row/icon are a *documented, accepted*
      // deviation from this literal PNG (distance badge instead of the PNG's category badge,
      // established color tokens instead of the PNG's literal badge colors; plus this is a
      // browser/Chromium anti-aliased render diffed against a Figma raster export, not a
      // byte-identical capture). A strict 2% default tolerance would fail on content the team
      // already decided not to match pixel-for-pixel. 55% keeps this a real, meaningful check
      // (it still fails a structurally wrong render -- see the negative canary test) while not
      // failing on the known, accepted divergence (measured ~40% for the current, correct card).
      maxDiffPixelRatio: 0.55,
    },
  },
  rules: [
    // Sibling-dimension: the two badge-row pills sit on the same row and should share height
    // within the default <=2px absolute tolerance (AC7).
    { kind: 'sibling-dimension', selector: '[data-testid^="badge-"]', dimension: 'height' },
    // Intra-box ratio: month-text:day-text font-size, derived once from the real, independently
    // mounted reference prototype's own rendered ratio (no explicit DESIGN.md token declared
    // here) (AC8; Review Follow-up item 2). `referenceSelectorA/B` target the mobile panel's
    // month/day spans in the real prototype file, which carries no data-testid attributes of its
    // own (those exist only in this manifest's live-render fixture, copied from it) -- the
    // class-based selectors are unique to the mobile panel within that file (the file's desktop
    // panel uses text-lg/text-5xl, not text-xs/text-2xl).
    {
      kind: 'intra-box-ratio',
      selectorA: '[data-testid="date-month"]',
      selectorB: '[data-testid="date-day"]',
      dimension: 'fontSize',
      referenceSelectorA: '.text-xs.font-bold.uppercase.tracking-wide',
      referenceSelectorB: '.text-2xl.font-extrabold.leading-none',
    },
    // Overflow: enumerate `formatEventStatus`'s branches via ts-morph and check the status
    // badge slot for overflow on every variant, not just the "Now" state this prototype
    // happened to depict (AC9) -- the exact class of gap AD-26 exists to catch.
    {
      kind: 'overflow',
      selector: '[data-testid="status-slot"]',
      formattingFunction: { filePath: REPO_ROOT_RELATIVE_FORMAT_EVENT_DATE, functionName: 'formatEventStatus' },
      buildFixtureHtml: buildStatusBadgeOverflowFixture,
    },
    // Color: date box background must exactly match the bg-slate-800 token (AC10).
    { kind: 'color', selector: '[data-testid="date-box"]', cssProperty: 'backgroundColor', expectedToken: { name: 'bg-slate-800', resolvedValue: 'rgb(30, 41, 59)' } },
  ],
};

registerManifestEntry('event-card-masonry:default-thumbnail-fallback:175x400', entry);

// Review Follow-up (patch item 7, 2026-09-22): the re-read guard this manifest previously
// exported (`assertFormattingFunctionExists`) was dead code -- defined but never called from
// anywhere in the check flow. Rather than re-add a manifest-specific export a caller has to
// remember to invoke, the guard is now generic and built into `runOverflowRule` itself
// (`src/rules/overflow.ts`), so *every* overflow rule's formatting-function reference is
// fail-fast/loud-checked before ts-morph parses it, not just this one manifest's.
