---
title: "DESIGN.md: Epic 10 job screens (delta on festgrid)"
status: "final"
created: "2026-11-13"
updated: "2026-11-13"
scope: "A delta spine. It adds only what the job screens need and inherits everything else from design-artifacts/UX-festgrid-run-1/DESIGN.md (the base spine). Where this file and the base spine differ on a token it names, this file wins for the job screens only."
sources:
  - "design-artifacts/UX-festgrid-run-1/DESIGN.md"
  - "_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md (Section 3.18 Background Vendor Jobs and the Jobs Page, Section 6 Subscription Cap)"
  - "_bmad-output/project-context.md (UI Patterns, z-index tiers of AD-33 Z-Index Layering Tiers, Responsive Containment)"
colors:
  # No new colors. Every job screen color is an existing token or an existing Tailwind pair already used by StatusBadge
  # (packages/ui/src/core/status-badge.tsx) and by the Re-extract images warning (reextract-preview-result.tsx).
  primary: "{base.colors.primary}"
  secondary: "{base.colors.secondary}"
  success: "{base.colors.success}"
  error: "{base.colors.error}"
typography:
  # No new type styles. Titles use text-lg font-bold (base card.title), body text-sm, meta text-xs text-muted-foreground.
  meta: "text-xs text-muted-foreground"
rounded:
  corner_radius_base: "{base.rounded.corner_radius_base}"
spacing:
  hit_area: "min-h-11 min-w-11"   # base nav.item_hit_area, reused for the chip, Retry, Minimize and row taps
components:
  job_status_badge:
    # NEW, a thin mapping in apps/web (and the shared JobStatusBadge in packages/ui), NOT new StatusBadge variants.
    # StatusBadge keeps its variant list; the mapping picks the closest existing look. Colour is never the only cue:
    # the label text is always shown and the leading icon differs per state (see EXPERIENCE.md, Accessibility Floor).
    queued: "StatusBadge variant=queued (sky)"
    running: "StatusBadge variant=extracting (violet)"
    waiting: "StatusBadge variant=pending (amber)"
    succeeded: "StatusBadge variant=active (green)"
    succeeded_with_limits: "StatusBadge variant=lowConfidence (amber)"
    failed: "StatusBadge variant=attemptFailed (red)"
    expired: "StatusBadge variant=expired (slate)"
    cancelled: "StatusBadge variant=notEvent (slate)"
  job_row:
    # One row of the Jobs list: a tappable card. Mobile-first; nothing is absolutely positioned.
    base: "block w-full rounded-lg border bg-card p-4 text-start hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary min-h-11"
    layout: "flex flex-col gap-2"
    header: "flex flex-wrap items-center gap-2 min-w-0"        # badge + type label; wraps instead of overflowing
    title: "text-sm font-semibold min-w-0 break-words"
    subject: "min-w-0"                                          # SubscribedAccountCard (variant=list, size=sm) or plain text
    meta: "{typography.meta} flex flex-wrap gap-x-3 gap-y-1"
  job_stepper:
    # An ordered list (ol). Vertical at every width, so there is no horizontal scroll on a 320 px phone.
    list: "flex flex-col gap-3"
    item: "flex items-start gap-3 min-w-0"
    marker: "h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
    marker_done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"        # Check icon
    marker_current: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200"  # spinner; static dot under reduced motion
    marker_pending: "border border-border text-muted-foreground"                                # step number
    marker_skipped: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200"      # Minus icon
    label: "text-sm min-w-0 break-words"
    label_current: "font-semibold"
    detail: "{typography.meta}"
  job_chip:
    # The minimized indicator, in flow at the place the action started (never fixed or floating).
    base: "inline-flex max-w-full items-center gap-2 rounded-full border px-3 min-h-11 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    label: "min-w-0 truncate"
    spinner: "h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
  job_progress_dialog:
    # Reuses apps/web Dialog (Radix). Overlay-modal tier through OVERLAY_MODAL_Z, nothing new. DialogContent already caps
    # its height and keeps grid-cols-[minmax(0,1fr)], which responsive-popups.spec.ts relies on.
    content: "sm:max-w-md max-h-[85vh] overflow-y-auto"
    actions: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"   # full-width buttons on a phone, min-h-11 each
  job_notice:
    # State message inside the dialog or the detail page. Same amber pattern as the Re-extract images warning.
    limits: "rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
    failed: "rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
    info: "rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"      # queued, waiting
    neutral: "rounded-md border bg-muted p-3 text-sm text-foreground"                                                                       # expired, cancelled
  subscription_cap_notice:
    base: "{components.job_notice.limits} space-y-3"    # a limit is information to act on, not an error: amber, not red
    title: "text-sm font-semibold"
  upgrade_cta:
    # NEW core primitive candidate (EXPERIENCE.md, Story 10.3a Gate 2). A real, focusable button, never aria-disabled-dead.
    button: "{base.components.button.primary} min-h-11 inline-flex items-center gap-2"
    badge: "text-xs font-medium rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200 px-2 py-0.5"
    note: "{typography.meta}"
  reextract_banner:
    # The missing-images banner. Extends the existing amber "images shortfall" box (data-testid reextract-images-warning).
    base: "{components.job_notice.limits} space-y-2"
    actions: "flex flex-wrap items-center gap-2"
