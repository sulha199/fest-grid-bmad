/**
 * Story 0.42 — DESIGN.md `components.ambient_capability_banner` tokens: the
 * one base shape and dismiss-button pairing every ambient ask (PWA install,
 * viewer-location consent, any future one) extends rather than each
 * restyling its own bar. Plain data, no component/JSX — importable by both
 * `apps/web` and any future `packages/ui` consumer.
 *
 * `dismissPermanent` deliberately does NOT match the live shadcn `Button`
 * component's own `variant="secondary"` CVA output (`bg-secondary
 * text-secondary-foreground`, theme-variable-driven) — this is DESIGN.md's
 * own literal, documented `components.button.secondary` string, applied as a
 * plain `className` on a bare `<button>`, never passed into `<Button
 * variant="secondary">` (whose internal CVA classes would conflict rather
 * than compose). See Story 0.42 Dev Notes for the full rationale.
 */
export const ambientCapabilityBannerTokens = {
  base: 'w-full flex items-center justify-between gap-4 px-4 py-3 bg-violet-50 border-b border-violet-200 text-sm',
  dismissPermanent: 'py-2 px-4 rounded-md font-semibold bg-gray-200 text-gray-800',
  dismissCooldown: 'text-violet-700 underline text-xs font-medium',
} as const;
