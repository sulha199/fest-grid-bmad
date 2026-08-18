# Story 3-4i: Moderator unprocessed-payload browser and re-processing UI

## Story Details

- Epic: 3 (Social Media Event Integration)
- Story ID: 3-4i
- Key: 3-4i-moderator-unprocessed-payload-browser-and-reprocessing
- Status: ready-for-dev
- Type: UI-only story

## Story

**As a** content moderator,
**I want** a dedicated page in the moderator tools to browse unprocessed payloads captured by Story 3-4h, filter by anomaly source and date, select a parser version, and trigger re-processing,
**So that** I can investigate data quality issues and recover failed extractions without developer intervention.

## Acceptance Criteria

1. **Given** I am logged in as a moderator, **when** I navigate to `/moderator/unprocessed-payloads`, **then** I see a filterable, paginated list of unprocessed payloads fetched via the `queryUnprocessedPayloads` query from Story 3-4h, with all payloads sorted by newest-first by default.

2. **And** filter controls are available at the top of the page for: source (Apify / Bright Data / Gemini), vendor (Instagram, etc.), date range (date picker start/end for createdAfter/createdBefore), and sort order (newest/oldest toggle).

3. **And** each payload item in the list displays as a card or row showing: timestamp (formatted per locale), source/vendor badge, account ID, post URL (as clickable link), one-line validation error summary (truncated if needed), and action buttons.

4. **And** clicking a payload item expands/reveals the raw JSON payload (untruncated, max-height scrollable) and full validation error details in a monospace, read-only display within the same card or a detail panel.

5. **And** each expanded payload has a dropdown allowing selection of a parser version from all available historical versions in `parser_version_registry` (fetched via GraphQL), with the current active version pre-selected by default.

6. **And** a "Reprocess" button on each payload triggers the `reprocessPayload` mutation (Story 3-4h) with the selected parser version, enqueuing the payload asynchronously and displaying a success toast ("Payload re-processing queued — tracking ID: {id}") without blocking the moderator.

7. **And** a "Delete" button on each payload soft-deletes it via the `deleteUnprocessedPayload` mutation (Story 3-4h), displaying a success toast with an "Undo" option following the Soft Delete with Undo pattern (Project Context rule).

8. **And** an empty state message ("No unprocessed payloads found — data quality is good!") is displayed when the query returns zero results or when all payloads have been filtered out.

9. **And** this page is gated by Story 4.7a's `useRequireModerator()` hook — unauthenticated users are redirected to `/login`, and non-moderators are redirected to `/`.

10. **And** all user-facing text (page title, filter labels, button labels, error/empty/loading messages, toast content) is sourced through next-intl for both `en` and `id` locales.

## Architecture & UX Gate Findings

### Gate 1 (Infrastructure & Dependencies)

**Finding:** This story is UI-only; no new AWS infrastructure, Lambda, SQS, or database changes are required beyond Story 3-4h's scope. Story 3-4h provides:
- `unprocessed_scraper_payloads` table (persisted by Story 3-4g's validation failures)
- `parser_version_registry` table (tracks all historical parser versions)
- Three GraphQL operations: `queryUnprocessedPayloads`, `reprocessPayload`, `deleteUnprocessedPayload`
- Daily digest email Lambda (out of scope for this story)
- Retention TTL via `UNPROCESSED_PAYLOAD_RETENTION_DAYS` environment variable (default 30 days)

**Resolution:** No infrastructure gap. All backend contracts this story consumes are built by Story 3-4h (status: `ready-for-dev`). No new `requireModerator`-gated endpoints needed — this story reuses the existing moderator auth guard (Story 4.7a).

### Gate 2 (UI Complexity & Component Reusability)

**Finding:** Assessed component split/reusability against the project-context rule requiring ≥2 consumer evidence before extracting to `packages/ui`.

**Components (page-local, single consumer):**
1. **UnprocessedPayloadListItem:** renders one payload card with timestamp, source/vendor badge, account ID, post URL, and error summary. Single consumer (this page), single-context logic (payload detail expansion). **Decision: inline** within page tree, not extracted.

2. **UnprocessedPayloadDetail:** shows raw JSON and full error details in monospace/read-only display, with parser-version dropdown and Reprocess/Delete buttons. Embedded expansion panel within UnprocessedPayloadListItem. **Decision: inline**.

3. **ParserVersionSelector:** a dropdown UI for selecting from historical parser versions. Reused only here, but a candidate for future `packages/ui` extraction if Story 5.1a (manual post selection) or a future re-processing flow needs version selection. **For this story: inline** with a watch-note for potential future split.

**Filter Controls (simple 2-3 axis filter UI):**
- Source multi-select (Apify/Bright Data/Gemini)
- Vendor text search or multi-select (Instagram, etc.)
- Date range picker (start/end date)
- Sort toggle (newest/oldest)

**Decision:** Build inline with native HTML `<select>` and date `<input type="date">` for simplicity, or use project's existing shadcn primitives (`Select`, `Popover` for date picker) if available. Explicitly **not** `FilterHub.tsx` (that component is sized for the multi-axis events discovery use case with `nuqs` and `MultiSelect`, plus location-radius — too heavy for this moderator tool's simpler, page-local filter state). **No new reusable component extraction** at this pass.

**Route Guard (`useRequireModerator()`):**
Already split off as Story 4.7a; this story consumes it, not reimplements.

**Resolution:** No new reusable component required. All inline, page-local components follow single-consumer precedent from Story 4.6/4.7. Watch-list: ParserVersionSelector is a candidate for future UI package extraction if a second use case emerges.

### Gate 3 (Cross-Cutting Concerns & Architectural Alignment)

**Finding:** Reviewed against project-context's mandatory patterns for routes, state management, loaders, i18n, and accessibility.

