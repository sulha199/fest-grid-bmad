/**
 * In-page DOM walk for page-level horizontal overflow. Browser-automation surface: proven by the
 * `page-overflow-audit` sweep running against a real page, not by mocking `page.evaluate`.
 */

import type { Page } from '@playwright/test';
import {
  buildPageOverflowResult,
  formatSelectorPath,
  OVERFLOW_EPSILON_PX,
  type PageOverflowResult,
  type RawOverflowCandidate,
  type SelectorSegment,
} from '../rules/page-overflow.js';

const MAX_CANDIDATES = 300;

interface InPageInput {
  epsilon: number;
  maxCandidates: number;
}

interface InPageOutput {
  scrollWidth: number;
  clientWidth: number;
  masked: boolean;
  chains: Array<{ chain: SelectorSegment[]; tag: string; classes: string; depth: number; left: number; right: number; width: number }>;
}

/**
 * tsx/esbuild's keepNames wraps named inner functions in a module-scope `__name` helper that does
 * not exist once a `page.evaluate` callback is serialised into the page. Defined from a plain
 * string so the transformer cannot rewrite it. Per page load -- call again after a navigation.
 */
export async function installEvaluateHelpers(page: Page): Promise<void> {
  await page.evaluate('window.__name = window.__name || ((fn) => fn)');
}

/**
 * Reports whether the document is wider than the viewport and which elements push it. Must be
 * called after the page has settled (fonts, data, resize reflow).
 *
 * Known limitation: any element under an `overflow-x` != visible ancestor is treated as clipped. An
 * absolutely positioned element whose containing block sits *above* that ancestor actually escapes
 * the clip and can still widen the document; the document-level `overflowPx` still reports it, but
 * it will have no offender entry.
 */
export async function detectPageOverflow(page: Page): Promise<PageOverflowResult> {
  await installEvaluateHelpers(page);
  const raw = await page.evaluate<InPageOutput, InPageInput>(
    ({ epsilon, maxCandidates }) => {
      const root = document.documentElement;
      const clientWidth = root.clientWidth;
      const clips = (value: string) => value === 'hidden' || value === 'clip';
      const masked = clips(getComputedStyle(root).overflowX) || clips(getComputedStyle(document.body).overflowX);

      const chains: InPageOutput['chains'] = [];
      const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'HEAD']);

      const segmentOf = (el: Element): SelectorSegment => {
        const tag = el.tagName;
        let nth = 1;
        let sameTag = 0;
        for (const sib of Array.from(el.parentElement?.children ?? [])) {
          if (sib.tagName === tag) {
            sameTag += 1;
            if (sib === el) nth = sameTag;
          }
        }
        return {
          tag,
          id: el.id,
          classes: Array.from(el.classList),
          nthOfType: nth,
          onlyOfType: sameTag <= 1,
        };
      };

      const visit = (el: Element, ancestors: SelectorSegment[], clippedByAncestor: boolean) => {
        if (chains.length >= maxCandidates || SKIP_TAGS.has(el.tagName)) return;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        // Fixed elements are positioned against the viewport and never widen the document.
        if (style.position === 'fixed') return;

        const chain = [...ancestors, segmentOf(el)];
        const rect = el.getBoundingClientRect();
        const isSvgInternal = el instanceof SVGElement && !(el instanceof SVGSVGElement);
        if (!clippedByAncestor && !isSvgInternal && rect.width > 0 && rect.height > 0 && rect.right > clientWidth + epsilon) {
          chains.push({
            chain,
            tag: el.tagName.toLowerCase(),
            classes: typeof el.className === 'string' ? el.className : '',
            depth: chain.length,
            left: rect.left,
            right: rect.right,
            width: rect.width,
          });
        }

        // An `overflow-x: hidden|clip|auto|scroll` box contains its descendants' overflow.
        const clipsChildren = style.overflowX !== 'visible';
        for (const child of Array.from(el.children)) {
          visit(child, chain, clippedByAncestor || clipsChildren);
        }
      };

      // <html>/<body> are the scroll root: their own overflow-x is the "masked" case, not a clip of descendants.
      for (const child of Array.from(document.body.children)) {
        visit(child, [segmentOf(root), segmentOf(document.body)], false);
      }

      return { scrollWidth: root.scrollWidth, clientWidth, masked, chains };
    },
    { epsilon: OVERFLOW_EPSILON_PX, maxCandidates: MAX_CANDIDATES }
  );

  const candidates: RawOverflowCandidate[] = raw.chains.map((c) => ({
    path: formatSelectorPath(c.chain),
    tag: c.tag,
    classes: c.classes,
    depth: c.depth,
    left: c.left,
    right: c.right,
    width: c.width,
  }));
  return buildPageOverflowResult({ scrollWidth: raw.scrollWidth, clientWidth: raw.clientWidth, masked: raw.masked, candidates });
}
