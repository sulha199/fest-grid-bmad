---
title: "DESIGN.md: festgrid"
status: "draft"
created: "2026-07-13T22:33:00Z"
updated: "2026-09-17T00:00:00Z"
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
  temporal_filter:
    # Added <bmad-ux pass, 2026-09-17> -- IDEA-019 (Happening now / Upcoming / All, card view only).
    # New primitive: no existing packages/ui/src/core toggle-group/segmented-control component to
    # reuse (checked core/ui/ -- button, popover, calendar, badge, tabs only). role="radiogroup" of
    # three role="radio" options (single-select, roving tabindex, min-h-11 hit area per
    # components.nav.item_hit_area's existing convention) -- deliberately NOT EventDiscoveryPanel's
    # own role="tablist"/"tab" view-switcher pattern (that control switches which content panel is
    # displayed; this one filters data within one already-displayed panel, a different APG role).
    # Color pairing reuses {components.button.primary}/{components.button.secondary}
    # (bg-violet-600 text-white / bg-gray-200 text-gray-800) -- the same 2-state active/inactive
    # convention already used for TabbedShell's tab bar (EXPERIENCE.md Account Settings & Moderator
    # Tools Shells), rather than a third color pairing for what is functionally the same "which one
    # of a few options is selected" idea.
    base: "inline-flex items-center rounded-md border border-gray-200 p-0.5 gap-0.5 w-full sm:w-auto" # own row, full-width on mobile (matches SearchBar's own row width); sm:w-auto lets it collapse to its natural width once it becomes the leading control in the desktop facet row (see EXPERIENCE.md placement decision)
    option: "flex-1 sm:flex-none min-h-11 px-3 py-1.5 rounded text-sm font-medium text-center transition-colors" # flex-1 only matters at the full-width mobile size, where it makes the 3 options divide the row evenly
    option_active: "bg-violet-600 text-white"
    option_inactive: "text-gray-600 hover:bg-gray-100"
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
    # References: imports/event-card-calendar-row/with-thumbnail.png (with-image state), imports/event-card-calendar-row/thumbnail-fallback.png (missing/expired-image fallback).
    base: "flex items-stretch gap-2 rounded-md shadow-sm p-2 bg-violet-50 border border-violet-200" # was already the card's own chrome (violet-50 fill/border) -- now also the 3-zone flex row container below
    date_box:
      # CORRECTED <bmad-ux pass, 2026-09-14>. Previously a single-line `text-xs` box -- the same wrong shape
      # event_card_date_box.base_default carried before this pass's correction (see that token's own comment for
      # the full story). Now reuses the corrected two-tier month/day chrome, scaled down slightly for this row's
      # tighter height. Same solid-navy treatment (no photo directly behind it, same reasoning), but its content
      # is till/end info, not formatShortEventDateTime's start-date output -- unchanged from the 2026-09-11 pass's
      # resolution (.memlog.md override): no separate `event_card_till_badge` component instance on this card.
      # The small amber corner tag imports/event-card-calendar-row/with-thumbnail.png shows is this box's own
      # chrome (`till_label` below), reusing event_card_till_badge.base's literal classes for visual consistency,
      # not a second independently-gated badge -- this single box does both jobs (date-shaped chrome, till-shaped
      # content), since the day/date container this card sits inside already shows the start date. **Differs from
      # event_card_till_badge's own gating (AC14: no badge until the event has started)**: a calendar row is
      # already anchored to one specific day/segment, so showing nothing pre-start would leave most upcoming
      # cards' date boxes empty, which defeats the point of keeping a box here at all -- `till_label` is always
      # shown, never gated. Deferred to the amendment story: the exact always-shown text rule for `month`/`day`
      # below (e.g. that day's segment end time, "till hh:mm", independent of has-it-started) -- reuses
      # `formatEventTime` and the day-segment data `WeeklyCalendarView.tsx` already computes
      # (`dayBuckets`/`isFirstSegment`/`isLastSegment`), not new formatting logic.
      # Implementation note: `WeeklyCalendarView.tsx`'s shipped `variant === 'list'` path already renders this
      # slot via the shared `EventCardDateBox` primitive and `computeCalendarSegmentTillText` -- that component
      # still needs the same two-tier/till_label adoption `event_card_date_box.base_default` does, tracked as the
      # same follow-up story (see that token's comment).
      # Reference: imports/event-card-calendar-row/with-thumbnail.png; validated prototype:
      # prototypes/event-card-calendar-row/with-thumbnail.html.
      base: "relative flex flex-col justify-center gap-0.5 px-3 py-2 rounded-md bg-slate-800 text-white shadow-sm shrink-0 leading-none"
      till_label: "absolute -top-1.5 -left-1.5 z-20 px-1.5 py-0.5 rounded-full bg-amber-700 text-white text-[10px] font-semibold leading-none shadow-sm whitespace-nowrap" # literal-class match to event_card_till_badge.base's chrome -- not that component, see note above
      month: "text-sm font-bold uppercase tracking-wide" # slightly smaller than event_card_date_box.base_default.month for this row's tighter height
      day: "text-3xl font-extrabold leading-none" # slightly smaller than event_card_date_box.base_default.day
    content: "flex-1 min-w-0 flex flex-col gap-1 justify-center" # title/venue/badges column -- reuses event_card_status_badge (happeningNow now labeled "Now") / event_card_nearby_badge (now REPLACES the category/type badge in this row, <8km gated -- see event_card_nearby_badge's own comment) as-is, no new badge tokens needed
    title: "text-sm font-bold line-clamp-2" # REVISED <bmad-ux pass, 2026-09-14>, user-directed -- was text-xs truncate (1 line). Mobile calendar view rule: event name up to 2 lines.
    venue: "text-xs text-muted-foreground truncate" # New <bmad-ux pass, 2026-09-14>, user-directed explicit token -- single line. Mobile calendar view rule: venue name max 1 line (unchanged behavior, now named/tokenized).
    image_wrapper: "h-full flex flex-col items-center justify-center gap-1 shrink-0" # New <bmad-ux pass, 2026-09-14>, user-directed (user replaced the reference screenshot to show this). Holds `image` and `favorite_badge` as a vertical two-item stack (thumbnail, then favorite pill below it) centered within the row's full stretched height -- REVERSES the prior corner-overlay composition (favorite_badge was absolutely positioned on the thumbnail's own corner). With-image composition only.
    image: "w-16 h-16 object-cover rounded-md" # was "w-full h-12" (assumed full-bleed top image, never built) -- resized to a fixed square thumbnail matching the row's own height, mirroring event_card_masonry.thumbnail_default's "size the image to the fixed chrome around it, not the reverse" rule, for the same graceful-degrade reason (FIND-023). Only rendered when the image is present and not errored -- see event_card_compact_thumbnail_fallback below for what renders otherwise, now a structurally different (not reserved-slot) case. No longer needs `relative` -- favorite_badge is a sibling below it now, not an absolute overlay on top of it.
    favorite_badge: "flex items-center gap-1 px-2 py-1 rounded-full bg-background shadow-sm" # REVISED <bmad-ux pass, 2026-09-14>, user-directed: moved from a small corner-overlay pill on the thumbnail (absolute top-1 right-1, bg-background/80 backdrop-blur-sm) to its own pill directly BELOW the thumbnail, inside `image_wrapper`. Drops the glassmorphism (bg-background/80 backdrop-blur-sm) since it no longer sits over image content -- solid bg-background/shadow-sm instead. With-image composition only.
  event_card_compact_thumbnail_fallback:
    # REVISED <bmad-ux pass, 2026-09-14>, user-directed -- REVERSES this token's own original (2026-09-11)
    # reserved-space-not-reflow convention, brought in line with event_card_calendar_grid_item's same-pass rule
    # rather than event_card_masonry's. Previously: the w-16 h-16 slot stayed reserved (no reflow/collapse),
    # matching event_card_masonry.thumbnail_default_fallback's convention. Now: "no area for image" -- when the
    # image is absent or errored, the `image` element is omitted from the DOM entirely (not left blank in place),
    # `content` expands to fill the freed width, and `{components.event_card_favorite_count_badge_large}` sits
    # directly at the row's end with no fixed-width wrapper reserved for it. Masonry's own fallback
    # (thumbnail_default_fallback) is UNCHANGED by this revision -- the user's rules explicitly distinguish
    # masonry (keeps its reserved slot) from the row and grid-item cards (both drop it), not a general rule
    # applied uniformly across all three families.
    # Reference: imports/event-card-calendar-row/thumbnail-fallback.png; validated prototype:
    # prototypes/event-card-calendar-row/thumbnail-fallback.html.
    base: null # deliberately no chrome of its own, no reserved dimensions -- see comment above; content/favorite render via event_card_compact.content and event_card_favorite_count_badge_large directly
  event_card_calendar_grid_item:
    # New <bmad-ux pass, 2026-09-14> -- backlog IDEA-016/IDEA-017, the desktop counterpart to event_card_compact
    # (Calendar Row Card, mobile). Grounded directly in WeeklyCalendarView.tsx's actual `variant === 'grid'`
    # CalendarCard path (today: plain text-only -- title + favorited/added-to-calendar icons + favoriteCount
    # line, no thumbnail, no date box) and its `DAY_CELL_CLASS`/popover/multi-day-bar chrome (see attachment
    # note below).
    #
    # ATTACHMENT SPLITS BY SINGLE-DAY VS. MULTI-DAY (revised 2026-09-14, user-directed -- this pass's earlier
    # draft gave both cases one shared mechanism; that was wrong, per the user's own view-mode rules).
    #
    # Single-day (unchanged from this pass's earlier finding): `DAY_CELL_CLASS` = "p-2 h-32 flex flex-col gap-1
    # overflow-hidden relative" -- a FIXED h-32 (128px) with overflow-hidden, meant to hold up to
    # `event_rendering.discovery_view.max_events_per_day` (5) events before the "+N more" popover takes over. At
    # a common 1280px viewport (sm:p-8/32px page padding): content=1280-64=1216, day_cell width=1216/7=174px.
    # Single-day events never show a thumbnail at all (see `no_image_*` tokens below), so this composition is
    # compact enough it may fit directly in a day_cell for at least the first visible event; overflow beyond
    # whatever fits still goes to the EXISTING "+N more" popover (WeeklyCalendarView.tsx: `w-56 max-h-56
    # overflow-y-auto p-3` -- 224px wide, 12px padding, 200px inner content width, scrollable, no fixed per-item
    # height) -- screenshot-validated at that real width (prototypes/event-card-calendar-grid-item/
    # thumbnail-fallback.html): fits comfortably, multiple cards scroll cleanly. Exact max_events_per_day
    # recalibration for the richer (vs. today's plain-text) single-day card remains an implementation-story
    # question, not resolved here.
    #
    # Multi-day (revised 2026-09-14 -- NOT the popover): a multi-day schedule renders as ONE card spanning
    # across its N day-columns directly in `grid_weekly`, extending the same mechanism
    # `MULTI_DAY_EVENT_CLASS`/`multiDayRoundingClass` already uses for the plain-text multi-day bar today, not a
    # per-day popover-list item. Because its width is `N * day_cell_width` (e.g. a 3-day span at the 1280px
    # viewport above = 3*174=522px) rather than a fixed ~200px, this composition -- which DOES show a thumbnail,
    # see the with-image composition below -- has ample room; screenshot-validated at that real spanning width
    # (prototypes/event-card-calendar-grid-item/with-thumbnail-multiple-days.html): fits comfortably. This also
    # simplifies the old per-segment rounding logic: since it's one spanning element, not repeated per-column
    # segments, there is no need for `multiDayRoundingClass`'s suppressed-rounding-at-touching-edges trick --
    # ordinary uniform rounding on both ends is enough.
    # See EXPERIENCE.md Component Patterns > Calendar View Cards: Attachment and Composition for the full
    # resolution, covering this card and event_card_compact together.
    #
    # NO "DAY X OF N" BADGE (revised 2026-09-14, user-directed -- reverses this pass's own earlier addition).
    # Since a multi-day schedule now renders as one spanning card rather than repeated per-day segments, its
    # position in the calendar already conveys which days it covers -- an explicit "Day X of N" label would be
    # pure duplication. The `multi_day_badge` token this pass first added is REMOVED; no replacement token.
    #
    # COMPOSITION: deliberately has NO date box at all (unlike event_card_compact, which keeps one showing
    # till/end info) -- the desktop day-column header(s) sit directly above wherever this card renders (a single
    # day_cell, or the columns a multi-day bar spans), so a per-card date reference here is even more redundant
    # than on mobile (where day_row_header can already be several rows away by scroll). imports/
    # event-card-calendar-grid-item/with-thumbnail-multiple-days.png confirms this -- no date chrome of any kind
    # appears anywhere in the reference.
    #
    # IMAGE IS CONDITIONAL, NOT A RESERVED SLOT (revised 2026-09-14, user-directed correction of this pass's own
    # first draft, which wrongly copied the masonry/row cards' "reserved space, never reflows" convention onto
    # this card). `image` renders ONLY when the schedule is multi-day AND its image hasn't errored/expired
    # (`isMultiDay && !imgError`) -- a single-day event never attempts an image at all, and there is no reserved
    # blank slot for it: when the condition is false, the `image` element is omitted from the DOM entirely and
    # `content`/`favorite` occupy the card's full width from its left edge. This is a genuine, deliberate
    # divergence from `event_card_masonry`/`event_card_compact`'s reserved-space-not-reflow rule (see
    # `no_image_*` tokens below and EXPERIENCE.md's Accessibility Floor note on why this doesn't carry the same
    # WCAG 2.4.3 concern here).
    #
    # WITH-IMAGE COMPOSITION (3-column row, multi-day only, spanning N day-columns -- see Attachment above):
    # image, then a title/venue column (no multi-day badge, per above), then a favorite+badges stack on the
    # right -- badges sit beside the favorite control here, NOT inline under title/venue like
    # event_card_masonry.badge_row/event_card_compact.content -- a genuine, PNG-observed layout difference,
    # preserved as-is. `title`/`venue` get however much width the span gives them (user: "the event title and
    # venue name area's width could expand adapting the card width").
    # Reference: imports/event-card-calendar-grid-item/with-thumbnail-multiple-days.png; validated prototype:
    # prototypes/event-card-calendar-grid-item/with-thumbnail-multiple-days.html.
    #
    # IMAGE AND FAVORITE AREA ARE 1:1/CENTERED AGAINST THE ROW'S OWN HEIGHT (revised 2026-09-14, user-directed:
    # "the thumbnail and its parent area are positioned center both vertically and horizontally" / "the favorite
    # area should be positioned center both vertically and horizontally"). `image` is explicitly `aspect-square`.
    # SIMPLIFIED MECHANISM (user's own later edit, superseding this pass's first draft): rather than each column
    # individually stretching to the row's height and then re-centering its own content in a nested wrapper, the
    # row's own alignment is simply `items-center` (not `items-stretch`) -- every column (image, content,
    # side_stack) then sizes to its own natural height and centers directly against the row's tallest sibling
    # (normally `content`'s title/venue text). This is why `base` uses `items-center`, not `items-stretch`, unlike
    # every other card family's row-based composition in this document.
    #
    # NO STATUS BADGE ON THIS COMPOSITION (removed 2026-09-14, user-directed: "no need the `now` related badge"):
    # `side_stack` on the with-image/multi-day composition shows only the favorite control and the nearby/radius
    # badge -- `{components.event_card_status_badge}` is dropped here entirely, unlike the masonry and row cards
    # which both keep it. The no-image (single-day) composition never had a status badge in the first place, so
    # this is scoped to the with-image state only.
    #
    # CATEGORY/TYPE BADGE REPLACED BY THE NEARBY/RADIUS BADGE, GATED AT <8KM (revised 2026-09-14, user-directed;
    # threshold corrected same pass -- see event_card_nearby_badge's own comment for the general, cross-card-family
    # version of this rule): this card never shows the category/type badge ("Music") its siblings previously
    # showed -- the same badge slot instead shows `{components.event_card_nearby_badge}` (Navigation icon +
    # distance) ONLY when the event is <8km away, omitted entirely (not a placeholder) otherwise. Not a new
    # token; reuses that existing component as-is, just with its threshold and role both revised this pass.
    #
    # FAVORITE CONTROL IS ALWAYS THE "LARGE" SHAPE, NOT GATED ON IMAGE SUCCESS/FAILURE (corrected 2026-09-14 after
    # re-comparing both reference screenshots side by side): both the with-image and no-image states show the
    # identical large, unpilled, icon-over-text heart+count (`{components.event_card_favorite_count_badge_large}`)
    # -- unlike the masonry/row cards, this card has no small-corner-pill favorite variant at all, so there is
    # nothing to gate between. This pass's first draft wrongly built the with-image state's favorite control as a
    # small inline icon+text row; corrected here to match the reference.
    #
    # TITLE WRAPS, VENUE WRAPS UP TO 2 LINES (revised 2026-09-14, user-directed; this pass's first draft
    # incorrectly single-line-truncated both): the user's explicit line-count rules for this pass covered mobile
    # (title 2 lines/venue 1 line) and masonry (title 2 lines/venue 1 line) but not this card, so its own
    # reference screenshots remain the source of truth here: title wraps freely across multiple lines, venue
    # wraps up to 2 lines -- a genuine, deliberate difference from its siblings' explicit caps, not an oversight.
    base: "flex items-center gap-2 rounded-md shadow-sm p-2 bg-violet-50 border border-violet-200" # REVISED <bmad-ux pass, 2026-09-14>, user-directed -- was `items-stretch`; see the IMAGE AND FAVORITE AREA comment above for why `items-center` is now correct here (a deliberate divergence from EVENT_CARD_COMPACT_CLASS/MULTI_DAY_EVENT_CLASS elsewhere, which do use items-stretch). Used for the with-image (3-column, multi-day-spanning) composition only -- see no_image_base below for the no-image (2-row) composition's own chrome. Width is `N * day_cell_width` for a multi-day span, not a fixed value -- see Attachment above.
    image: "w-14 aspect-square object-cover rounded-md" # only rendered when isMultiDay && !imgError -- see comment above. 1:1, centered against the row's own height via `base`'s `items-center` (no separate wrapper needed). Smaller than event_card_compact.image's w-16 h-16
    content: "flex-1 min-w-0 flex flex-col gap-1 justify-center" # with-image composition only
    title: "text-sm font-bold" # no truncate -- wraps freely across multiple lines, shared by both the with-image and no-image compositions
    venue: "text-xs text-muted-foreground line-clamp-2" # wraps up to 2 lines, shared by both compositions
    side_stack: "flex flex-col items-end gap-1 shrink-0" # with-image composition only: event_card_favorite_count_badge_large, then event_card_nearby_badge (<8km gated, omitted otherwise), right-aligned; centered against the row's own height via `base`'s `items-center` (REVISED 2026-09-14, was a separate `h-full`/`justify-center` wrapper, simplified away once `base` itself switched to `items-center`) -- NO event_card_status_badge here (removed 2026-09-14, user-directed) -- see base-level comment on why this differs from the masonry/row cards' inline badge placement
    no_image_base: "flex flex-col gap-1 rounded-md shadow-sm p-2 bg-violet-50 border border-violet-200" # New 2026-09-14. The no-image composition's own chrome -- same fill/border as `base`, but flex-col (two stacked rows) instead of `base`'s flex row (3 columns), since there's no image/side-stack column to lay out against. Renders whenever `image` above does not (single-day event, or a multi-day event whose image errored).
    title_row: "flex items-start justify-between gap-2" # New 2026-09-14. Row 1 of the no-image composition: `title` (flex-1) beside `event_card_favorite_count_badge_large` (shrink-0). `items-start` (not center) so a wrapping multi-line title doesn't push the favorite control down the row -- it stays pinned to the row's top edge, matching the reference screenshot.
    location_row: "flex items-center justify-between gap-2" # New 2026-09-14. Row 2 of the no-image composition: `venue` (flex-1) beside `event_card_nearby_badge` (shrink-0, <8km gated, omitted otherwise).
  event_card_calendar_grid_item_thumbnail_fallback:
    # CORRECTED 2026-09-14 (this pass's own first draft was wrong, per user-supplied revised reference
    # screenshot). This is NOT a reserved-slot-stays-blank fallback the way event_card_masonry.
    # thumbnail_default_fallback is (event_card_compact_thumbnail_fallback was ALSO revised this same pass to
    # drop its own reserved slot -- see that token's comment; masonry alone keeps the reserved-space convention)
    # -- this card has no reserved image space to begin with (see event_card_calendar_grid_item's own comment:
    # `image` is conditional on `isMultiDay && !imgError`, never a reserved slot). When that condition is false, there is no fallback
    # element at all to token here -- the card instead renders entirely via event_card_calendar_grid_item's
    # `no_image_base`/`title_row`/`location_row` tokens, a structurally different two-row composition (title +
    # favorite on row 1, venue + nearby badge on row 2) rather than the with-image state's 3-column row. This
    # token block is kept only as a named cross-reference to that composition, not as its own distinct chrome.
    # Reference: imports/event-card-calendar-grid-item/thumbnail-fallback.png; validated prototype:
    # prototypes/event-card-calendar-grid-item/thumbnail-fallback.html.
    base: null # deliberately no chrome of its own -- see event_card_calendar_grid_item.no_image_base/title_row/location_row for the actual tokens this state renders with
  event_card_masonry:
    # Added 2026-08-25 -- Story 1.3b's variant="masonry" prop, sprint-change-proposal-2026-08-24-ux-rework-batch.md
    # Section 4.4/4.5. Distinct from event_card_compact above, which is the calendar view's per-schedule
    # mini-card, not a card-grid mode. Amended 2026-09-04 -- sprint-change-proposal-2026-09-04.md Section 4.3
    # (Story 1.3b AC14-AC18 / 1.3d AC16-AC19): replaces the top-left relative-day pill with event_card_date_box
    # (below), adds a below-image badge row, and adds the prominent-poster treatment for durableImageUrl-driven
    # opted-in accounts (PRD SS3.16). Reference: two user-provided screenshots -- default and opted-in/prominent
    # states are the identical structure, only the poster's aspect ratio differs between them (user-confirmed).
    max_width: "max-w-[230px]" # New <bmad-ux pass, 2026-09-14>, user-directed, applies to ALL THREE masonry states (default-with-thumbnail, default-thumbnail-fallback, prominent-poster). The card never exceeds 230px regardless of its grid slot's own width -- at the mobile 2-col slot (175px) this has no effect (already narrower than the cap); at the desktop xl:5-col slot (269px) the card renders at 230px, left-aligned within the wider cell via ordinary CSS Grid item alignment (no `justify-items` override needed), leaving the remainder as unused cell space. Implemented as a single class on the card's own root element (`w-full max-w-[230px]`, or on a wrapper carrying both the real slot width and this cap) -- not a second nested wrapper.
    image: "w-full aspect-[3/4] object-cover" # native aspect ratio, default/non-prominent poster -- unchanged
    image_prominent: "w-full aspect-square object-cover" # REVISED <bmad-ux pass, 2026-09-14>, user-directed -- was aspect-[2/3] (Story 1.3b AC17's taller portrait poster). Rendered when prominentPoster=true (EventListView derives this from durableImageUrl != null, AC17). Same date_box/till_badge/heart+count overlay treatment and badge_row placement as the default state -- only the image silhouette changes.
    caption: "p-3 flex-1 flex flex-col gap-2" # unchanged container -- badge_row (below) is now its first flex child, so the existing gap-2 spacing applies uniformly between badge_row, the title, and locationName with no separate wrapper needed
    title: "text-sm font-bold text-foreground leading-tight line-clamp-2" # New <bmad-ux pass, 2026-09-14>, user-directed -- previously used the generic {components.card.title} token (text-lg font-bold), single-line by default. Now an explicit masonry-specific override: wraps up to 2 lines, and the font size is deliberately smaller than {components.card.title} to leave room for a 2-line title in a narrow 2-col mobile tile (user: "the event name font size could be smaller compared to the screenshot").
    venue: "text-xs text-muted-foreground truncate" # New <bmad-ux pass, 2026-09-14>, user-directed -- explicit single-line truncation (was unstyled/unclamped, relying on default block wrapping).
    badge_row: "flex items-center gap-1.5 flex-wrap" # status badge (event_card_status_badge, "happeningNow" now labeled "Now") always first, then event_card_nearby_badge -- REVISED <bmad-ux pass, 2026-09-14>, user-directed: the nearby/radius badge now REPLACES the category/type badge in this row entirely (distanceKm < 8 gated, omitted otherwise) rather than appending alongside it (AC15/AC16's original "status badge + nearby badge when present" pairing is unchanged in spirit -- what changed is that a category/type badge no longer competes for the same row at all). Sits below the top row (poster, or top_row_default below) against the card's own bg-card background, so unlike date_box/till_badge it uses solid fills, not glassmorphism. REVISED <bmad-ux pass, 2026-09-16>, user-directed: order is now status badge, then event_card_repeat_badge (icon-only, gated on this card's featured schedule carrying applicableDaysOfWeek -- see EXPERIENCE.md Component Patterns > Day-of-Week Recurring Schedules), then event_card_nearby_badge.
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
      # Reference: imports/event-card-masonry/default-with-thumbnail.png.
      base: "flex items-stretch gap-2"
    thumbnail_default:
      # Sits beside event_card_date_box.base_default inside top_row_default. `flex-1` (fills whatever width the
      # date box doesn't take) with `h-full` (stretches to the row's height, which top_row_default's
      # `items-stretch` sets to the date box's own intrinsic height) -- so this is always roughly square for a
      # typical short date-box string ("12 Oct"), never a tall poster. `min-w-0` prevents the flex item from
      # refusing to shrink below the image's natural width in a narrow 2-col masonry tile.
      base: "flex-1 h-full min-w-0 object-cover rounded-md"
      favorite_badge: "absolute top-1 right-1 z-10 flex items-center gap-1 px-1.5 py-1 rounded-full bg-background/80 backdrop-blur-sm shadow-sm font-semibold" # small heart+count pill overlaid on the thumbnail's own corner -- same role the full poster's heart+count pill already plays, just repositioned onto a smaller image; requires the thumbnail's own wrapper to carry `relative`. Padding (`px-1.5 py-1`) and responsive font-size (`text-xs` mobile/`text-sm` desktop, inherited by the count text) REVISED <bmad-ux pass, 2026-09-14>, round 8, user-directed ("favorite badge font and padding size uniform on prominent-card & card-with-small-thumbnail") to exactly match {components.event_card_date_box.favorite_pill} -- was a looser `px-2.5 py-1.5` at the desktop real width before this pass.
    thumbnail_default_fallback:
      # New <bmad-ux pass, 2026-09-11> -- backlog FIND-023 + the missing/expired-image reference screenshot.
      # Renders when the image is absent or its onError fires -- the same detection EventCard.tsx's existing
      # `!imgError && imageUrl` branch already does for AC3's standard-variant fallback; this is that branch's
      # masonry-default equivalent, not new detection logic. thumbnail_default's own dimensions (flex-1 h-full)
      # are unchanged and still reserved -- per FIND-023, nothing else renders in the image's place (no icon, no
      # "image not available" text, no fill distinct from the card's own bg-card) -- and
      # event_card_favorite_count_badge_large (below) replaces the small corner favorite_badge, centered in the
      # reserved slot instead of corner-anchored, matching the reference screenshot exactly.
      # Reference: imports/event-card-masonry/default-thumbnail-fallback.png.
      base: "flex items-center justify-center h-full"
  event_card_favorite_count_badge_large:
    # New <bmad-ux pass, 2026-09-11> -- shared between event_card_masonry's default-state missing-image fallback
    # (thumbnail_default_fallback above) and the new calendar row-card's own missing-image fallback
    # (event_card_compact_thumbnail_fallback below). Both reference screenshots show the identical treatment:
    # imports/event-card-masonry/default-thumbnail-fallback.png and
    # imports/event-card-calendar-row/thumbnail-fallback.png.
    # the same favorite-toggle heart icon and count, just larger and with no pill/background, standing alone
    # where the image would have been. Not a new component -- the same favorite-toggle button EventCard/
    # WeeklyCalendarView already render, just re-skinned; only the icon size and the removed pill background
    # differ from event_card_favorite_count_badge's default styling. Kept a real, min-h-11/min-w-11-sized tap
    # target (components.nav.item_hit_area's existing convention) even though it visually looks like bare text
    # -- it's still the live favorite toggle, not a decorative label.
    base: "flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-11 text-sm font-medium text-foreground" # no bg/pill, unlike event_card_favorite_count_badge's small corner pill. Text size floor: >=11px (bmad-ux pass, 2026-09-14, general legibility rule covering this + till/status/nearby badges) -- text-sm (14px) already clears it; never drop below text-[11px] at any real card width. ADDITIONAL RULE (round 6, user-directed): this favorite badge's font-size must always be >= whatever {components.event_card_till_badge}/{components.event_card_date_box} till-adjacent text size applies on the same card -- verified at every real width across all three card families (masonry, calendar-row); where a mismatch was found (masonry mobile: favorite was 11px against till's 12px) the favorite was bumped up, never the till badge down.
    icon: "w-6 h-6 text-rose-500 fill-rose-500" # larger than event_card_favorite_count_badge's default icon -- confirm that component's exact current icon size at implementation time and size this proportionally larger, not to an arbitrary fixed value. REVISED <bmad-ux pass, 2026-09-14>, user-directed: on the masonry and calendar-row cards' missing-image fallback, this icon actively scales up with however much space the missing image freed -- masonry's reserved slot is a fixed size (matching the date box's own height) so the icon fills more of that fixed footprint at each real card width (validated at both 175px mobile and 269px desktop masonry widths); the calendar-row card has no reserved slot at all, so its icon scales with however much of the row's real width is actually left over after title/venue/badges (validated at both 326px and 655px real row widths). Not a single fixed icon size -- see prototypes/event-card-masonry/default-thumbnail-fallback.html and prototypes/event-card-calendar-row/thumbnail-fallback.html for the concrete sizes at each real width.
  event_card_date_box:
    # Added <bmad-ux pass, 2026-09-04> -- sprint-change-proposal-2026-09-04.md Section 4.3, supersedes
    # event_card_relative_day_pill (2026-08-25) entirely for the masonry variant. REVISED <bmad-ux pass,
    # 2026-09-11> -- reference screenshots reopened this pass overturned the "identical in both poster states"
    # premise below: this is now two compositions gated on prominentPoster (the same durableImageUrl-derived
    # flag Story 1.3b AC17 already threads through), not one. `base` (unchanged) now applies ONLY when
    # prominentPoster=true. See `base_default` for the new prominentPoster=false composition, and
    # event_card_masonry.top_row_default for how the two sit in the DOM.
    #
    # `base` (prominentPoster=true only): same top-left overlay slot/z-index as the relative-day pill it
    # replaced; restyled as a squarer "box" (rounded-md, not rounded-full) so it reads as a date chip distinct
    # from a pure status pill. Primary content is the exact same formatShortEventDateTime() output the pill
    # already rendered (Today/Tomorrow/weekday/short-date, e.g. "12 Oct") plus its existing
    # Clock-icon-when-today-with-time rule (AC12) -- reused verbatim, not reimplemented.
    #
    # POSITION IS CONDITIONAL ON WHETHER `{components.event_card_till_badge}` IS PRESENT (revised 2026-09-14,
    # rounds 5-7, user-directed -- iterated through two wrong mechanisms before landing here, see git history on
    # this file for the abandoned attempts). The overlay's own corner tag (till badge) needs vertical clearance
    # above this pill's text that the pill's default `top-2` position doesn't leave inside the poster
    # (`overflow-hidden` would clip the tag). Resolved via POSITION ONLY, not padding:
    #   - When the event has a till badge (ends tomorrow or later): this pill moves to `top-2` -> `top-5`, and
    #     `{components.event_card_masonry.favorite_pill}` (below) moves to the SAME `top-5` to stay visually
    #     aligned with it -- "the date badge and favorite badge may need to be moved down to follow up" the till
    #     tag's own reposition (user's own framing). Padding stays uniform (`p-1`, all sides equal) -- a padding
    #     trick (asymmetric top/bottom padding) was tried and explicitly rejected by the user as the wrong
    #     mechanism.
    #   - When there is no till badge (event already ended / ends today): this pill stays at its original `top-2`,
    #     unchanged, uniform `p-1` padding, no adjustment needed since there's no corner tag to clear.
    # Validated at both the mobile (175px) and desktop (269px-slot/230px-capped) real widths -- the poster's own
    # `aspect-square` sizing means the desktop instance has if anything more clearance, not less. See
    # prototypes/event-card-masonry/prominent-poster.html Panels A-D for all four combinations (has-till/no-till
    # x mobile/desktop).
    #
    # FONT SIZE HARMONIZED ACROSS ALL THREE MASONRY VARIANTS (revised 2026-09-14, round 8, user-directed: "the
    # till badge has font and padding size uniform across different variant"). This pill's font-size is now set
    # ONCE on the pill container itself and inherited by both the till badge span and the date text inside it
    # (rather than each element declaring its own size, which could drift out of sync) -- `text-xs` (12px) at the
    # mobile real width, `text-sm` (14px) at the desktop real width. This is the SAME responsive convention
    # `{components.event_card_date_box.base_default}` (below) and `{components.event_card_compact.date_box}`
    # already use for their own till-adjacent text -- previously this token was pinned at a fixed `text-[11px]`
    # regardless of viewport as a deliberate prominent-only exception; that exception is now removed in favor of
    # full cross-variant consistency.
    # Reference: imports/event-card-masonry/prominent-poster.png; validated prototype:
    # prototypes/event-card-masonry/prominent-poster.html (Panels A-D).
    base: "absolute left-2 z-10 flex items-center gap-1 p-1 rounded-md bg-background/80 backdrop-blur-sm shadow-sm text-foreground font-semibold" # top-2 (no till badge) or top-5 (has till badge, see comment above); text-xs mobile / text-sm desktop, set here and inherited by the till badge + date text inside
    icon: "w-3 h-3" # existing Clock icon, rendered only when hasTime && dayDiff === 0 -- unchanged rule carried over from the superseded pill
    favorite_pill: "absolute right-2 z-10 flex items-center gap-1 px-1.5 py-1 rounded-full bg-background/80 backdrop-blur-sm shadow-sm font-semibold" # New <bmad-ux pass, 2026-09-14>. The prominentPoster=true poster's own heart+count overlay (distinct from event_card_masonry.thumbnail_default.favorite_badge, which is the non-prominent state's equivalent) -- previously untokenized. Same `top-2`/`top-5` conditional as `base` above, since the two move together. Padding (`px-1.5 py-1`) and responsive font-size (`text-xs`/`text-sm`, inherited by its count text) now match {components.event_card_masonry.thumbnail_default.favorite_badge} exactly -- round 8's "favorite badge font and padding size uniform on prominent-card & card-with-small-thumbnail" harmonization. Icon stays `w-3 h-3` (unchanged, matches the non-prominent state's corner pill icon size).
    base_default:
      # New <bmad-ux pass, 2026-09-11>. prominentPoster=false (the common case -- a hotlinked/scraped image that
      # can expire, PRD SS3.16). No longer absolutely positioned over a poster: it's a normal-flow flex sibling
      # of the small thumbnail (event_card_masonry.thumbnail_default) inside event_card_masonry.top_row_default,
      # which uses `items-stretch` so the *thumbnail* stretches to match the date box's own intrinsic height --
      # not the other way around. Solid fill instead of glass/blur, since there's no photo directly behind it to
      # blur here, only the card's own bg-card background -- matching badge_row's existing "solid fills, not
      # glassmorphism" rationale one level down. `bg-slate-800` is a literal-class match for `colors.primary`
      # (#1E293B) -- reuses the existing brand primary rather than introducing a new dark neutral, and matches
      # the reference screenshots' solid navy box. `relative` is required here (unlike `base`, which is itself
      # `absolute` and so already a valid containing block) so event_card_till_badge can still anchor to this
      # box's corner.
      #
      # CORRECTED <bmad-ux pass, 2026-09-14>. The `base`/`month`/`day` below previously described a single-line
      # `text-xs` box -- literally `base` above, just re-skinned -- and claimed its content rule was "identical to
      # `base`" otherwise unchanged. That was wrong from the moment it was written: imports/event-card-masonry/
      # default-with-thumbnail.png has always shown a large two-tier stacked treatment (a small uppercase
      # month/weekday line over a large bold day-of-month number), not a single line -- a genuine content-rule
      # difference from `base`, not just a restyle. This went unnoticed through two prior passes (2026-09-04,
      # 2026-09-11) because both re-described the reference screenshot in prose rather than reconstructing it;
      # caught only now because this pass built and screenshot-validated an actual HTML/Tailwind prototype from
      # the PNG (prototypes/event-card-masonry/default-with-thumbnail.html, prototypes/validation-log.md) per
      # bmad-png-to-html's fidelity check, and the doc is corrected to match the prototype/PNG, not the other way
      # around. Content rule: still formatShortEventDateTime's output, now split across `month` (e.g. "Oct") and
      # `day` (e.g. "12"); the existing Clock-icon-when-today-with-time rule (AC12) is unchanged in trigger
      # condition, rendered inline with `month`.
      # Deferred to the implementation story (doc-only pass, no code changed here): packages/ui/src/features/
      # events/EventCardMediaPrimitives.tsx's shipped `EventCardDateBox` component still renders the old
      # single-line `text-xs` shape this correction replaces, and event-card-media-tokens.ts's AD-15 icon-scale
      # token is calibrated against that same text-xs size -- both need a follow-up story, not just this doc fix.
      # Reference: imports/event-card-masonry/default-with-thumbnail.png; validated prototype:
      # prototypes/event-card-masonry/default-with-thumbnail.html.
      base: "relative flex flex-col justify-center gap-0.5 px-4 py-3 rounded-md bg-slate-800 text-white shadow-sm shrink-0 leading-none"
      month: "text-lg font-bold uppercase tracking-wide" # top line -- weekday/month abbreviation, e.g. "Oct"; Clock icon (AC12) renders inline with this line when hasTime && dayDiff === 0
      day: "text-5xl font-extrabold leading-none" # bottom line -- the day-of-month number, e.g. "12"
  event_card_till_badge:
    # Added <bmad-ux pass, 2026-09-04> -- Story 1.3b AC14. REVISED <bmad-ux pass, 2026-09-11> -- reference
    # screenshots reopened both the position (was bottom-edge-center) and the color (was a neutral inverted
    # bg-foreground/text-background, tied to whichever background the date box itself used) to a corner tag
    # with its own distinct amber/gold accent, decoupled from the date box's own color -- the two would otherwise
    # have to track each other's now-divergent styling across prominentPoster states (see event_card_date_box).
    # User confirmed (2026-09-11): a new solid amber token, not a reuse of status_badge.pendingReview's pale
    # amber-100/amber-800 pill (that pairing reads as a calm review-status pill, not an urgency accent tag) and
    # not the brand accent #FF5A5F (reads coral/red, not gold). amber-700 (#B45309) on white was chosen over
    # amber-600 (#D97706) specifically for contrast at this token's small text size (originally 10px; raised to
    # >=11px <bmad-ux pass, 2026-09-14> per that pass's general legibility rule -- doesn't cross WCAG 1.4.3's
    # 18px/14px-bold "large text" threshold, so the calculation below still applies unchanged): amber-600/white
    # measures ~3.19:1, failing WCAG 1.4.3's 4.5:1 small-text floor; amber-700/white measures ~5.03:1, passing
    # with margin. Anchored to the containing date box's top-left corner in both prominentPoster states (works
    # against `base`, which is itself `absolute` and so already a containing block, and against `base_default`,
    # which now carries its own `relative` for exactly this reason).
    # References: imports/event-card-masonry/prominent-poster.png (prominentPoster=true), imports/event-card-masonry/default-with-thumbnail.png (prominentPoster=false).
    #
    # OFFSET DIFFERS BY CONTEXT (revised 2026-09-14, rounds 5-7, user-directed): the `-top-1.5 -left-1.5` corner
    # offset below is the DEFAULT, used as-is by `{components.event_card_date_box.base_default}` (masonry
    # non-prominent) and `{components.event_card_compact.date_box}` (calendar row) -- both anchor to a tall
    # two-tier pill with enough of its own vertical padding that the tag's default overlap never reaches the
    # text. `{components.event_card_date_box.base}` (masonry prominentPoster=true) is the ONE exception: its pill
    # is a short single-line chip with much less vertical room, so the tag needs a larger `-top-3` offset there
    # to clear the pill's text -- a position-only difference, not a different padding or chrome. See that token's
    # own comment for the full mechanism (including why the pill itself moves down to compensate).
    #
    # FONT SIZE NO LONGER FIXED AT text-[11px] (revised 2026-09-14, round 8, user-directed: "till badge font ...
    # uniform across different variant"). In every context, this tag's rendered size now matches its own pill's
    # text size -- `text-xs` (12px) mobile / `text-sm` (14px) desktop -- resolving round 4's flat >=11px floor
    # into a precise per-breakpoint pair. The MECHANISM differs slightly by context: on
    # `{components.event_card_date_box.base}` (masonry prominentPoster=true), whose pill has one simple text run
    # ("SEP 25"/"TODAY"), the size is set once on the pill and this tag inherits it via normal CSS cascade. On the
    # two-tier pills (`base_default`, `{components.event_card_compact.date_box}`), the month/day (or month/day
    # equivalent) spans need two DIFFERENT sizes each, so there's no single value to inherit from -- this tag
    # instead sets the same `text-xs`/`text-sm` explicitly, matching its pill's own text size by convention rather
    # than inheritance. Either way, the tag and its pill's text render at the identical size.
    base: "absolute -left-1.5 z-20 px-1.5 py-0.5 rounded-full bg-amber-700 text-white font-semibold leading-none shadow-sm whitespace-nowrap" # -top-1.5 (default) or -top-3 (masonry prominentPoster=true only, see comment above); font-size inherited from the containing pill, not set here
  event_card_status_badge:
    # Added <bmad-ux pass, 2026-09-04> -- Story 1.3b AC15 (8-state status badge: ended/happeningNow/endsToday/
    # inHours/tomorrow/weekday/inDays/upcoming). User decision: a single neutral style for all 8 states, text
    # alone differentiates them -- deliberately does NOT reuse {components.status_badge}'s positive/negative/
    # pendingReview/superseded palette, since that palette encodes review-workflow outcomes, not time-urgency,
    # and mapping e.g. "ended" onto its red "negative" variant would misread as an error/failure state. Shape
    # mirrors {components.status_badge}'s own base shape (`text-xs px-2 py-0.5 rounded font-medium shrink-0`)
    # exactly, just with a new neutral color pairing, so the two still read as the same family of "badge."
    # LABEL for the `happeningNow` state shortened to "Now" (decided <bmad-ux pass, 2026-09-14>, user-directed:
    # the previous "Happening Now" label should be a single translatable word). Scoped to this token's usage on
    # the masonry/row/grid-item card families this pass covers -- not asserted as an app-wide i18n string-table
    # change beyond that. The other 7 states' labels are unchanged.
    #
    # COLOR EXCEPTION FOR `happeningNow` ONLY (revised 2026-09-14, round 6, user-directed: "`now`-badge should
    # have more noticeable color"). This one state gets a distinctly more noticeable solid emerald green
    # (`happening_now` variant below) instead of the shared neutral `base` every other state uses. This is a
    # scoped, deliberate exception for this state's own visual weight -- NOT a reversal of the 2026-09-04 "one
    # neutral style for all 8 states" decision documented above; the other 7 states keep `base` unchanged, still
    # differentiated by text alone. Applied everywhere this badge renders in the masonry, calendar-row, and
    # calendar-grid-item card families (the grid-item's with-image composition dropped this badge entirely per
    # its own token's comment, so it doesn't apply there).
    base: "inline-flex items-center text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-muted text-muted-foreground" # text-xs (12px) already clears the >=11px badge-legibility floor (bmad-ux pass, 2026-09-14) -- no change needed here. All states EXCEPT happeningNow.
    happening_now: "inline-flex items-center text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-emerald-600 text-white" # New <bmad-ux pass, 2026-09-14>, round 6. Same shape as `base`, solid emerald fill instead of the neutral muted one -- the one deliberate per-state color exception.
  event_card_nearby_badge:
    # Added <bmad-ux pass, 2026-09-04> -- Story 1.3b AC16. Distinguished from event_card_status_badge by both a
    # solid accent fill (not color alone) and its own icon, satisfying the project's existing non-color-cue
    # convention (EXPERIENCE.md State Patterns > Soft Delete "at least one non-color cue is required", WCAG
    # 1.4.1) -- reuses the exact bg-secondary/text-secondary-foreground pairing EventCard.tsx's standard-variant
    # type badges already use, rather than inventing a new color pairing.
    # REVISED <bmad-ux pass, 2026-09-14>, user-directed, two changes:
    # 1. Threshold changed from distanceKm <= 5 to distanceKm < 8. Distance is computed client-side against the
    #    active filter location if one is selected, else the viewer's current location coordinate (not a new
    #    backend field -- same distanceKm input this token already gated on, just a different frontend
    #    comparison and, now, a different source-of-truth priority for what "distance" means).
    # 2. On the masonry, calendar-row, and calendar-grid-item card families (event_card_masonry.badge_row,
    #    event_card_compact.content, event_card_calendar_grid_item.side_stack/location_row), this badge now
    #    REPLACES the category/type badge in that same slot rather than appearing alongside it -- those cards no
    #    longer show a category/type badge at all. Renders only when distanceKm < 8; omitted entirely otherwise
    #    (no placeholder/disabled state, unchanged from the original AC16 behavior). This is a UI-composition
    #    change scoped to those three card families' badge slot, not a claim that every other consumer of this
    #    token (e.g. any existing standard-variant EventCard usage outside this pass's scope) changes its own
    #    category-badge behavior too.
    base: "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium shrink-0 bg-secondary text-secondary-foreground"
    icon: "w-3 h-3" # lucide-react Navigation icon -- deliberately distinct from the caption's own MapPin (locationName row) so the two location-related glyphs never look identical in an already-dense card; confirm the exact icon name against the installed lucide-react version at implementation time (same caveat already applied to components.calendar.mobile_day_list.multi_day_badge's CalendarRange icon)
  event_card_repeat_badge:
    # Added <bmad-ux pass, 2026-09-16> -- extends the Mobile Multi-Day Calendar Spanning section
    # (IDEA-003) to cover Schedule.applicableDaysOfWeek?: DayOfWeek[] (PRD Section 4.4, BUG-026's
    # 2026-09-11 PRD amendment). Icon-only, no text label and no fill/pill background (unlike
    # event_card_status_badge/event_card_nearby_badge) -- user-directed: "subtle, neutral color so
    # it doesn't fight with the heart icon or distance badges". Marks any occurrence (an isolated
    # single day, or a collapsed multi-day run) that originates from a day-of-week pattern rather
    # than a genuine one-off schedule -- see EXPERIENCE.md Component Patterns > Day-of-Week
    # Recurring Schedules for why position/span alone can no longer convey that distinction once
    # collapsed. Always paired with a hover+focus tooltip (reusing WeeklyCalendarView.tsx's
    # existing non-touch-gated tooltip mechanism) plus an aria-label, both carrying the schedule's
    # actual matching weekdays translated through the project's existing DayOfWeek enum-translation
    # convention (project-context.md Locale-Sensitive Data Rendering) -- never a raw enum string.
    icon: "w-3.5 h-3.5 text-muted-foreground shrink-0" # lucide-react Repeat icon, 14px -- between event_card_nearby_badge's 12px and the favorite icon's 24px; confirm the exact icon name against the installed lucide-react version at implementation time (same caveat already applied to the multi_day_badge CalendarRange icon and event_card_nearby_badge's Navigation icon)
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
