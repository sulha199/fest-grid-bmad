/**
 * Popup/dropdown/dialog containment rule -- pure logic (the DOM measurement lives in
 * `compare/popup-containment.ts`).
 *
 * An opened overlay is only usable when (1) the whole box sits inside the viewport, and (2) after
 * scrolling it to the end its last interactive element is visible inside it. A popover taller than
 * a phone with no max-height and no scroll fails both: its bottom options are simply unreachable.
 */

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PopupMeasurement {
  viewport: { width: number; height: number };
  /** The overlay's own box. */
  box: Box;
  /** The overlay scrolls vertically (`overflow-y: auto|scroll` and content taller than the box). */
  scrollable: boolean;
  /**
   * `scrollWidth - clientWidth` of the overlay: content wider than its own box. Overlays clip or
   * sideways-scroll this, so options past the edge are unreachable even when the box fits the screen.
   */
  horizontalOverflowPx: number;
  /** Number of visible interactive descendants. */
  interactiveCount: number;
  /** Box of the lowest interactive descendant, measured after scrolling the overlay to its end; null when there are none. */
  lastInteractiveAfterScroll: Box | null;
}

export const POPUP_TOLERANCE_PX = 1;

/** Human-readable problems; empty when the popup is fully usable at this viewport. */
export function checkPopupContainment(m: PopupMeasurement, tolerance = POPUP_TOLERANCE_PX): string[] {
  const problems: string[] = [];
  const { viewport: vp, box } = m;

  const offscreen: string[] = [];
  if (box.left < -tolerance) offscreen.push(`${Math.round(-box.left)}px past the left edge`);
  if (box.right > vp.width + tolerance) offscreen.push(`${Math.round(box.right - vp.width)}px past the right edge`);
  if (box.top < -tolerance) offscreen.push(`${Math.round(-box.top)}px above the top edge`);
  if (box.bottom > vp.height + tolerance) offscreen.push(`${Math.round(box.bottom - vp.height)}px below the bottom edge`);
  if (offscreen.length > 0) {
    problems.push(`popup extends outside the ${vp.width}x${vp.height} viewport (${offscreen.join(', ')})${m.scrollable ? '' : ' and does not scroll'}`);
  }

  if (m.horizontalOverflowPx > tolerance) {
    problems.push(`content is ${Math.round(m.horizontalOverflowPx)}px wider than the popup itself, so its right side is clipped or only reachable by scrolling sideways`);
  }

  const last = m.lastInteractiveAfterScroll;
  if (last) {
    const visibleTop = Math.max(box.top, 0);
    const visibleBottom = Math.min(box.bottom, vp.height);
    const visibleLeft = Math.max(box.left, 0);
    const visibleRight = Math.min(box.right, vp.width);
    const hidden =
      last.bottom > visibleBottom + tolerance ||
      last.top < visibleTop - tolerance ||
      last.right > visibleRight + tolerance ||
      last.left < visibleLeft - tolerance;
    if (hidden) {
      problems.push(
        `the last of ${m.interactiveCount} interactive element(s) is still outside the visible popup after scrolling it to the end (${Math.round(last.bottom)}px bottom vs ${Math.round(visibleBottom)}px visible)`
      );
    }
  }
  return problems;
}
