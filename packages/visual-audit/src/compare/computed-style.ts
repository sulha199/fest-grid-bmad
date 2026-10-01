/**
 * AD-26 Rule 2 primary signal: DOM introspection -- bounding rects and computed CSS properties,
 * extracted via `page.evaluate()`/`getComputedStyle()` (current guidance per this story's Dev
 * Notes web research, superseding a dedicated third-party assertion library).
 */

import type { Page } from '@playwright/test';
import type { BoundingBox } from '../rules/sibling-dimension.js';

export interface ElementSnapshot {
  boundingBox: BoundingBox;
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
  computed: Record<string, string>;
}

/** Extracts a bounding box + computed-style snapshot for every element matching `selector`. */
export async function getElementSnapshots(page: Page, selector: string, cssProperties: string[] = []): Promise<ElementSnapshot[]> {
  return page.$$eval(
    selector,
    (elements, props) =>
      elements.map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const computed: Record<string, string> = {};
        for (const prop of props) {
          computed[prop] = style.getPropertyValue(prop) || (style as unknown as Record<string, string>)[prop] || '';
        }
        return {
          boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          scrollWidth: (el as HTMLElement).scrollWidth,
          clientWidth: (el as HTMLElement).clientWidth,
          scrollHeight: (el as HTMLElement).scrollHeight,
          clientHeight: (el as HTMLElement).clientHeight,
          computed,
        };
      }),
    cssProperties
  );
}

/** Convenience single-element variant -- throws if `selector` matches zero or more than one element. */
export async function getElementSnapshot(page: Page, selector: string, cssProperties: string[] = []): Promise<ElementSnapshot> {
  const snapshots = await getElementSnapshots(page, selector, cssProperties);
  if (snapshots.length !== 1) {
    throw new Error(`Expected exactly one element matching "${selector}", found ${snapshots.length}`);
  }
  return snapshots[0];
}

export interface OverflowCheckResult {
  pass: boolean;
  message: string;
}

/** Flags scrollWidth > clientWidth (or scrollHeight > clientHeight) -- AD-26 Rule 5 overflow class. */
export function checkOverflow(snapshot: ElementSnapshot): OverflowCheckResult {
  const widthOverflow = snapshot.scrollWidth > snapshot.clientWidth;
  const heightOverflow = snapshot.scrollHeight > snapshot.clientHeight;
  const pass = !widthOverflow && !heightOverflow;
  return {
    pass,
    message: pass
      ? 'No overflow/clipping detected'
      : `Overflow detected: scrollWidth=${snapshot.scrollWidth} clientWidth=${snapshot.clientWidth}, scrollHeight=${snapshot.scrollHeight} clientHeight=${snapshot.clientHeight}`,
  };
}
