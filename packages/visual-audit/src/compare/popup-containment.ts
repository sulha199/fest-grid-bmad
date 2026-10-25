/**
 * In-page measurement of an opened overlay (popover, dropdown, dialog, sheet). Browser-automation
 * surface: proven by the e2e matrix against the real app, not by mocking `evaluate`.
 */

import type { Locator, Page } from '@playwright/test';
import { installEvaluateHelpers } from './page-overflow.js';
import type { PopupMeasurement } from '../rules/popup-containment.js';

const INTERACTIVE =
  'button, a[href], input:not([type="hidden"]), select, textarea, [role="option"], [role="menuitem"], [role="checkbox"], [role="radio"], [role="tab"], [tabindex]:not([tabindex="-1"])';

/** Measures `popup` as it is now, then scrolls it to its end and re-measures its lowest interactive element. */
export async function measurePopup(page: Page, popup: Locator): Promise<PopupMeasurement> {
  await installEvaluateHelpers(page);
  const raw = await popup.evaluate(
    (el, selector) =>
      new Promise<{
        box: { left: number; top: number; right: number; bottom: number };
        scrollable: boolean;
        interactiveCount: number;
        last: { left: number; top: number; right: number; bottom: number } | null;
      }>((resolve) => {
        const visible = (node: Element) => {
          const r = node.getBoundingClientRect();
          const s = getComputedStyle(node);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
        };
        const rectOf = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
        const style = getComputedStyle(el);
        const scrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
        const items = Array.from(el.querySelectorAll(selector)).filter(visible);
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => {
          const lowest = items.map((n) => n.getBoundingClientRect()).sort((a, b) => b.bottom - a.bottom)[0];
          resolve({
            box: rectOf(el.getBoundingClientRect()),
            scrollable,
            interactiveCount: items.length,
            last: lowest ? rectOf(lowest) : null,
          });
        });
      }),
    INTERACTIVE
  );
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  return { viewport, box: raw.box, scrollable: raw.scrollable, interactiveCount: raw.interactiveCount, lastInteractiveAfterScroll: raw.last };
}
