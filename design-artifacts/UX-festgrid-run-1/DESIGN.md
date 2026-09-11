---
title: "DESIGN.md: festgrid"
status: "draft"
created: "2026-07-13T22:33:00Z"
updated: "2026-09-11T00:00:00Z"
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
    masonry: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-x-2 gap-y-6" # GridContainer(baseCols=2, colsStep=1) with gap="gap-x-2 gap-y-6" (amended 2026-09-04, sprint-change-proposal-2026-09-04.md Section 4.3/Story 1.3d AC19 -- tighter horizontal gap keeps the 2-col mobile grid dense, larger vertical gap gives each card's new date_box/badge_row/caption stack room against the row below so adjacent cards' content doesn't read as connected)
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
    # base/image/title below predate this pass and were never actually wired into WeeklyCalendarView.tsx or any
    # other consumer (confirmed by grep across packages/ and apps/ -- no match beyond this file and planning
    # docs referencing it). REVISED <bmad-ux pass, 2026-09-11> -- backlog IDEA-016/FIND-023, per two user
    # reference screenshots of a calendar-view row card. Row composition, left to right: date box, then a
    # title/venue/badges column, then a thumbnail with its own heart+count overlay (or the large bare-heart
    # fallback when missing/expired) -- the same date-box-beside-a-height-matched-thumbnail principle as
    # event_card_masonry.top_row_default, just in a full-width horizontal row instead of a narrow 2-col grid
    # tile.
    # Resolves this pass's own earlier open item (which WeeklyCalendarView render path gets a date box, given
    # the existing mobile_day_list day_row's per-schedule card has none today, since day_row_header already
    # anchors the *start* date for the whole group): user-confirmed 2026-09-11, keep a single date box (no
    # separate event_card_till_badge on this surface at all), but repurpose its content from start-date to
    # end/"till" info -- since the surrounding day/date container already tells the viewer when the schedule
    # starts, showing that same start date a second time per-card would be pure duplication, whereas the end
    # time is new information the day container doesn't carry. This is a genuinely different content rule from
    # event_card_date_box (masonry), not just a restyle -- see date_box below. Still left open, and still an
    # architecture question for the amendment story (not this pass): whether this composition attaches to the
    # existing mobile_day_list per-schedule card, a new flatter/ungrouped surface, or both.
    # References: imports/calendar-row-card-with-thumbnail.png (with-image state), imports/calendar-row-card-thumbnail-fallback-large-favorite-icon.png (missing/expired-image fallback).
    base: "flex items-stretch gap-2 rounded-md shadow-sm p-2 bg-violet-50 border border-violet-200" # was already the card's own chrome (violet-50 fill/border) -- now also the 3-zone flex row container below
    date_box: "flex items-center justify-center px-2 py-1 rounded-md bg-slate-800 text-white text-xs font-semibold shrink-0" # same solid-navy visual treatment as event_card_date_box.base_default (no photo directly behind it, same reasoning) -- BUT its content is till/end info, not formatShortEventDateTime's start-date output. No separate till_badge sub-element on this card -- this single box does both jobs (date-shaped chrome, till-shaped content), since the day/date container this card sits inside already shows the start date. **Differs from event_card_till_badge's own gating (AC14: no badge until the event has started)**: a calendar row is already anchored to one specific day/segment, so showing nothing pre-start would leave most upcoming cards' date boxes empty, which defeats the point of keeping a box here at all. Deferred to the amendment story: the exact always-shown text rule for this box (e.g. that day's segment end time, "till hh:mm", independent of has-it-started) -- reuses `formatEventTime` and the day-segment data `WeeklyCalendarView.tsx` already computes (`dayBuckets`/`isFirstSegment`/`isLastSegment`), not new formatting logic, but the has-it-started gate itself does not carry over from AC14 as-is.
    content: "flex-1 min-w-0 flex flex-col gap-1 justify-center" # title/venue/badges column -- reuses event_card_status_badge/event_card_nearby_badge as-is, no new badge tokens needed
    title: "text-xs font-bold truncate" # unchanged from the pre-existing token
    image: "w-16 h-16 object-cover rounded-md shrink-0" # was "w-full h-12" (assumed full-bleed top image, never built) -- resized to a fixed square thumbnail matching the row's own height, mirroring event_card_masonry.thumbnail_default's "size the image to the fixed chrome around it, not the reverse" rule, for the same graceful-degrade reason (FIND-023)
    favorite_badge: "absolute top-1 right-1 z-10" # small heart+count pill overlaid on the thumbnail's own corner, same role as event_card_masonry.thumbnail_default.favorite_badge; requires the thumbnail's own wrapper to carry `relative`
  event_card_compact_thumbnail_fallback:
    # New <bmad-ux pass, 2026-09-11> -- backlog FIND-023 + the missing-image reference screenshot, same
    # convention as event_card_masonry.thumbnail_default_fallback: the w-16 h-16 slot stays reserved (no
    # reflow/collapse), nothing else renders in the image's place, and event_card_favorite_count_badge_large
    # (shared token, defined under event_card_masonry) replaces the small corner favorite_badge, centered in
    # the reserved slot instead of corner-anchored.
    base: "flex items-center justify-center w-16 h-16 shrink-0"
  event_card_masonry:
    # Added 2026-08-25 -- Story 1.3b's variant="masonry" prop, sprint-change-proposal-2026-08-24-ux-rework-batch.md
    # Section 4.4/4.5. Distinct from event_card_compact above, which is the calendar view's per-schedule
    # mini-card, not a card-grid mode. Amended 2026-09-04 -- sprint-change-proposal-2026-09-04.md Section 4.3
    # (Story 1.3b AC14-AC18 / 1.3d AC16-AC19): replaces the top-left relative-day pill with event_card_date_box
    # (below), adds a below-image badge row, and adds the prominent-poster treatment for durableImageUrl-driven
    # opted-in accounts (PRD SS3.16). Reference: two user-provided screenshots -- default and opted-in/prominent
    # states are the identical structure, only the poster's aspect ratio differs between them (user-confirmed).
    image: "w-full aspect-[3/4] object-cover" # native aspect ratio, default/non-prominent poster -- unchanged
    image_prominent: "w-full aspect-[2/3] object-cover" # Story 1.3b AC17 -- taller than the default aspect-[3/4], rendered when prominentPoster=true (EventListView derives this from durableImageUrl != null, AC17). Same date_box/till_badge/heart+count overlay treatment and badge_row placement as the default state -- only the image silhouette changes.
    caption: "p-3 flex-1 flex flex-col gap-2" # unchanged container -- badge_row (below) is now its first flex child, so the existing gap-2 spacing applies uniformly between badge_row, the title, and locationName with no separate wrapper needed
    badge_row: "flex items-center gap-1.5 flex-wrap" # status badge always first, nearby badge appended when present (AC15/AC16). Sits below the top row (poster, or top_row_default below) against the card's own bg-card background, so unlike date_box/till_badge it uses solid fills, not glassmorphism
    top_row_default:
      # New <bmad-ux pass, 2026-09-11>. Replaces "full-width poster with date box overlaid on top" for
      # prominentPoster=false ONLY -- the common case, where the poster image is hotlinked/scraped and can
      # expire (PRD SS3.16). prominentPoster=true is completely unchanged: still the original full-width
      # event_card_masonry.image_prominent poster with event_card_date_box.base overlaid on top (Story 1.3b
      # AC17, already shipped, untouched by this pass).
      # Reason (user-confirmed, 2026-09-11): binding the default thumbnail's size to the date box's own height,
      # rather than to a full-width poster, means an expired/broken image degrades gracefully -- the row's
      # layout never depends on the image actually loading, so there's no reflow/collapse when it fails (see
      # thumbnail_default_fallback below and backlog FIND-023).
      # Reference: imports/masonry-default-ai-tech-summit-date-box-beside-thumbnail.png.
      base: "flex items-stretch gap-2"
    thumbnail_default:
      # Sits beside event_card_date_box.base_default inside top_row_default. `flex-1` (fills whatever width the
      # date box doesn't take) with `h-full` (stretches to the row's height, which top_row_default's
      # `items-stretch` sets to the date box's own intrinsic height) -- so this is always roughly square for a
      # typical short date-box string ("12 Oct"), never a tall poster. `min-w-0` prevents the flex item from
      # refusing to shrink below the image's natural width in a narrow 2-col masonry tile.
      base: "flex-1 h-full min-w-0 object-cover rounded-md"
      favorite_badge: "absolute top-1 right-1 z-10" # small heart+count pill (event_card_favorite_count_badge, unchanged token/markup) overlaid on the thumbnail's own corner -- same role the full poster's heart+count pill already plays, just repositioned onto a smaller image; requires the thumbnail's own wrapper to carry `relative`
    thumbnail_default_fallback:
      # New <bmad-ux pass, 2026-09-11> -- backlog FIND-023 + the missing/expired-image reference screenshot.
      # Renders when the image is absent or its onError fires -- the same detection EventCard.tsx's existing
      # `!imgError && imageUrl` branch already does for AC3's standard-variant fallback; this is that branch's
      # masonry-default equivalent, not new detection logic. thumbnail_default's own dimensions (flex-1 h-full)
      # are unchanged and still reserved -- per FIND-023, nothing else renders in the image's place (no icon, no
      # "image not available" text, no fill distinct from the card's own bg-card) -- and
      # event_card_favorite_count_badge_large (below) replaces the small corner favorite_badge, centered in the
      # reserved slot instead of corner-anchored, matching the reference screenshot exactly.
      # Reference: imports/masonry-default-thumbnail-fallback-large-favorite-icon.png.
      base: "flex items-center justify-center h-full"
  event_card_favorite_count_badge_large:
    # New <bmad-ux pass, 2026-09-11> -- shared between event_card_masonry's default-state missing-image fallback
    # (thumbnail_default_fallback above) and the new calendar row-card's own missing-image fallback
    # (event_card_compact_thumbnail_fallback below). Both reference screenshots show the identical treatment:
    # imports/masonry-default-thumbnail-fallback-large-favorite-icon.png and
    # imports/calendar-row-card-thumbnail-fallback-large-favorite-icon.png.
    # the same favorite-toggle heart icon and count, just larger and with no pill/background, standing alone
    # where the image would have been. Not a new component -- the same favorite-toggle button EventCard/
    # WeeklyCalendarView already render, just re-skinned; only the icon size and the removed pill background
    # differ from event_card_favorite_count_badge's default styling. Kept a real, min-h-11/min-w-11-sized tap
    # target (components.nav.item_hit_area's existing convention) even though it visually looks like bare text
    # -- it's still the live favorite toggle, not a decorative label.
    base: "flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-11 text-sm font-medium text-foreground" # no bg/pill, unlike event_card_favorite_count_badge's small corner pill
    icon: "w-6 h-6 text-rose-500 fill-rose-500" # larger than event_card_favorite_count_badge's default icon -- confirm that component's exact current icon size at implementation time and size this proportionally larger, not to an arbitrary fixed value
  event_card_date_box:
    # Added <bmad-ux pass, 2026-09-04> -- sprint-change-proposal-2026-09-04.md Section 4.3, supersedes
    # event_card_relative_day_pill (2026-08-25) entirely for the masonry variant. REVISED <bmad-ux pass,
    # 2026-09-11> -- reference screenshots reopened this pass overturned the "identical in both poster states"
    # premise below: this is now two compositions gated on prominentPoster (the same durableImageUrl-derived
    # flag Story 1.3b AC17 already threads through), not one. `base` (unchanged) now applies ONLY when
    # prominentPoster=true. See `base_default` for the new prominentPoster=false composition, and
    # event_card_masonry.top_row_default for how the two sit in the DOM.
    #
    # `base` (prominentPoster=true only, unchanged from the original 2026-09-04 pass): same top-left overlay
    # slot/z-index as the relative-day pill it replaced; restyled as a squarer "box" (rounded-md, not
    # rounded-full) so it reads as a date chip distinct from a pure status pill. Primary content is the exact
    # same formatShortEventDateTime() output the pill already rendered (Today/Tomorrow/weekday/short-date, e.g.
    # "12 Oct") plus its existing Clock-icon-when-today-with-time rule (AC12) -- reused verbatim, not
    # reimplemented. Reference: imports/masonry-prominent-quantum-leap-symposium.png.
    base: "absolute top-3 left-3 z-10 flex items-center gap-1 px-2.5 py-1 rounded-md bg-background/80 backdrop-blur-sm shadow-sm text-xs font-semibold text-foreground"
    icon: "w-3 h-3" # existing Clock icon, rendered only when hasTime && dayDiff === 0 -- unchanged rule carried over from the superseded pill
    base_default:
      # New <bmad-ux pass, 2026-09-11>. prominentPoster=false (the common case -- a hotlinked/scraped image that
      # can expire, PRD SS3.16). No longer absolutely positioned over a poster: it's a normal-flow flex sibling
      # of the small thumbnail (event_card_masonry.thumbnail_default) inside event_card_masonry.top_row_default,
      # which uses `items-stretch` so the *thumbnail* stretches to match the date box's own intrinsic height --
      # not the other way around. Solid fill instead of glass/blur, since there's no photo directly behind it to
      # blur here, only the card's own bg-card background -- matching badge_row's existing "solid fills, not
      # glassmorphism" rationale one level down. `bg-slate-800` is a literal-class match for `colors.primary`
      # (#1E293B) -- reuses the existing brand primary rather than introducing a new dark neutral, and matches
      # the reference screenshots' solid navy box. Content rule (formatShortEventDateTime + conditional Clock
      # icon) is identical to `base` above -- only the container's position/background changes, not what's
      # inside it. `relative` is required here (unlike `base`, which is itself `absolute` and so already a valid
      # containing block) so event_card_till_badge can still anchor to this box's corner.
      # Reference: imports/masonry-default-ai-tech-summit-date-box-beside-thumbnail.png.
      base: "relative flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-white shadow-sm text-xs font-semibold shrink-0"
  event_card_till_badge:
    # Added <bmad-ux pass, 2026-09-04> -- Story 1.3b AC14. REVISED <bmad-ux pass, 2026-09-11> -- reference
    # screenshots reopened both the position (was bottom-edge-center) and the color (was a neutral inverted
    # bg-foreground/text-background, tied to whichever background the date box itself used) to a corner tag
    # with its own distinct amber/gold accent, decoupled from the date box's own color -- the two would otherwise
    # have to track each other's now-divergent styling across prominentPoster states (see event_card_date_box).
    # User confirmed (2026-09-11): a new solid amber token, not a reuse of status_badge.pendingReview's pale
    # amber-100/amber-800 pill (that pairing reads as a calm review-status pill, not an urgency accent tag) and
    # not the brand accent #FF5A5F (reads coral/red, not gold). amber-700 (#B45309) on white was chosen over
    # amber-600 (#D97706) specifically for contrast at this token's small (10px) text size: amber-600/white
    # measures ~3.19:1, failing WCAG 1.4.3's 4.5:1 small-text floor; amber-700/white measures ~5.03:1, passing
    # with margin. Anchored to the containing date box's top-left corner in both prominentPoster states (works
    # against `base`, which is itself `absolute` and so already a containing block, and against `base_default`,
    # which now carries its own `relative` for exactly this reason).
    # References: imports/masonry-prominent-quantum-leap-symposium.png (prominentPoster=true), imports/masonry-default-ai-tech-summit-date-box-beside-thumbnail.png (prominentPoster=false).
    base: "absolute -top-1.5 -left-1.5 z-20 px-1.5 py-0.5 rounded-full bg-amber-700 text-white text-[10px] font-semibold leading-none shadow-sm whitespace-nowrap"
  event_card_status_badge:
    # Added <bmad-ux pass, 2026-09-04> -- Story 1.3b AC15 (8-state status badge: ended/happeningNow/endsToday/
    # inHours/tomorrow/weekday/inDays/upcoming). User decision: a single neutral style for all 8 states, text
    # alone differentiates them -- deliberately does NOT reuse {components.status_badge}'s positive/negative/
    # pendingReview/superseded palette, since that palette encodes review-workflow outcomes, not time-urgency,
    # and mapping e.g. "ended" onto its red "negative" variant would misread as an error/failure state. Shape
    # mirrors {components.status_badge}'s own base shape (`text-xs px-2 py-0.5 rounded font-medium shrink-0`)
    # exactly, just with a new neutral color pairing, so the two still read as the same family of "badge."
    base: "inline-flex items-center text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-muted text-muted-foreground"
  event_card_nearby_badge:
    # Added <bmad-ux pass, 2026-09-04> -- Story 1.3b AC16. Renders only when distanceKm <= 5; omitted entirely
    # otherwise (no placeholder/disabled state, per AC16). Distinguished from event_card_status_badge by both a
    # solid accent fill (not color alone) and its own icon, satisfying the project's existing non-color-cue
    # convention (EXPERIENCE.md State Patterns > Soft Delete "at least one non-color cue is required", WCAG
    # 1.4.1) -- reuses the exact bg-secondary/text-secondary-foreground pairing EventCard.tsx's standard-variant
    # type badges already use, rather than inventing a new color pairing.
    base: "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-secondary text-secondary-foreground"
    icon: "w-3 h-3" # lucide-react Navigation icon -- deliberately distinct from the caption's own MapPin (locationName row) so the two location-related glyphs never look identical in an already-dense card; confirm the exact icon name against the installed lucide-react version at implementation time (same caveat already applied to components.calendar.mobile_day_list.multi_day_badge's CalendarRange icon)
  event_card_favorite_count_badge:
    base: "flex items-center gap-1 text-xs font-medium" # count text rendered inline next to the existing Heart icon inside the favorite-toggle button, not a separate element -- reuses EventCard's existing top-right slot rather than adding a third overlay
    # Confirmed visually unchanged by the 2026-09-04 bmad-ux pass (sprint-change-proposal-2026-09-04.md Section 4.3 item 3) -- both reference screenshots show this top-right slot untouched by the new date_box/till_badge/badge_row additions.
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
