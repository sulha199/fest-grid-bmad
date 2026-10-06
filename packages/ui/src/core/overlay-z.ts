/**
 * Architecture Spine AD-33 (Z-Index Layering Tiers). The Overlay-modal tier's class name,
 * as one shared constant — every dialog/sheet/popover/select/menu (Radix-portaled or
 * hand-rolled) imports this instead of inlining `'z-overlay-modal'` or `'z-50'`, so a future
 * re-tiering of the overlay level is a one-file edit here, not a grep-and-replace across
 * every consumer. See AD-33 Rule 3.
 */
export const OVERLAY_MODAL_Z = 'z-overlay-modal';