**Patterns confirmed:**
- **Loaders:** Initial list load (non-blocking skeleton per project-context rule); mutation actions (blocking `<BlockingLoader />` for `reprocessPayload`/`deleteUnprocessedPayload` per critical-action rule).
- **State Management:** 
  - Server state: React Query + GraphQL (`@tanstack/react-query`, generated hooks from Story 3-4h's operations).
  - URL state: filter state is page-local, not `nuqs` — moderator queues are non-shareable, internal tools, so URL persistence is optional (confirmed acceptable in Story 4.7's precedent).
  - Client global state: None required.
- **i18n:** All user copy through next-intl (en/id); date formatting via `Intl.DateTimeFormat` with active locale; no hardcoded strings.
- **Accessibility:** WCAG 2.1 AA compliance; expanded payload raw JSON in a scrollable container; monospace display for technical content; keyboard navigation for dropdowns and buttons; aria-labels for filter controls and expand/collapse; touch targets ≥44px (mobile).
- **Responsive Design:** Mobile-first approach; list items stack vertically on mobile, adapt to larger screens; filter controls responsive (drawer/dropdown on mobile, horizontal bar on desktop).

**Resolution:** No architectural conflicts. Story aligns with project patterns for moderator pages (Story 4.7 precedent), uses existing auth guard (Story 4.7a), reuses GraphQL operations from Story 3-4h. Soft Delete with Undo pattern (Project Context) applies to the Delete button.

## UI Component Breakdown

### Page Structure

```
/moderator/unprocessed-payloads (Server Component page.tsx)
  └─ <Suspense fallback={<RouteLoader />}>
      └─ UnprocessedPayloadsContent (Client Component)
          ├─ useRequireModerator() hook (Story 4.7a)
          ├─ FilterPanel (page-local)
          │   ├─ SourceMultiSelect
          │   ├─ VendorSelect
          │   ├─ DateRangePickerStart
          │   ├─ DateRangePickerEnd
          │   └─ SortToggle
          ├─ PayloadsList (page-local)
          │   ├─ useQueryUnprocessedPayloadsQuery() (Story 3-4h)
          │   ├─ LoadingSkeleton (non-blocking initial load)
          │   └─ PayloadListItem (repeating, page-local)
          │       ├─ PayloadCardHeader (timestamp, source badge, account ID, URL)
          │       ├─ ExpandToggleButton
          │       ├─ [Expanded] PayloadDetail
          │       │   ├─ RawJsonDisplay (monospace, read-only, scrollable)
          │       │   ├─ ValidationErrorDetails
          │       │   ├─ ParserVersionSelector (dropdown)
          │       │   ├─ ReprocessButton
          │       │   └─ DeleteButton
          │       └─ [Deleting] SoftDeleteWithUndoState
          ├─ EmptyState (when no results)
          ├─ ErrorState (with retry)
          └─ BlockingLoader (during mutations)
```

### Page-Level Components (apps/web/src/app/[locale]/moderator/unprocessed-payloads/)

#### `page.tsx` (Server Component)
- Defines `generateMetadata` via `buildPageMetadata()` (Project Context rule)
- Fetches localized page title/description from `Metadata` i18n namespace
- Wraps content in `<Suspense fallback={<RouteLoader />}>` (Story 0.26, Project Context rule)
- Renders `<UnprocessedPayloadsContent />` client component

#### `unprocessed-payloads-content.tsx` (Client Component)
- Calls `useRequireModerator()` at top; handles loading/unauthenticated/unauthorized states
- Manages filter state (local component state or URL state — TBD at implementation)
- Runs `useQueryUnprocessedPayloadsQuery(filters, cursor?, limit)` query
- Renders FilterPanel, PayloadsList, EmptyState, ErrorState, BlockingLoader as needed

#### Inline Components (within unprocessed-payloads-content.tsx or split into local sub-files per project structure)

**FilterPanel:**
- Horizontal layout on desktop, stacked drawer on mobile
- Controls: SourceMultiSelect (Apify/Bright Data/Gemini), VendorSelect (text/dropdown), DateRangePickerStart, DateRangePickerEnd, SortToggle (Newest/Oldest)
- Apply/Clear buttons
- Disabled state when query is loading

**PayloadsList:**
- Loading: skeleton cards matching payload item layout (non-blocking, per project-context)
- Per item: `<PayloadListItem key={payload.id} payload={payload} onRefetch={...} />`
- Infinite scroll or pagination: TBD (Story 3-4h's `queryUnprocessedPayloads` includes cursor/limit per its AC4; implement pagination UI per project list-navigation rule — likely infinite scroll per Project Context §3.12)

**PayloadListItem (Expandable Card):**
- Header row: timestamp (locale-formatted), source/vendor badge, account ID, post URL link, expand/collapse toggle
- Collapsed: one-line error summary (truncated with ellipsis if >80 chars)
- Expanded (on toggle or click): PayloadDetail section below
- States: normal, expanded, deleting (soft-delete), reprocessing (blocking loader)

**PayloadDetail (Expanded Section):**
- **Raw JSON Display:** `<pre>` with monospace font, scrollable container (max-height: 300px or similar), read-only (no edit capability), syntax highlighting optional (nice-to-have if time permits)
- **Validation Error Details:** error message from `validationError` field, code snippet from AJV error if available
- **ParserVersionSelector:** dropdown populated from `availableParserVersions` query (Story 3-4h AC5), current active version pre-selected (derived from `parserVersion` on the payload)
- **Action Buttons:**
  - "Reprocess" button: calls `useReprocessPayloadMutation()`, shows success toast with tracking ID, updates item state
  - "Delete" button: calls `useDeleteUnprocessedPayloadMutation()`, triggers Soft Delete with Undo pattern (success toast + undo button, auto-dismiss in `undo_duration_ms`)

**EmptyState:**
- Icon + headline + message ("No unprocessed payloads found — data quality is good!")
- Optional secondary action: "View parser versions" link to a future Parser Version Registry page (out of scope for MVP)

**ErrorState:**
- Error message + "Try Again" button (re-runs query)
- Follows Story 4.7/queue-status pattern

## GraphQL Consumer Contracts

### Queries (from Story 3-4h)

#### `queryUnprocessedPayloads`
**Input:**
```graphql
query UnprocessedPayloads(
  $filters: UnprocessedPayloadFilters
  $cursor: String
  $limit: Int
) {
  queryUnprocessedPayloads(filters: $filters, cursor: $cursor, limit: $limit) {
    # See return type below
  }
}

input UnprocessedPayloadFilters {
  source: ScraperSource # enum: APIFY, BRIGHT_DATA, GEMINI
  vendor: String # e.g., "Instagram"
  createdAfter: String # ISO date
  createdBefore: String # ISO date
}
```

**Return Type:**
```graphql
type UnprocessedPayloadConnection {
  edges: [UnprocessedPayloadEdge!]!
  pageInfo: PageInfo! # cursor, hasNextPage, endCursor
}

type UnprocessedPayloadEdge {
  node: UnprocessedScraperPayload!
  cursor: String!
}

type UnprocessedScraperPayload {
  id: ID!
  rawPayload: String! # raw JSON as string (untruncated)
  validationError: ValidationError!
  source: ScraperSource! # enum: APIFY, BRIGHT_DATA, GEMINI
  vendor: String # e.g., "Instagram"
  accountId: String
  postUrl: String
  timestamp: String! # ISO datetime, createdAt
  parserVersion: String! # current parser version at time of capture
  availableParserVersions: [String!]! # all historical versions for re-processing
}

type ValidationError {
  message: String! # AJV error message
  code: String # AJV error code (e.g., "required", "type")
  path: String # JSON path to failed field
}

enum ScraperSource {
  APIFY
  BRIGHT_DATA
  GEMINI
}
```

#### `availableParserVersions` (may be implicit in UnprocessedScraperPayload.availableParserVersions or separate query)
If separate, return `[ParserVersion!]!`:
```graphql
type ParserVersion {
  version: String! # semantic version
  deployedAt: String! # ISO datetime
  isActive: Boolean!
}
```

### Mutations (from Story 3-4h)

#### `reprocessPayload`
**Input:**
```graphql
mutation ReprocessPayload($payloadId: ID!, $parserVersion: String!) {
  reprocessPayload(payloadId: $payloadId, parserVersion: $parserVersion) {
    # See return type
  }
}
```

**Return Type:**
```graphql
type ReprocessResult {
  success: Boolean!
  trackingId: String! # ID of enqueued job in AIProcessingQueue
  message: String # optional status message
}
```

#### `deleteUnprocessedPayload`
**Input:**
```graphql
mutation DeleteUnprocessedPayload($payloadId: ID!) {
  deleteUnprocessedPayload(payloadId: $payloadId) {
    # See return type
  }
}
```

**Return Type:**
```graphql
type DeleteUnprocessedPayloadResult {
  success: Boolean!
  payloadId: ID!
  message: String # optional confirmation message
}
```

## Frontend Implementation Tasks

### Task 1: Route Setup & Page Shell (AC1, AC9, AC10)

- [ ] Create `apps/web/src/app/[locale]/moderator/unprocessed-payloads/page.tsx` (Server Component)
  - [ ] Define `generateMetadata()` using `buildPageMetadata()` helper (reference: Story 1.9, `apps/web/src/lib/metadata.ts`)
  - [ ] Fetch localized title/description from next-intl `getTranslations({ namespace: "Metadata" })` with keys `unprocessedPayloadsTitle`, `unprocessedPayloadsDescription`
  - [ ] Wrap content in `<Suspense fallback={<RouteLoader />}>` (Story 0.26, Project Context rule)
  - [ ] Render `<UnprocessedPayloadsContent />` client component
  - [ ] Note: use existing `/moderator/items` directory structure as precedent; confirm route guard is delegated to Story 4.7a, not local

### Task 2: GraphQL Operations & Codegen (AC1, AC2, AC5, AC6, AC7)

- [ ] Create `apps/web/src/features/moderation/unprocessed-payloads.graphql` (new file, following one-file-per-resource convention)
  - [ ] Define `query UnprocessedPayloads(...)` with filter/cursor/limit inputs and full return type (spec'd in "GraphQL Consumer Contracts" above)
  - [ ] Define `mutation ReprocessPayload(...)` and `mutation DeleteUnprocessedPayload(...)` with their return types
  - [ ] Optional: `query AvailableParserVersions()` if Story 3-4h separates this into a distinct query
  - [ ] Confirm operations match Story 3-4h's exact GraphQL schema (cross-check against `apps/backend/src/schema/unprocessed-payloads.graphql` or similar once Story 3-4h ships)
- [ ] Run `pnpm run codegen` (both backend and frontend sides)
  - [ ] Verify generated hooks: `useUnprocessedPayloadsQuery`, `useReprocessPayloadMutation`, `useDeleteUnprocessedPayloadMutation`, `useAvailableParserVersionsQuery` (if applicable)
  - [ ] Commit generated types in `apps/web/src/generated/graphql.ts`

### Task 3: Client Component & State Management (AC1, AC2, AC3, AC4, AC5)

- [ ] Create `apps/web/src/app/[locale]/moderator/unprocessed-payloads/unprocessed-payloads-content.tsx` (Client Component)
  - [ ] Import `useRequireModerator()` from Story 4.7a
  - [ ] At component top: call `useRequireModerator()` and handle states (loading → `<RouteLoader />`, unauthenticated → redirect handled by hook, unauthorized → redirect handled by hook)
  - [ ] Once `authorized`, set up local filter state:
    - [ ] Source multi-select (Apify, Bright Data, Gemini) — use native `<select multiple>` or shadcn `Select` primitive if available
    - [ ] Vendor text input or select (e.g., "Instagram") — determine from Story 3-4h's expected vendor enum/values
    - [ ] Date range: two `<input type="date">` fields (start/end)
    - [ ] Sort order: toggle or select (Newest/Oldest)
  - [ ] Instantiate `useUnprocessedPayloadsQuery(filters, cursor?, limit?)` with filter values as dependencies
  - [ ] Render page structure:
    - [ ] FilterPanel with controls, Apply/Clear buttons
    - [ ] PayloadsList (loading skeleton, list items, pagination, empty state)
    - [ ] ErrorState with retry
    - [ ] BlockingLoader during mutations
  - [ ] Infinite scroll setup: if using cursor-based pagination, implement scroll-to-load-more (reference: Discovery page)

### Task 4: Filter Panel Component (AC2)

- [ ] Within `unprocessed-payloads-content.tsx` or extracted to `filter-panel.tsx` (page-local):
  - [ ] SourceMultiSelect: render checkboxes or multi-select dropdown for APIFY, BRIGHT_DATA, GEMINI
  - [ ] VendorSelect: simple text input or dropdown (values TBD by Story 3-4h — confirm if enum or free-text)
  - [ ] DateRangePickerStart: `<input type="date">` with label, accessible to keyboard
  - [ ] DateRangePickerEnd: `<input type="date">` with label, accessible to keyboard
  - [ ] SortToggle: button group or select (Newest/Oldest), default Newest
  - [ ] Apply button: updates `useUnprocessedPayloadsQuery` with new filters
  - [ ] Clear button: resets all filters to defaults
  - [ ] Disable all controls while query is loading

### Task 5: Payload List Items (AC3, AC4, AC6, AC7)

- [ ] Create `payload-list-item.tsx` component (page-local or inline, single consumer):
  - [ ] **Header (always visible):**
    - [ ] Timestamp (formatted via `Intl.DateTimeFormat` with active locale from Project Context rule)
    - [ ] Source/Vendor badge (e.g., "Apify · Instagram") — styled with color per source (reference: Story 0.26/4.7's badge pattern)
    - [ ] Account ID (truncated if long, full on hover/expand)
    - [ ] Post URL as clickable link (opens in new tab, no-referrer policy)
    - [ ] Expand/Collapse toggle button (aria-label: "Show details" / "Hide details")
    - [ ] Error summary (one line, truncated, gray text) — e.g., "Missing required field: eventName"
  - [ ] **Action buttons (always visible, header row or row below):**
    - [ ] Delete button (trash icon + label) — calls `useDeleteUnprocessedPayloadMutation`
    - [ ] Reprocess button (appears only when expanded; see Task 6)
  - [ ] **Expanded section (on toggle):**
    - [ ] Raw JSON display (monospace, scrollable, see Task 6)
    - [ ] Full error details (see Task 6)
    - [ ] Parser version selector (see Task 6)
    - [ ] Reprocess button (see Task 6)
  - [ ] **States:**
    - [ ] Normal (default)
    - [ ] Expanded (show details section)
    - [ ] Reprocessing (disable buttons, show spinner overlay on card)
    - [ ] Deleting (optimistic greyed-out state per Soft Delete with Undo pattern)
  - [ ] Touch target sizes: buttons ≥44px (mobile-friendly per Project Context)

### Task 6: Payload Detail Panel (AC4, AC5, AC6)

- [ ] Within or as child of `payload-list-item.tsx`:
  - [ ] **Raw JSON Display:**
    - [ ] `<pre>` element with monospace font (Tailwind `font-mono`)
    - [ ] Max-height constraint (e.g., `max-h-80` in Tailwind) with `overflow-y-auto` for scrolling
    - [ ] Background color per Project Context (slightly muted, e.g., `bg-muted` in shadcn)
    - [ ] Padding for readability (e.g., `p-4`)
    - [ ] Border around the container (e.g., `border border-gray-300`)
    - [ ] Text selection enabled (user can copy raw JSON)
    - [ ] Syntax highlighting optional (e.g., `react-json-tree` or similar; low priority for MVP)
  - [ ] **Validation Error Details:**
    - [ ] Heading: "Validation Error"
    - [ ] Error message from payload's `validationError.message`
    - [ ] Error code (if available) and JSON path to failed field (if available)
    - [ ] Formatted as readable text, not raw JSON
  - [ ] **Parser Version Selector:**
    - [ ] Label: "Re-process with parser version"
    - [ ] Dropdown/select populated from `payload.availableParserVersions` (array of version strings)
    - [ ] Default selection: the version in `payload.parserVersion` (current/original)
    - [ ] Accessible: keyboard navigation, aria-label
  - [ ] **Reprocess Button:**
    - [ ] Text: "Reprocess" or "Re-process with this version"
    - [ ] Action: calls `useReprocessPayloadMutation({ payloadId: payload.id, parserVersion: selectedVersion })`
    - [ ] On loading: button disabled, spinner indicator
    - [ ] On success: toast notification ("Payload re-processing queued — tracking ID: {trackingId}"), parser version dropdown reverts to original, button reverts to enabled
    - [ ] On error: error toast ("Failed to queue re-processing — {errorMessage}"), button remains enabled for retry
  - [ ] **Delete Button (Secondary):**
    - [ ] Text: "Delete" or "Remove"
    - [ ] Action: calls `useDeleteUnprocessedPayloadMutation({ payloadId: payload.id })`
    - [ ] Triggers Soft Delete with Undo pattern (Project Context rule)

### Task 7: Empty & Error States (AC8)

- [ ] **EmptyState component (page-local):**
  - [ ] Render when `useUnprocessedPayloadsQuery` returns zero results and no loading state
  - [ ] Content:
    - [ ] Icon: `<CheckCircle />` or similar (shadcn icon)
    - [ ] Headline: "No unprocessed payloads" (i18n key: `unprocessedPayloadsEmptyHeadline`)
    - [ ] Message: "Data quality is good! All scraped payloads passed validation." (i18n key: `unprocessedPayloadsEmptyMessage`)
    - [ ] Optional secondary action: link to "Parser Version Registry" (future feature, out of scope for MVP)
- [ ] **ErrorState component (page-local):**
  - [ ] Render when `useUnprocessedPayloadsQuery` has error
  - [ ] Content:
    - [ ] Icon: `<AlertTriangle />` or similar
    - [ ] Headline: "Couldn't load payloads" (i18n key: `unprocessedPayloadsErrorHeadline`)
    - [ ] Error message (from query error, sanitized for user consumption)
    - [ ] "Try Again" button: calls `refetch()` on the query
  - [ ] Reference: Story 4.7/queue-status pattern

### Task 8: Loading State & Skeleton (AC1)

- [ ] Create skeleton cards matching payload-list-item layout (non-blocking per Project Context):
  - [ ] 3–5 skeleton cards during initial load
  - [ ] Each skeleton shows placeholder bars for: timestamp, source badge, account ID, URL, error summary (gray placeholder bars)
  - [ ] Use shadcn's `Skeleton` component or `animate-pulse` if available
  - [ ] Reference: EventCard skeleton pattern

### Task 9: Mutation Handling & Optimistic UI (AC6, AC7)

- [ ] **Reprocess Mutation:**
  - [ ] Call: `useReprocessPayloadMutation.mutate({ payloadId, parserVersion })`
  - [ ] Optimistic update: disable button, show spinner, update parser version selector state
  - [ ] On success: show success toast with tracking ID (from `ReprocessResult.trackingId`)
  - [ ] On error: show error toast, revert optimistic state, keep button enabled
  - [ ] Refetch: on success, refetch `useUnprocessedPayloadsQuery` (optional — success toast alone may be sufficient if tracking ID is displayed)
- [ ] **Delete Mutation:**
  - [ ] Call: `useDeleteUnprocessedPayloadMutation.mutate({ payloadId })`
  - [ ] Optimistic update: apply Soft Delete with Undo pattern
    - [ ] Immediately: item switches to greyed-out/struck-through appearance (use `line-through` and `opacity-60` for non-color cue)
    - [ ] Toast: "Payload deleted" with "Undo" button, auto-dismisses after `notification.undo_duration_ms` (6 seconds)
    - [ ] Undo: calls `useSoftDeleteWithUndo`'s restore callback (re-instate mutation or restore from cache)
  - [ ] On success: item remains visually pending until toast dismisses, then removed from list
  - [ ] On error: item reverts to normal appearance, error toast shown

### Task 10: i18n Implementation (AC10)

- [ ] Add new i18n namespaces to `apps/web/locales/en.json` and `apps/web/locales/id.json`:
  - [ ] **Metadata namespace:**
    - [ ] `unprocessedPayloadsTitle: "Unprocessed Payloads | FestDaily Moderator Tools"`
    - [ ] `unprocessedPayloadsDescription: "Browse and re-process unprocessed payloads from scraper vendors"`
  - [ ] **UnprocessedPayloadsPage namespace (new):**
    - [ ] `pageHeading: "Unprocessed Payloads"`
    - [ ] `pageDescription: "Review data quality issues from scrapers and re-process failed extractions"`
    - [ ] **Filter labels:**
      - [ ] `filterSourceLabel: "Source"`
      - [ ] `filterVendorLabel: "Vendor"`
      - [ ] `filterDateStartLabel: "From (Date)"`
      - [ ] `filterDateEndLabel: "To (Date)"`
      - [ ] `filterSortLabel: "Sort by"`
      - [ ] `filterSortNewest: "Newest first"`
      - [ ] `filterSortOldest: "Oldest first"`
      - [ ] `filterApplyButton: "Apply filters"`
      - [ ] `filterClearButton: "Clear all"`
    - [ ] **Source/Vendor labels:**
      - [ ] `sourceApify: "Apify"`
      - [ ] `sourceBrightData: "Bright Data"`
      - [ ] `sourceGemini: "Gemini"`
    - [ ] **Payload list:**
      - [ ] `payloadTimestamp: "Captured"`
      - [ ] `payloadSource: "Source"`
      - [ ] `payloadVendor: "Vendor"`
      - [ ] `payloadAccountId: "Account ID"`
      - [ ] `payloadPostUrl: "Post URL"`
      - [ ] `payloadErrorSummary: "Error"`
      - [ ] `expandButtonLabel: "Show details"`
      - [ ] `collapseButtonLabel: "Hide details"`
    - [ ] **Payload detail (expanded):**
      - [ ] `detailsHeading: "Details"`
      - [ ] `rawJsonLabel: "Raw Payload (JSON)"`
      - [ ] `validationErrorLabel: "Validation Error"`
      - [ ] `parserVersionLabel: "Re-process with parser version"`
      - [ ] `currentVersionBadge: "(current)"`
    - [ ] **Buttons:**
      - [ ] `reprocessButton: "Re-process"`
      - [ ] `reprocessingLabel: "Re-processing..."`
      - [ ] `deleteButton: "Delete"`
      - [ ] `deletingLabel: "Deleting..."`
    - [ ] **Toast messages:**
      - [ ] `reprocessSuccessToast: "Payload re-processing queued — tracking ID: {trackingId}"`
      - [ ] `reprocessErrorToast: "Failed to queue re-processing — {message}"`
      - [ ] `deleteSuccessToast: "Payload deleted"`
      - [ ] `deleteUndoButton: "Undo"`
      - [ ] `deleteErrorToast: "Failed to delete payload — try again"`
    - [ ] **Empty & Error states:**
      - [ ] `emptyHeadline: "No unprocessed payloads"`
      - [ ] `emptyMessage: "Data quality is good! All scraped payloads passed validation."`
      - [ ] `errorHeadline: "Couldn't load payloads"`
      - [ ] `errorTryAgain: "Try again"`
      - [ ] `loadingLabel: "Loading payloads..."`

### Task 11: Responsive Design & Mobile Optimization (AC1-9)

- [ ] **Mobile (< 768px):**
  - [ ] Filter controls stack vertically, collapse into a drawer/popover (tap "Filters" button to reveal)
  - [ ] Payload list items: simplified header (timestamp, source badge, account ID — URL links to new tab), error summary below, expand/collapse on tap
  - [ ] Expanded detail: raw JSON max-height 300px with scrolling, parser version dropdown full-width
  - [ ] Buttons: full-width or side-by-side (depending on space)
  - [ ] Padding/spacing: tighter margins to fit screen (use Tailwind `p-2`/`p-3` on mobile, `p-4`/`p-6` on desktop)
- [ ] **Desktop (≥ 768px):**
  - [ ] Filter bar horizontal, all controls visible (or in a compact row)
  - [ ] Payload list items: cleaner card layout or table row format (TBD per designer input)
  - [ ] Expanded detail: side panel or full-width detail below the card
  - [ ] Generous spacing and touch targets
- [ ] **Touch targets:** all buttons ≥44px (height × width) per WCAG 2.1 AA and Project Context rule
- [ ] **Overflow handling:**
  - [ ] Long URLs: truncate with ellipsis, full URL on hover or in a tooltip
  - [ ] Long error messages: truncate on list, full message in detail panel
  - [ ] Raw JSON: scrollable container, not wrapping off-screen
- [ ] **Test on mobile devices/emulation** during implementation

### Task 12: Accessibility (AC1-10)

- [ ] **Keyboard navigation:**
  - [ ] All interactive elements (filter controls, buttons, dropdowns) tab-reachable in logical order
  - [ ] Filter Apply/Clear buttons keyboard-activatable (Enter or Space)
  - [ ] Expand/collapse button on each payload item keyboard-activatable (Enter or Space)
  - [ ] Dropdowns: arrow keys to navigate options, Enter to select
  - [ ] Links (post URLs) keyboard-navigable, opens in new tab without blocking flow
- [ ] **ARIA Labels & Roles:**
  - [ ] Page heading: `<h1>` with "Unprocessed Payloads"
  - [ ] Filter section: `<fieldset aria-label="Filter payloads">`
  - [ ] Each filter control: `<label htmlFor="...">` with descriptive text
  - [ ] Expand/collapse button: `aria-expanded={isExpanded}`, `aria-label="Show details" / "Hide details"`
  - [ ] Parser version dropdown: `<label htmlFor="...">` + `<select>` (aria-label if label is unclear)
  - [ ] Reprocess/Delete buttons: aria-label describing the action for the specific payload ("Re-process payload {id}" / "Delete payload {id}")
  - [ ] Toast notifications: live region with `role="status"` (success) or `role="alert"` (error)
- [ ] **Color & Contrast:**
  - [ ] Source badges: adequate contrast against background (WCAG 1.4.3, 4.5:1 for text)
  - [ ] Greyed-out/struck-through delete state: non-color cue (opacity + strike-through per Project Context)
  - [ ] Error message text: sufficient contrast against background
- [ ] **Semantic HTML:**
  - [ ] Use native `<button>` for interactive controls, not `<div>` with click handlers
  - [ ] Use `<a>` for post URLs (not `<button>` with `onClick`)
  - [ ] Use `<input type="date">` for date pickers (native, accessible)
  - [ ] Use `<select>` or accessible dropdown primitive for multi-select (avoid custom implementations if shadcn primitives exist)
- [ ] **Focus visible:** all interactive elements have a visible focus ring (`:focus-visible`, distinct color per Project Context)
- [ ] **Motion:** if any animations (e.g., skeleton fade-in, expand/collapse), respect `prefers-reduced-motion` (instant show/hide fallback)

### Task 13: Testing (AC1-10)

- [ ] **Unit Tests (Vitest):**
  - [ ] FilterPanel: filter state updates correctly on input change, Apply/Clear button actions
  - [ ] PayloadListItem: expand/collapse toggle works, renders correct content in expanded state
  - [ ] ParserVersionSelector: selection state updates correctly, default version is pre-selected

- [ ] **Integration Tests (Vitest + MSW):**
  - [ ] `useUnprocessedPayloadsQuery`: mocks Story 3-4h's GraphQL query, renders list items correctly
  - [ ] Filter application: applying filters updates query with correct input, results update on screen
  - [ ] Empty state: renders when query returns zero results
  - [ ] Error state: renders when query fails, retry button works
  - [ ] `useReprocessPayloadMutation`: mutation called with correct payload ID and parser version, success toast shown with tracking ID, error toast on failure
  - [ ] `useDeleteUnprocessedPayloadMutation`: mutation called with correct payload ID, Soft Delete with Undo pattern triggered, success toast shown, undo action reverts state
  - [ ] Route guard delegation: `useRequireModerator()` hook is called, unauthenticated/unauthorized states handled (component doesn't render, hook redirects)
  - [ ] i18n: all text strings sourced through next-intl, date formatting via `Intl.DateTimeFormat` with active locale, no hardcoded strings

- [ ] **E2E Tests (Playwright):**
  - [ ] A moderator navigates to `/moderator/unprocessed-payloads`, sees list of payloads (or empty state)
  - [ ] Filter by source (Apify), apply, list updates to show only Apify payloads
  - [ ] Click expand on a payload, raw JSON and details display, parser version dropdown visible
  - [ ] Select a different parser version, click Reprocess, success toast shows with tracking ID
  - [ ] Click Delete on a payload, Soft Delete with Undo pattern triggered (greyed-out item, toast with Undo button)
  - [ ] Click Undo, item restores to normal state
  - [ ] Wait for Undo toast to dismiss timeout, item is removed from list
  - [ ] A non-moderator (or unauthenticated user) navigates to `/moderator/unprocessed-payloads`, is redirected to `/` or `/login` (as per Story 4.7a)
  - [ ] Full `pnpm build` / `pnpm lint` / `pnpm run codegen` clean

## Re-Processing Workflow Details

### Workflow Steps

1. **Moderator opens page:** navigates to `/moderator/unprocessed-payloads`
   - Page fetches list via `useUnprocessedPayloadsQuery(filters)` with default filters
   - Skeleton loading state shown while query resolves
   - List renders with payloads sorted newest-first

2. **Moderator investigates a payload:** clicks expand on a payload card
   - Raw JSON displays in read-only monospace display
   - Validation error details show (message, code, JSON path)
   - Parser version dropdown pre-populated with available versions
   - Current parser version pre-selected

3. **Moderator selects a parser version:** chooses from dropdown (e.g., "0.2.1" to retry with an earlier version)
   - Selection state updates in component

4. **Moderator triggers re-processing:** clicks "Reprocess" button
   - Button disabled, spinner shown ("Re-processing...")
   - `useReprocessPayloadMutation` called with `{ payloadId, parserVersion }`
   - **Backend (Story 3-4h):** mutation enqueues payload to `AIProcessingQueue` with selected parser version, returns `ReprocessResult` with `trackingId`
   - **Frontend:** on success, success toast displays ("Payload re-processing queued — tracking ID: {trackingId}")
   - Toast auto-dismisses after ~5 seconds
   - Payload card remains visible and expanded (no removal on reprocess)
   - Button re-enables, ready for another action
   - **On error:** error toast displays ("Failed to queue re-processing — {errorMessage}"), button remains enabled for retry

5. **Moderator deletes a payload:** clicks "Delete" button
   - Soft Delete with Undo pattern triggered:
     - Item immediately switches to greyed-out + struck-through appearance (optimistic)
     - Toast notification appears ("Payload deleted") with "Undo" button
     - Toast auto-dismisses after `notification.undo_duration_ms` (6 seconds)
   - **Backend (Story 3-4h):** `deleteUnprocessedPayload` mutation soft-deletes the payload (sets `deletedAt`)
   - **On success:** toast dismisses after timeout, item is filtered out of list (if visible at all)
   - **On error (and Undo click):** `useDeleteUnprocessedPayloadMutation` error handling reverts optimistic state, item returns to normal appearance, error toast shows ("Failed to delete — try again"), payload remains in list

6. **Moderator checks re-processing status:** *Future capability (not in MVP scope)*
   - A future status-check page or queue page (Story 3-9a? TBD) would display the status of re-processing jobs by tracking ID
   - For this story: success toast with tracking ID is the feedback loop; moderator can manually check the AIProcessingQueue or audit logs if needed post-MVP

### Status Tracking

- **During re-processing:** moderator sees only the success toast with tracking ID; no live update on the payload card itself
- **After re-processing:** if the payload successfully extracts an event, it appears in the main event discovery page; if it fails again, a new unprocessed payload row may be created by Story 3-4h's validation layer (Story 3-4g), and moderator can refetch the page to see it
- **Deletion:** once soft-deleted, the payload is excluded from future queries (deletedAt IS NULL filter applied by Story 3-4h's query)

## Filter UI Patterns

### Source Filter (Multi-Select)
- **Type:** checkboxes or multi-select dropdown
- **Options:** APIFY, BRIGHT_DATA, GEMINI (as enum values from Story 3-4h)
- **Behavior:** clicking an option toggles it; Apply button updates query filter
- **Display:** selected options shown as tags or count ("3 selected") until Apply is clicked

### Vendor Filter (Free-Text or Select)
- **Type:** text input (free-text) or dropdown select (if Story 3-4h defines enum)
- **Placeholder:** "e.g., Instagram"
- **Behavior:** typing updates state; Apply button updates query filter with `vendor` parameter
- **Display:** input shows entered text

### Date Range Filter
- **Type:** two `<input type="date">` fields (createdAfter / createdBefore)
- **Behavior:** user picks dates; Apply button updates query with ISO date strings
- **Display:** date pickers show selected dates or empty if not set
- **Validation:** no client-side validation (backend handles invalid ranges gracefully), but optionally warn if start > end

### Sort Filter
- **Type:** toggle or radio buttons (Newest / Oldest)
- **Default:** Newest first
- **Behavior:** clicking toggle updates state; Apply button updates query sort parameter
- **Display:** active sort shown as selected/highlighted

### Apply & Clear Buttons
- **Apply:** fetches `useUnprocessedPayloadsQuery` with updated filters (resets cursor to null, starts from page 1)
- **Clear:** resets all filter controls to defaults (no source, no vendor, no date range, newest sort), immediately triggers Apply

## Empty States and Error States

### Empty State (No Payloads)
- **When:** `queryUnprocessedPayloads` returns empty edges array and query is not loading
- **Icon:** `<CheckCircle />` (success/positive, indicating good data quality)
- **Headline:** "No unprocessed payloads"
- **Message:** "Data quality is good! All scraped payloads passed validation."
- **Optional action:** "View parser versions" link (future feature)

### Empty State (Filtered Results)
- **When:** filter applied, results empty
- **Same as above, or:** "No payloads match your filters — try adjusting dates or sources."

### Error State (Query Failed)
- **When:** `queryUnprocessedPayloads` has error
- **Icon:** `<AlertTriangle />` (error/warning)
- **Headline:** "Couldn't load payloads"
- **Message:** (error message from query, sanitized)
- **Action:** "Try again" button (calls refetch on query)

### Error State (Mutation Failed)
- **Toast notification** (not full-page error):
  - Reprocess failure: "Failed to queue re-processing — {errorMessage}"
  - Delete failure: "Failed to delete payload — try again"
  - Duration: 8 seconds (longer than undo toast, per Project Context)
  - Close control: always visible

## Testing Requirements

### UI Component Tests (Vitest)
- [ ] FilterPanel: state management, Apply/Clear behavior
- [ ] PayloadListItem: expand/collapse toggle, rendering expanded content
- [ ] ParserVersionSelector: dropdown interaction, selection state
- [ ] EmptyState: renders with correct text
- [ ] ErrorState: renders with correct error message, retry button

### Integration Tests (Vitest + MSW)
- [ ] Full workflow: load query, apply filters, expand payload, select version, reprocess, see success toast
- [ ] Delete workflow: delete payload, see Soft Delete with Undo state, undo restores, final dismiss removes from list
- [ ] Route guard: useRequireModerator() hook called, unauthorized states handled
- [ ] i18n: all strings translated, dates formatted per locale
- [ ] Mutations: reprocessPayload and deleteUnprocessedPayload called with correct args, results handled correctly

### E2E Tests (Playwright)
- [ ] End-to-end moderator workflow: navigate to page, apply filter, expand payload, reprocess, see success toast
- [ ] Delete with undo: delete payload, click undo, payload restores; wait for toast timeout, payload removed
- [ ] Non-moderator blocked: navigate to page as non-moderator, redirected away
- [ ] Locale switching: toggle locale to `id`, verify all strings translated
- [ ] Mobile: test on mobile viewport, filter drawer, expanded payload readability

## Internationalization (i18n) Requirements

**Locales:** `en`, `id`

**Namespaces created/modified:**
1. **Metadata** (modified):
   - Add `unprocessedPayloadsTitle`, `unprocessedPayloadsDescription`
2. **UnprocessedPayloadsPage** (new):
   - All page-specific strings (see Task 10 for full key list)

**i18n Rules (Project Context):**
- All user-facing text sourced through next-intl `useTranslations()` or server-side `getTranslations()` (for metadata)
- Dates formatted via `Intl.DateTimeFormat` with active locale (never raw ISO strings)
- Enum values (source, vendor) resolved through translations if displayed (e.g., `t("sourceApify")`)
- No hardcoded strings in component code
- Namespace keys follow camelCase convention

## Accessibility Requirements

**WCAG 2.1 AA Compliance:**

1. **Keyboard Navigation:**
   - All interactive elements tab-reachable in logical order
   - Dropdowns: arrow keys to navigate, Enter to select
   - Buttons: Enter or Space to activate
   - Focus visible on all focusable elements

2. **Screen Reader Support:**
   - Semantic HTML (`<button>`, `<label>`, `<a>`, `<input>`)
   - ARIA labels on controls without visible text
   - Live region for toast notifications (`role="status"` / `role="alert"`)
   - Page heading: `<h1>`

3. **Color & Contrast:**
   - Text contrast ≥ 4.5:1 (normal text) per WCAG 1.4.3
   - Non-color cues: delete state uses strike-through + opacity, not color alone (WCAG 1.4.1)
   - Error messages, badge colors meet contrast standards

4. **Touch & Mobile:**
   - Touch targets ≥ 44px (height × width) per WCAG 2.1 AA
   - Sufficient spacing between interactive elements to avoid accidental activation

5. **Focus Management:**
   - Page title in `generateMetadata` for browser tab
   - Focus not trapped; focus naturally flows through page
   - Toast notifications do not steal focus (non-modal, per Project Context)

6. **Motion & Animation:**
   - Animations respect `prefers-reduced-motion` (instant show/hide fallback)
   - No flashing content ≥3 Hz (WCAG 2.3.3)

## Mobile Responsiveness Requirements

**Breakpoints (Tailwind defaults):**
- Mobile: `< 768px`
- Tablet/Desktop: `≥ 768px`
- Large Desktop: `≥ 1280px`

**Mobile-Specific Design:**
- Filter controls in a collapsible drawer (tap "Filters" button)
- Payload cards stack vertically, full-width
- Expanded detail: raw JSON max-height 300px, scrollable
- Buttons: full-width or stacked vertically
- Touch targets: ≥ 44px for all buttons
- Font sizes: readable at small viewport (Tailwind base 16px, no smaller than 14px)
- Padding: `p-2` to `p-4` to fit screen

**Desktop-Specific Design:**
- Filter bar horizontal, all controls visible
- Payload cards in a card grid or table format
- Expanded detail: side panel or below card
- Buttons: side-by-side if space allows
- More generous spacing and typography

**Responsive Images & URLs:**
- Post URLs: truncated with ellipsis on mobile, full on desktop/hover

## Completion Status & Approval Gate

### Definition of Done
- [ ] All 13 implementation tasks completed and code committed
- [ ] All acceptance criteria (1–10) satisfied and verified
- [ ] All unit, integration, and E2E tests passing
- [ ] Full `pnpm build` / `pnpm lint` / `pnpm run codegen` clean
- [ ] Code reviewed and approved
- [ ] Story marked `done` in sprint-status.yaml

### Acceptance Sign-Off (by Product/Design)
- [ ] Moderator can filter payloads by source, vendor, date range
- [ ] Moderator can view raw JSON and full error details for investigation
- [ ] Moderator can select a historical parser version and trigger re-processing asynchronously
- [ ] Soft Delete with Undo pattern works as expected
- [ ] Page is mobile-responsive and accessible
- [ ] All text is translated to `en` and `id`

## References & Dependencies

### Required Stories (Prerequisites)
- **Story 3-4h:** Backend mutations/queries (`queryUnprocessedPayloads`, `reprocessPayload`, `deleteUnprocessedPayload`), `unprocessed_scraper_payloads` table, `parser_version_registry` table
- **Story 4.7a:** Moderator route guard (`useRequireModerator()` hook)
- **Story 0.26:** RouteLoader component for Suspense fallback

### Related Stories (Patterns/Precedent)
- **Story 4.7:** Moderator items page (reported events); precedent for moderator page structure, GraphQL queries/mutations, i18n, Soft Delete with Undo, empty/error states
- **Story 4.6:** Reports page; precedent for user-facing page structure and error handling
- **Story 1.9:** Dynamic browser title and meta tags; precedent for `generateMetadata` and i18n sourcing
- **Story 0.7:** Global navigation; precedent for app-shell integration
- **Story 2.8:** User menu; precedent for menu structure (moderator items visible only when `role === MODERATOR`)

### Project Rules (Must Follow)
- **`_bmad-output/project-context.md`:**
  - UI Patterns & UX Invariants (Blocking-loader rule, Soft Delete with Undo, Route-level Suspense fallback, Locale-Sensitive Data Rendering, Component Design for i18n)
  - State Management Architecture (Server State via React Query + GraphQL, optional URL State via nuqs, Client Global State via Zustand if needed)
  - Code Quality & Style Rules (TypeScript strict mode, Path aliases, Core Primitives in `packages/ui`, Domain logic in `packages/domain`)
  - Testing Rules (Unit tests in `packages/domain` only, integration/E2E for app code)
  - Development Workflow Rules (Pull request checklist, complex logic in `packages/domain`)

- **`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`:**
  - AD-2 (Unified Query DSL): `queryUnprocessedPayloads` is a moderator-domain query, not a second events-collection endpoint
  - AD-5 (Analytics taxonomy): future analytics events should follow `noun_verb` naming convention
  - AD-6 (i18n strategy): all user-facing copy through next-intl, with locale-aware date/number formatting
  - AD-7 (Auth & Access): new queries/mutations are `requireModerator`-gated (built into Story 3-4h, consumed here)
  - AD-8 (Soft-Delete convention): used for delete action per defined pattern (already in codebase)

### File Paths & Project Structure
- **Page route:** `apps/web/src/app/[locale]/moderator/unprocessed-payloads/page.tsx`
- **Client component:** `apps/web/src/app/[locale]/moderator/unprocessed-payloads/unprocessed-payloads-content.tsx`
- **GraphQL operations:** `apps/web/src/features/moderation/unprocessed-payloads.graphql`
- **Generated types:** `apps/web/src/generated/graphql.ts` (regenerated after codegen)
- **i18n namespaces:** `apps/web/locales/en.json`, `apps/web/locales/id.json`
- **Shared UI components:** `packages/ui/src/core/` (BlockingLoader, RouteLoader, etc., already exist)

### Design & UX References
- **DESIGN.md:** color palette (primary, accent, neutral, nav_active_indicator), typography (Inter, 16px base), card components, button styles, modal overlay, notification toast patterns
- **EXPERIENCE.md:** Soft Delete with Undo state pattern, notification toast timing/accessibility, mobile/desktop responsive breakpoints, global navigation patterns, moderator items page visibility rule (`role === MODERATOR`), accessibility floor for toasts (live region, focus, tab order)

### Backend Contracts (Story 3-4h, Status: ready-for-dev)
All queries and mutations this story consumes are built by Story 3-4h:
- `queryUnprocessedPayloads(filters, cursor, limit)` → returns paginated list of unprocessed payloads
- `reprocessPayload(payloadId, parserVersion)` → enqueues payload to AIProcessingQueue, returns tracking ID
- `deleteUnprocessedPayload(payloadId)` → soft-deletes payload (sets deletedAt)
- All three are `requireModerator`-gated

---

_Last Updated: 2026-08-18T00:00:00Z_
_Story Status: backlog (ready for dev after Story 3-4h ships)_