---

# Brand & Style

Job screens are quiet utility surfaces. They follow the base spine (light, clean, violet primary, rounded-lg cards) and add no
decoration. The tone of the visuals is calm: a job that is waiting or limited is amber or blue information, not an alarm; red is
kept for a job that really failed. Spinners are small and stop under reduced motion.

# Colors

Nothing new. The status look comes from `StatusBadge`'s existing pairs, so light and dark mode are already handled by their
`dark:` variants. Contrast: every pair is the one `StatusBadge` already ships (text-800 on bg-100, text-200 on bg-900/30). The
notice boxes use the same 900-on-50 and 200-on-950 pairs as the Re-extract warning. Color never carries meaning alone (see the
Accessibility Floor in EXPERIENCE.md).

# Typography

Base spine only. The type label of a row is `text-sm font-semibold`; times, durations and counts are `{typography.meta}`.

# Layout & Spacing

- Pages use `PageContainer` and `PageHeader` (base spine, project-context "Page Containers & Grids" and "Page Headers"); no page-local `max-w-* mx-auto`.
- The list is a single column at every width (rows are text-heavy; a grid would not help on a phone). `space-y-3` between rows.
- Nothing is wider than the viewport at 320 px: every row header wraps (`flex-wrap`), long handles and ids truncate or break inside `min-w-0`, and the moderator attempts table sits in an `overflow-x-auto` box at `md:` and above and becomes a stacked list below `md:`.
- Touch targets are `{spacing.hit_area}`: the row itself, Retry, Minimize, the chip, Upgrade, Previous and Next.

# Elevation & Depth

No new tier (AD-33 Z-Index Layering Tiers). The progress dialog and the cap dialog use `Dialog`, which sources `OVERLAY_MODAL_Z`
(Overlay-modal, 50). The chip, rows, banners and notices are in flow and use no z-index. No sticky bar is added, so Overlay-sticky
(45) is not used. The full-screen blocking loader (Overlay-blocking, 60) is never used by these screens: that is the point of
the One Job Rule (FR116).

# Shapes

Cards and notices `rounded-lg` or `rounded-md`; the chip and badges are `rounded-full`. Same as the base spine.

# Components

Token blocks are in the frontmatter. New visual components: `job_row`, `job_stepper`, `job_chip`, `job_progress_dialog`,
`job_notice`, `subscription_cap_notice`, `upgrade_cta`, `reextract_banner`. Reused as they are: `Dialog`, `PageContainer`,
`PageHeader`, `StatusBadge`, `CountBadge`, `SubscribedAccountCard`, `AccountAvatar`, `PaginationControls`,
`ConfirmActionDialog`, `Checkbox`, `RadioGroup`, `Button`, `Table`, `EmptyPageNotice`, the toast (`sonner`) and the amber
Re-extract warning box.

# Do's and Don'ts

- Do show a text label and an icon with every status color. Do not rely on color.
- Do keep the chip in flow where the action started. Do not make it a floating or fixed element (it would fight the bottom tab bar and AD-33).
- Do use amber for "done with limits", "waiting", and the cap notice. Do not use red for them.
- Do not add StatusBadge variants named after jobs now; map onto the existing ones (a follow-up may add generic names).
- Do not print a vendor name, a raw vendor error, a caption or a full signed image URL in any visual element an ordinary user can see.
- Do not use `z-40`, `z-50` or `z-[...]` literals (AD-33 ratchet); do not add a new fixed bar.
