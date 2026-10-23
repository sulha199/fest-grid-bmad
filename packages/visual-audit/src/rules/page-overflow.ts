/**
 * Page-level horizontal overflow rule -- pure logic (no Playwright/DOM dependency, so it is
 * unit-testable directly; the DOM walk lives in `compare/page-overflow.ts`, mirroring the
 * `sibling-dimension.ts` / `engine.ts` split).
 *
 * Complements `overflow.ts` (element-level `scrollWidth > clientWidth` on a named slot): this rule
 * answers "does anything make the *document* wider than the viewport, and which element is it".
 */

/** One link of an element's ancestor chain, as read by the in-page walker. */
export interface SelectorSegment {
  tag: string;
  id: string;
  classes: string[];
  /** 1-based index among same-tag siblings. */
  nthOfType: number;
  /** True when the element has no same-tag sibling (nth-of-type would be redundant). */
  onlyOfType: boolean;
}

/** An element whose right edge crosses the viewport, as read by the in-page walker. */
export interface RawOverflowCandidate {
  path: string;
  tag: string;
  classes: string;
  depth: number;
  left: number;
  right: number;
  width: number;
}

export interface PageOverflowOffender extends RawOverflowCandidate {
  /** Px by which this element's right edge exceeds the viewport. */
  overflowPx: number;
  /** True when no ancestor of this element also overflows -- i.e. this is where the overflow starts. */
  isRoot: boolean;
  /** Number of other overflowing elements nested inside this one. */
  descendantCount: number;
}

export interface PageOverflowResult {
  scrollWidth: number;
  clientWidth: number;
  /** `scrollWidth - clientWidth`, floored at 0. */
  overflowPx: number;
  /** `html`/`body` has `overflow-x: hidden|clip`, so a stretched document would read as 0 overflow. */
  masked: boolean;
  offenders: PageOverflowOffender[];
}

/** Sub-pixel layout rounding must not read as overflow. */
export const OVERFLOW_EPSILON_PX = 0.5;

const MAX_CLASS_SEGMENTS = 3;
const MAX_CLASS_LENGTH = 40;

/** Builds a stable, human-readable CSS-ish path (`main#root > div.grid.gap-4:nth-of-type(2)`). */
export function formatSelectorPath(chain: SelectorSegment[]): string {
  return chain
    .map((seg) => {
      let out = seg.tag.toLowerCase();
      if (seg.id) {
        out += `#${seg.id}`;
      } else {
        const classes = seg.classes
          // Skip CSS-module / next-font hashes (`__variable_d8ebd1`): unstable across builds, no signal.
          .filter((c) => c.length > 0 && c.length <= MAX_CLASS_LENGTH && !c.startsWith('__'))
          .slice(0, MAX_CLASS_SEGMENTS);
        for (const c of classes) out += `.${c}`;
        if (!seg.onlyOfType) out += `:nth-of-type(${seg.nthOfType})`;
      }
      return out;
    })
    .join(' > ');
}

/**
 * Ranks overflowing elements. Roots (no overflowing ancestor) are where the overflow *starts*, so
 * they come first; within each group the largest overshoot wins. Descendants of a root are kept
 * (they show what the root contains) but sorted after every root.
 */
export function rankOffenders(candidates: RawOverflowCandidate[], clientWidth: number): PageOverflowOffender[] {
  const offenders = candidates.map((c) => {
    const isRoot = !candidates.some((other) => other !== c && c.path.startsWith(`${other.path} > `));
    const descendantCount = candidates.filter((other) => other !== c && other.path.startsWith(`${c.path} > `)).length;
    return { ...c, overflowPx: Math.round((c.right - clientWidth) * 10) / 10, isRoot, descendantCount };
  });
  return offenders.sort((a, b) => {
    if (a.isRoot !== b.isRoot) return a.isRoot ? -1 : 1;
    if (b.overflowPx !== a.overflowPx) return b.overflowPx - a.overflowPx;
    return a.depth - b.depth;
  });
}

/** Assembles the final result; offenders are only meaningful when something actually overflows or is masked. */
export function buildPageOverflowResult(input: {
  scrollWidth: number;
  clientWidth: number;
  masked: boolean;
  candidates: RawOverflowCandidate[];
}): PageOverflowResult {
  const overflowPx = Math.max(0, input.scrollWidth - input.clientWidth);
  const hasProblem = overflowPx > 0 || input.masked;
  return {
    scrollWidth: input.scrollWidth,
    clientWidth: input.clientWidth,
    overflowPx,
    masked: input.masked,
    offenders: hasProblem ? rankOffenders(input.candidates, input.clientWidth) : [],
  };
}

/** True when the page needs attention: a real horizontal scrollbar, or overflow hidden behind `overflow-x: hidden`. */
export function isOverflowing(result: PageOverflowResult): boolean {
  return result.overflowPx > 0 || (result.masked && result.offenders.length > 0);
}

const CRASH_TEXT = /Application error: a client-side exception|Internal Server Error|This page couldn.t load/i;

/**
 * A crashed or blank page has nothing to overflow, so measuring it reports a false "ok". Returns a
 * human-readable reason when the page did not render usable content, otherwise `null`.
 */
export function classifyPageHealth(input: { pageErrors: string[]; bodyText: string }): string | null {
  if (input.pageErrors.length > 0) return `uncaught page error: ${input.pageErrors[0].slice(0, 200)}`;
  if (CRASH_TEXT.test(input.bodyText)) return 'framework error screen rendered';
  if (input.bodyText.trim().length === 0) return 'page rendered no text content';
  return null;
}

/** Drops the `html > body >` scaffolding every path shares, so report lines show the part that differs. */
export function shortenPath(path: string): string {
  const parts = path.split(' > ');
  if (parts.length > 2 && /^html\b/.test(parts[0]) && /^body\b/.test(parts[1])) return parts.slice(2).join(' > ');
  return path;
}

/** Grouping key: same element regardless of which sibling slot it landed in on a given route. */
export function culpritKey(path: string): string {
  return shortenPath(path).replace(/:nth-of-type\(\d+\)/g, '');
}
