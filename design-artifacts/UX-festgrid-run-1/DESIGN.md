---
title: "DESIGN.md: festgrid"
status: "draft"
created: "2026-07-13T22:33:00Z"
updated: "2026-08-06T00:00:00Z"
sources:
  - "_bmad-output/planning-artifacts/prfaq-festgrid.md"
  - "_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md"
colors:
  primary: "#1E293B"
  secondary: "#6366F1"
  accent: "#FF5A5F"
  neutral: "#FAFAFC"
  success: "#10B981"
  error: "#EF4444"
  nav_active_indicator: "#E04347" # darker than base accent; ~3.98:1 vs neutral, meets WCAG 1.4.11 non-text contrast (base accent measures ~2.93:1, fails)
typography:
  font_family_base: "Inter, sans-serif"
  font_size_base: "16px"
rounded:
  corner_radius_base: "0.5rem"
spacing:
  spacing_unit: "0.25rem"
components:
  card:
    base: "rounded-lg shadow-md p-4"
    title: "text-lg font-bold"
    content: "text-sm"
  button:
    base: "py-2 px-4 rounded-md font-semibold"
    primary: "bg-violet-600 text-white"
    secondary: "bg-gray-200 text-gray-800"
  grid:
    # Both rows below are the *output* of GridContainer(baseCols, colsStep) (packages/ui/src/core/grid-container.tsx,
    # Story 0.31), documented here for readability -- not hand-maintained separately from the component.
    base: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4" # GridContainer(baseCols=1, colsStep=1)
    masonry: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4" # GridContainer(baseCols=2, colsStep=1), Story 1.3b/1.3d Pinterest/masonry view mode
  page_container:
    full_width: "w-full min-w-[320px] sm:min-w-[640px] md:min-w-[768px] lg:min-w-[1024px] xl:min-w-[1280px] p-4 sm:p-8 space-y-8" # fullWidth=true (default), added 2026-08-24, replaces the per-page max-w-7xl mx-auto copy-paste -- see packages/ui/src/core/page-container.tsx (Story 0.30)
    contained: "w-full max-w-5xl mx-auto lg:min-w-[768px] p-4 sm:p-8 space-y-8" # fullWidth=false, added 2026-08-24, replaces the per-page max-w-3xl/max-w-4xl split on settings/table pages
  page_header:
    base: "flex justify-between items-center flex-wrap" # added 2026-08-24 -- see packages/ui/src/core/page-header.tsx (Story 0.32)
    title: "text-3xl font-bold"
    action_label: "hidden sm:inline" # action button's label hides below sm:, icon-only on mobile
  calendar:
    base: "border border-gray-200 rounded-lg"
    header: "flex items-center justify-between p-4 border-b border-gray-200"
    date_range: "text-lg font-semibold"
    nav_button: "py-1 px-3 rounded-md bg-gray-100 text-gray-700"
    grid_weekly: "grid grid-cols-7 divide-x divide-gray-200" # >= md: (768px) only, see mobile_day_list below
    day_cell: "p-2 h-32" # >= md: only
    day_header: "text-sm text-center font-medium" # >= md: only
    event_rendering:
      discovery_view:
        max_events_per_day: 5
      personal_view:
        max_events_per_day: -1 # Show all events
      more_link: "text-xs text-center text-violet-600 hover:underline" # >= md: only -- mobile_day_list never caps/pops over, see below
      multi_day_event: "w-full bg-violet-50 border border-violet-200 rounded-md p-1 relative"
      title_formatting:
        main_schedule: "font-bold"
        sub_schedule: "font-normal"
      time_indicator_bar: "absolute bottom-0 left-0 h-1 bg-violet-400"
      hover_tooltip: "absolute z-10 p-2 text-sm bg-gray-800 text-white rounded-md shadow-lg" # >= md: only, see mobile_day_list.time_range_inline for the < md: equivalent
    # Added <bmad-ux pass, 2026-08-24>: vertical day-list layout below md: (768px), replacing
    # grid_weekly/day_cell/day_header/hover_tooltip/more_link at that breakpoint. Both this and
    # grid_weekly render in the DOM, CSS-toggled by breakpoint (hidden / md:hidden pairing) so
    # only the active one is ever in the accessibility tree (display:none), matching
    # EXPERIENCE.md's Global Navigation "one variant in the a11y tree" precedent. See
    # EXPERIENCE.md Component Patterns > Mobile Multi-Day Calendar Spanning for the full
    # behavioral spec this token block backs -- this pass adds only what's needed to render
    # that spec; the base day-list shape (vertical, skip-empty-days) was decided at
    # sprint-change-proposal-2026-08-24-ux-rework-batch.md Section 4.8 but not yet
    # token-specified elsewhere, so it's specified here alongside the multi-day answer it exists
    # to support, rather than left partially undefined.
    mobile_day_list:
      breakpoint: "md:hidden" # grid_weekly's counterpart is "hidden md:grid" at the same breakpoint
      container: "flex flex-col divide-y divide-gray-200"
      day_row: "flex flex-col gap-1 py-3"
      day_row_header: "text-sm font-medium text-left px-1" # left-aligned variant of day_header -- day_header's text-center reads oddly on a full-width row; same formatDayHeader() weekday+date output, no new formatting logic
      event_stack: "flex flex-col gap-2 px-1" # a day row's own compact-card list -- full width, natural (non-h-32-capped) height, always shows every schedule for that day (no cap/popover, unlike grid_weekly's day_cell)
      time_range_inline: "text-[11px] text-gray-500 mt-0.5" # always-visible time text -- mobile has no hover, and hover_tooltip's existing handlers already no-op on touch pointers, so this replaces tooltip-gating for every card on this breakpoint, not multi-day segments only
      favorite_count_line: "text-[11px] text-gray-500 flex items-center gap-1 mt-0.5" # EventInfo.favoriteCount as its own line, per sprint-change-proposal-2026-08-24-ux-rework-batch.md Section 4.5
      multi_day_badge: "text-[10px] text-violet-600 flex items-center gap-1 mt-0.5" # "Day X of N" + a small calendar-range icon (e.g. lucide-react's CalendarRange -- confirm the exact icon name against the installed lucide-react version at implementation time), repeated on every day_row segment of a multi-day schedule; X/N computed from the schedule's true eventStartDate/eventEndDate, not clamped to the visible week (same convention as isFirstSegment/isLastSegment)
  event_card_compact:
    base: "rounded-md shadow-sm p-2 bg-violet-50 border border-violet-200"
    image: "w-full h-12 object-cover rounded-t-md"
    title: "text-xs font-bold truncate"
  modal:
    overlay: "fixed inset-0 bg-black bg-opacity-50"
    dialog: "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
  notification:
    base: "fixed bottom-5 right-5 w-full max-w-sm rounded-lg shadow-lg pointer-events-auto"
    content_wrapper: "flex items-start p-4"
    icon: "flex-shrink-0 h-6 w-6"
    text_wrapper: "ml-3 w-0 flex-1 pt-0.5"
    title: "text-sm font-medium"
    message: "text-sm"
    close_button: "ml-4 flex-shrink-0 p-1.5 rounded-md"
    info: "bg-violet-100 text-violet-800"
    success: "bg-green-100 text-green-800"
    error: "bg-red-100 text-red-800"
    undo_duration_ms: 6000 # Soft Delete with Undo toast open window; pauses on hover/focus (EXPERIENCE.md State Patterns > Soft Delete with Undo)
    error_duration_ms: 8000 # Soft Delete failure-path toast; longer than the undo toast and does not auto-retry -- persists long enough to read plus act on its close control (EXPERIENCE.md Accessibility Floor > Soft Delete with Undo)
    action_hit_area: "min-h-11 min-w-11" # Undo / close button minimum touch target inside the toast, mirrors components.nav.item_hit_area (EXPERIENCE.md Accessibility Floor > Soft Delete with Undo)
  status_badge: # backs packages/ui/src/core/status-badge.tsx (StatusBadge) -- documented here 2026-08-24 alongside adding the superseded variant (EXPERIENCE.md Component Patterns > Account Location Field), transcribed from the component's existing variant classes so this is the single source of truth going forward
    base: "text-xs px-2 py-0.5 rounded font-medium shrink-0"
    positive: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" # active, dismissed, accepted
    negative: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200" # invalid, upheld, reverted, removedByModeration
    pendingReview: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200" # pending, pendingReview, hiddenByMe
    superseded: "bg-slate-100 dark:bg-slate-900/30 text-slate-800 dark:text-slate-200" # added 2026-08-24 (AD-11) -- shares expired's neutral/grey treatment: a superseded request isn't wrong or reverted, it's simply no longer the live one
  nav:
    bottom_tab_bar: "fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t bg-background md:hidden"
    sidenav_rail: "fixed inset-y-0 start-0 z-40 hidden md:flex md:flex-col md:items-center xl:items-stretch w-16 xl:w-56 border-e bg-background py-4"
    sidenav_top_group: "flex flex-col items-center xl:items-stretch gap-1"
    sidenav_bottom_slot: "mt-auto flex flex-col items-center xl:items-stretch"
    item_hit_area: "min-h-11 min-w-11 flex items-center gap-3 justify-center xl:justify-start"
    item_label: "hidden xl:inline text-sm font-medium"
    item_tooltip: "md:group-hover:opacity-100 md:group-focus-visible:opacity-100 xl:hidden"
    active_indicator: "bg-nav-active-indicator w-1 rounded-full absolute top-0 md:inset-y-0 md:start-0 h-1 md:h-auto md:w-1"
    active_icon: "text-nav-active-indicator [&_svg]:fill-current"
    focus_ring: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    # profile_* tokens back Story 2.8 "User Menu" (Epic 2), not Story 0.7 -- 0.7 only
    # renders the trigger (profile_avatar) and invokes this menu.
    profile_avatar: "h-8 w-8 rounded-full object-cover"
    profile_menu: "absolute z-50 min-w-56 rounded-lg border bg-background p-1 shadow-lg" # dropdown, rail tiers (>=768px), anchored to the Profile nav item
    profile_sheet: "fixed inset-x-0 bottom-0 z-50 rounded-t-lg border-t bg-background p-2 shadow-lg animate-in slide-in-from-bottom" # bottom sheet, mobile tab-bar tier (<768px)
    profile_menu_header: "flex items-center gap-2 px-3 py-2 text-sm font-medium border-b"
    profile_menu_item: "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted focus-visible:bg-muted min-h-11"
    profile_menu_divider: "my-1 h-px bg-border"
    profile_sheet_close: "flex items-center justify-center min-h-11 min-w-11 rounded-md hover:bg-muted focus-visible:bg-muted"
  spark:
    base: "text-accent"
  input_with_label:
    base: "flex flex-col gap-1"
    label: "text-sm font-medium"
    input: "border border-gray-300 rounded-md p-2"
  typography:
    fest: "font-bold"
    grid: "font-light"
---

# Brand & Style

The visual identity of FestDaily is modern, vibrant, and engaging. It uses a light theme to create a clean and welcoming feel. The layout is a clean grid of cards, each representing an event.

## Logo Concept: "The Spark in the Grid"

FestDaily's visual identity combines the technological structure and the magic of discovery at the event.
Visual Form: This logo uses a very neat basic event card grid ($2 \times 2$). However, one of the squares in the upper right corner "breaks" or transforms into a Spark shape (a sparkling four-pointed star) with a very vibrant accent color. Typographic Direction: The word "Fest" uses a bold Sans-serif font with a Bold weight, while "Grid" uses a Light weight. Discovery Philosophy: Depicts a magical moment of discovery. Among hundreds of ordinary and boring schedules or calendar grids, the AI ​​Agent FestDaily manages to bring out one "gem" or the most exciting event that immediately catches the user's attention.

* **Logomark (Icon):** A minimalist 2x2 grid structure. Three squares are in a neutral base color, while the square in the upper right corner transforms into a **Spark (4-Pointed Star)** shape, symbolizing the moment of *Exciting Discovery*.
* **Logotype (Text):** "Fest" (Bold, primary) + "Grid" (Light, secondary)
