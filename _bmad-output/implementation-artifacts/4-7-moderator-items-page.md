# Story 4.7: Moderator Items page

## Story Details

- Epic: 4
- Story ID: 4.7
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a moderator,
I want a dedicated page where I can see all reported events and take action on them, plus review pending "Default Location" changes,
so that I can effectively moderate content quality on the platform (PRD §3.9.3, §3.7/§4.14).

## Acceptance Criteria

1. **Given** I am logged in as a moderator, **when** I navigate to the "Moderator Items" page (`/moderator/items`) from the user menu, **then** I see a list of all reported events that require my attention, fetched via the moderator-only `reportedEvents` query (Story 4.3a) — not directly from the database — and **grouped by event**: each event with at least one `pending` report renders as one row/card, listing every report filed against it (reason, details, reporting user, status).
2. **And** for each reported event group I can see the reason(s) for the report(s) and any additional details for each.
3. **And** I take exactly one moderator action per event, which resolves every currently-`pending` report on that event at once, rather than resolving reports individually:
   - **"Mark Safe" / "Restore"** (button label conditional on whether `event.deletedAt` is set) calls a new `resolveReportsForEvent(eventId: ID!): [Report!]!` mutation (guarded by `requireModerator`) which, in one transaction: clears `events.deletedAt` if the event is currently soft-deleted, and sets every `pending` report on that event to `status: dismissed` with `resolvedByModeratorId`/`resolvedAt` stamped.
   - **"Delete Permanently"** calls Story 4.4a's existing `deleteEventPermanently(id)` mutation as-is — its FK cascade (`reports.eventId → onDelete: cascade`) already removes all of that event's report rows in the same operation, so no separate report-resolution call is made or needed.
4. **And**, independent of the event-level action, for each *dangerous*-reason report I can additionally choose **"Ignore future reports from this user"** for that specific reporter (Story 4.3a's `ignoreSubsequentReports(reportId)` mutation) — shown once per distinct reporting user among an event's dangerous reports, since it suppresses future submissions from one user, not the event as a whole, and does not itself resolve any report.
5. **And** I also see a separate list of pending `DefaultLocationChangeRequest` rows (status `PENDING_REVIEW`, PRD §4.14) awaiting my review, fetched via a new moderator-only `pendingDefaultLocationChanges` query, gated by `requireModerator` (Story 0.17) per Architecture Spine AD-7 rule 5.
6. **And** for each pending change I can see the linked account's `displayName`/`platform`/`username`/`profileImageUrl` (a new `account` field resolver, mirroring `Report.event`'s pattern — not just the literal `accountId` UUID, which alone gives a moderator nothing recognizable to act on), plus `previousLocation` and `newLocation`.
7. **And** I can either **accept** it (`status: ACCEPTED`, `SocialMediaAccountProfile.defaultLocation` stays `newLocation`, no DB write to the profile since it's already applied per Story 3.3b's immediate-apply design) or **revert** it (`status: REVERTED`, `SocialMediaAccountProfile.defaultLocation` written back to `previousLocation`), via a new `resolveDefaultLocationChange(id: ID!, action: DefaultLocationChangeAction!): DefaultLocationChangeRequest!` mutation guarded by `requireModerator`, stamping `reviewedByModeratorId`/`reviewedAt`.
8. **And** the page is gated by Story 4.7a's `useRequireModerator()` hook (loading/unauthenticated→`/login`/unauthorized→`/`/authorized states) — not a one-off auth check local to this page.
9. **And** all user-facing text (page copy, `ReportReason`/`ReportStatus` labels — reused verbatim from Story 4.6's already-added `en`/`id` namespaces, not redeclared — and the new `DefaultLocationChangeStatus` labels) is sourced through next-intl, for both `en` and `id`.

## Tasks / Subtasks

- [ ] **Task 1: Backend — expose `Event.deletedAt` (AC1, AC3)**
  - [ ] Add `deletedAt: String` to the `Event` type in `apps/backend/src/schema/events.graphql`. No resolver code change needed — `buildOptimizedDrizzleSelect` already derives selected columns from the GraphQL AST wherever it's used (`Report.event`, the `events`/`event`/`eventBySlug` resolvers, `restoreEvent`'s return), and `events.deletedAt` already exists in `packages/database/schema.ts` (Story 4.4a). Regenerate both backend (`pnpm run codegen` server-side types) and frontend GraphQL types after.
- [ ] **Task 2: Backend — `resolveReportsForEvent` mutation (AC1, AC3)**
  - [ ] Add `resolveReportsForEvent(eventId: ID!): [Report!]!` to `apps/backend/src/schema/reports.graphql`, alongside the existing `resolveReport`/`ignoreSubsequentReports` mutations.
  - [ ] Implement in `apps/backend/src/schema/resolvers.ts`: `requireModerator(context)`; in one DB transaction (`db.transaction(async (tx) => ...)`, following the existing `db` import's transaction API): (a) if the event's current `deletedAt` is non-null, `UPDATE events SET deleted_at = NULL, updated_at = NOW() WHERE id = eventId`; (b) `UPDATE reports SET status = 'dismissed', resolved_by_moderator_id = $moderatorId, resolved_at = NOW() WHERE event_id = eventId AND status = 'pending'`, `.returning()`; (c) throw `GraphQLError` (`extensions.code: 'NOT_FOUND'`) if the event doesn't exist. Return the updated report rows (serialize `createdAt`/`resolvedAt` to ISO strings, matching `resolveReport`'s existing serialization).
  - [ ] Unit-adjacent integration test (Vitest, `apps/backend`): event currently soft-deleted with 2 pending + 1 already-dismissed report → clears `deletedAt`, resolves the 2 pending reports to `dismissed`, leaves the already-dismissed one untouched; event never soft-deleted (e.g. all-dangerous-reason group) → only resolves reports, `deletedAt` stays null throughout; non-moderator caller → `FORBIDDEN`; non-existent `eventId` → `NOT_FOUND`.
- [ ] **Task 3: Backend — `DefaultLocationChangeRequest` GraphQL surface (AC5, AC6, AC7)**
  - [ ] New `apps/backend/src/schema/default-location-change-requests.graphql` (new file, following this codebase's one-`.graphql`-file-per-resource convention): `enum DefaultLocationChangeRequestStatus { PENDING_REVIEW ACCEPTED REVERTED }`; `enum DefaultLocationChangeAction { ACCEPT REVERT }` (verb-based argument distinct from the noun/participle status values, mirroring — not literally reusing, since this table is not AD-8-bound — `SoftDeleteAction`'s naming convention); `type DefaultLocationChangeRequest { id: ID! accountId: ID! account: SocialMediaAccountProfile! previousLocation: LocationDetails newLocation: LocationDetails! status: DefaultLocationChangeRequestStatus! changedByUserId: ID! createdAt: String! reviewedByModeratorId: ID reviewedAt: String }`; `extend type Query { pendingDefaultLocationChanges: [DefaultLocationChangeRequest!]! }`; `extend type Mutation { resolveDefaultLocationChange(id: ID!, action: DefaultLocationChangeAction!): DefaultLocationChangeRequest! }`.
  - [ ] Resolvers in `resolvers.ts`: `pendingDefaultLocationChanges` — `requireModerator`; `db.select().from(defaultLocationChangeRequests).where(eq(status, 'PENDING_REVIEW')).orderBy(asc(createdAt))` (oldest-pending-first, matching a review-queue convention); serialize timestamps; format `previousLocation`/`newLocation` via the existing local `formatLocationDetails` helper (already used by `socialMediaAccountProfileByAccountId`).
  - [ ] `DefaultLocationChangeRequest.account` field resolver: `db.select({...buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info), id}).from(socialMediaAccountProfiles).where(eq(id, parent.accountId))`, mirroring `Report.event`'s pattern exactly.
  - [ ] `resolveDefaultLocationChange` resolver: `requireModerator`; load the row by `id`, `NOT_FOUND` if missing, `INVALID_STATE_TRANSITION` if `status !== 'PENDING_REVIEW'` (already resolved); on `ACCEPT` — set `status: 'ACCEPTED'`, `reviewedByModeratorId`, `reviewedAt` (no write to `socialMediaAccountProfiles`, since the change already applied at edit-time per Story 3.3b); on `REVERT` — same stamps plus `status: 'REVERTED'` and `UPDATE socialMediaAccountProfiles SET defaultLocation = previousLocation WHERE id = accountId` in the same transaction (defensive: if `previousLocation` is ever null — should not happen, since only `editAccountDefaultLocation`, Story 3.3b, inserts these rows and only when a prior location existed — throw `GraphQLError` `BAD_REQUEST` rather than silently nulling the profile's location).
  - [ ] Integration tests: accept leaves `defaultLocation` untouched, sets `status`/audit fields; revert restores `previousLocation` and sets `status`/audit fields; already-resolved row → `INVALID_STATE_TRANSITION`; non-moderator → `FORBIDDEN`; `account` field resolver returns the linked profile's `displayName`/`platform`/`username`/`profileImageUrl`.
- [ ] **Task 4: `packages/ui` — `StatusBadge` variant extension (AC6, AC7)**
  - [ ] Additively extend `packages/ui/src/core/status-badge.tsx`'s `variant` union with `"pendingReview" | "accepted" | "reverted"` (distinct keys from the already-shipped `pending`/`upheld`/`dismissed` report-status variants, added by the in-progress Story 4.6, to avoid conflating two different domains' "pending" semantics). Extend `status-badge.test.tsx` with cases for the three new variants; confirm all pre-existing variants' tests still pass unchanged.
- [ ] **Task 5: Frontend — moderator route guard integration (AC8)**
  - [ ] Consume Story 4.7a's `useRequireModerator()` hook at the top of the page's content component. Do not build a second/local auth check.
- [ ] **Task 6: Frontend — GraphQL operations (AC1, AC3, AC4, AC5, AC7)**
  - [ ] New `apps/web/src/features/moderation/moderation.graphql`: `query reportedEvents` (all fields needed for grouping/display: `id reason details status createdAt reporterUserId event { id slug eventName imageUrl deletedAt }`), `mutation resolveReportsForEvent`, `mutation deleteEventPermanently`, `mutation ignoreSubsequentReports`, `query pendingDefaultLocationChanges` (`id accountId account { id displayName platform username profileImageUrl } previousLocation { ... } newLocation { ... } status createdAt`), `mutation resolveDefaultLocationChange`.
  - [ ] `pnpm run codegen` to generate `useReportedEventsQuery`/`useResolveReportsForEventMutation`/etc.
- [ ] **Task 7: Frontend — page shell (AC1, AC9)**
  - [ ] `apps/web/src/app/[locale]/moderator/items/page.tsx`: Server Component, `generateMetadata` via `buildPageMetadata`/`getTranslations({ namespace: "Metadata" })` (new `moderatorItemsTitle`/`moderatorItemsDescription` keys), `<Suspense fallback={<RouteLoader />}>` wrapping `<ModeratorItemsContent />`, matching `queue-status/page.tsx`'s exact structure.
  - [ ] `apps/web/src/app/[locale]/moderator/items/moderator-items-content.tsx` (Client Component): calls `useRequireModerator()` (Story 4.7a) first; while `status === 'loading'`, render `<RouteLoader />`; on `unauthenticated`/`unauthorized`, the hook itself redirects (no local render branch needed beyond a null/loading fallback during the redirect tick). Once `authorized`, run both queries (`useReportedEventsQuery`, `usePendingDefaultLocationChangesQuery`) and render two sections.
- [ ] **Task 8: Frontend — reported-events section (AC1, AC2, AC3, AC4)**
  - [ ] Client-side grouping: `groupBy(reportedEventsData, r => r.event.id)` (a plain `reduce`, not a new package — this is page-local, single-consumer logic, not a `packages/domain` extraction candidate per the Code Organization rule, since it has zero DB/business-rule content, just array reshaping for display).
  - [ ] New `apps/web/src/app/[locale]/moderator/items/reported-event-group.tsx`: renders one card per event group — event name/image/link to `/events/{slug}`, each report's reason/details/status/reporter, the conditional "Mark Safe"/"Restore" button (label from `event.deletedAt`), "Delete Permanently" button (with a confirmation step — irreversible, per AD-8's documented hard-delete exception), and one "Ignore future reports from this user" control per distinct dangerous-reason reporter in the group.
  - [ ] Simple type+status filter controls (native `<select>` elements, or the project's shadcn `Select` primitive if already present under `packages/ui/src/core/` — confirm at implementation time; deliberately not `MultiSelect`, which is sized for the heavier multi-axis `FilterHub` use case, not a 2-axis single-select filter) — passed as `reason`/`status` args to `reportedEvents`, matching EXPERIENCE.md's 06.7 scenario ("Henry can filter the reports by type and status").
  - [ ] Loading: Non-blocking skeleton (initial load, per project-context's rule) matching a card-grid shape, not the reports-list-row shape from Story 4.6 (different content density). Empty state: authored fresh in this story (no UX artifact specifies copy, matching Story 2.2/4.6's precedent for un-designed empty states). Error state with retry, matching `queue-status-content.tsx`'s pattern.
  - [ ] Mutation-in-flight state: `<BlockingLoader active={...} />` (`packages/ui`) during `resolveReportsForEvent`/`deleteEventPermanently`/`ignoreSubsequentReports` calls — all are critical moderation actions per project-context's Blocking-loader rule. On success, refetch `reportedEvents` (React Query `invalidateQueries`/`refetch`, matching `queue-status-content.tsx`'s `refetchAll` pattern) rather than hand-patching cache state.
- [ ] **Task 9: Frontend — pending location-changes section (AC5, AC6, AC7)**
  - [ ] New `apps/web/src/app/[locale]/moderator/items/pending-location-change-row.tsx`: account identity (`displayName`/`platform`/`username`/`profileImageUrl`, reusing `EventCard`'s broken-image `onError` fallback pattern for `profileImageUrl`), `previousLocation.formattedAddress`/`placeName` → `newLocation.formattedAddress`/`placeName` (direct field rendering, matching `locations-content.tsx`'s existing precedent — no new formatting utility), Accept/Revert buttons.
  - [ ] Same loading/empty/error/blocking-loader treatment as Task 8, scoped to this section.
- [ ] **Task 10: i18n (AC9)**
  - [ ] New `ModeratorItemsPage` namespace (`en`/`id`): page title/description, section headings, empty/error/loading copy, button labels (`markSafeLabel`, `restoreLabel`, `deletePermanentlyLabel`, `deletePermanentlyConfirmLabel`, `ignoreFutureReportsLabel`, `acceptLabel`, `revertLabel`), filter labels.
  - [ ] New `Metadata` namespace additions: `moderatorItemsTitle`, `moderatorItemsDescription`.
  - [ ] New `DefaultLocationChangeStatus` namespace (`en`/`id`), keyed by exact enum member name: `PENDING_REVIEW`, `ACCEPTED`, `REVERTED`.
  - [ ] Reuse (do not redeclare) the existing `ReportReason`/`ReportStatus` namespaces already added to `en.json`/`id.json` by the in-progress Story 4.6.
- [ ] **Task 11: Analytics (AD-5)**
  - [ ] `moderator_items_page_viewed` — `{ pendingReportGroupCount: number, pendingLocationChangeCount: number }`.
  - [ ] `moderator_report_resolved` — `{ eventId: string, action: 'mark_safe' | 'restore' | 'delete_permanently', resolvedReportCount: number }`.
  - [ ] `moderator_subsequent_reports_ignored` — `{ reportId: string }`.
  - [ ] `moderator_default_location_change_resolved` — `{ requestId: string, action: 'accept' | 'revert' }`.
- [ ] **Task 12: Testing (AC1-9)**
  - [ ] Backend integration tests per Tasks 2/3 above.
  - [ ] Frontend integration tests (Vitest + msw): route-guard delegation to Story 4.7a's hook (mock its states); grouping renders correctly for a multi-report event; Mark Safe/Restore label switches on `event.deletedAt`; Delete Permanently requires confirmation; per-reporter Ignore-future-reports control renders once per distinct dangerous reporter, not once per report; Accept/Revert location-change flows; empty/error states for both sections.
  - [ ] E2E (Playwright): a moderator test account resolves a reported event (Mark Safe) and sees it drop off the list; a moderator accepts a pending location change and sees it drop off the list; a non-moderator (or unauthenticated) visitor who navigates directly to `/moderator/items` is redirected away and never sees moderator content (Correction, 2026-08-12, via `bmad-create-story` while drafting Story 4.7a: reverses this story's earlier note assuming Story 4.7a would own this E2E — Story 4.7a has no page of its own to test through at its own creation/implementation time, since this page is its only consumer and doesn't exist yet; Story 4.7a instead ships hook-level Vitest coverage only, per its own AC).
  - [ ] Full `pnpm build` / `pnpm lint` / `pnpm run codegen` clean.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 — cited from the swept `epic-readiness/epic-4-readiness.md`** (`swept: true`, dated 2026-08-11, `stories_covered` explicitly includes `4.7`). No architecture/infrastructure gap and no foundational/cross-cutting dependency gap were raised against 4.7's shape at the epic level — the report confirms Epic 4 is entirely synchronous request/response GraphQL (no new AWS infra), and that every adapter/context Epic 4 needs (auth-role/Story 0.17) was already built in Epic 0 in anticipation of it.
  - **Lightweight guard (this story's own creation):** re-checked whether this story's actual implementation-detail scope introduces anything the epic-wide sweep couldn't have anticipated. One real gap found and fixed directly in-story (not split off, since it's a one-line schema addition with no design decision): `Event.deletedAt` was never exposed in `events.graphql` — no story anywhere exposed it, even though Story 4.4a's resolver logic depends on it internally. Added in Task 1.
- **Gate 2 (UI Complexity & Reusability) — run fresh via a one-shot Freya-persona subagent review** (not sourced from the sweep, since Gate 2 stays per-story). Findings:
  1. **No split for the report-group row or the location-change row.** Both are single-current-consumer, page-scoped components — matches Story 4.6's own Gate 2 precedent of declining a shared report-list-item (different data/behavior, different consumer), and this codebase's no-premature-abstraction convention.
  2. **No split for the type+status filter control** — a simple 2-axis dropdown with no second consumer today; `FilterHub.tsx` (the closest existing pattern) is confirmed too heavy (nuqs + `MultiSelect` + location-radius, multi-axis events domain) to be the right reuse target. Build inline; flagged as a watch-item if a future admin list view needs a similar filter.
  3. **Split required: the moderator route-guard.** No page in the codebase handles an authenticated-but-wrong-role visitor (every existing page only guards `isAuthenticated`→`/login`). Presented to the user via `AskUserQuestion` alongside two other real tradeoffs (2026-08-12): the subagent's own finding noted the strict "≥2 places" Gate 2 reuse bar isn't literally met today (no second moderator page exists anywhere in `epics.md`), so the user was given the choice between building it inline (matching Story 4.6's no-second-consumer-no-split precedent) or splitting it off despite that. **User chose to split it off**, prioritizing a tested, dedicated state machine for this security-relevant boundary. See new **Story 4.7a** (`_bmad-output/planning-artifacts/epics.md`), added as a lettered single-story split directly off this story, matching the `1.3a`/`1.3b`/`1.6a` numbering precedent. `sprint-status.yaml` gained a new `4-7a-moderator-route-guard: backlog` entry, positioned before this story's own entry.

### Design Decisions Confirmed With the User (2026-08-12, via conversation + `AskUserQuestion`)

- **Pending-location-change list exposes account identity, not just the literal `accountId`.** The AC's original text listed only `accountId`/`previousLocation`/`newLocation` — but `accountId` is an internal `socialMediaAccountProfiles` UUID a moderator can't act on. **Decision: join and expose `displayName`/`platform`/`username`/`profileImageUrl`** via a new `account` field resolver (Task 3), mirroring `Report.event`'s existing field-resolver pattern. Low cost (one more resolver, no new query), high value (an unusable UI otherwise).
- **Reported-events list is grouped by event, not flat per-`Report`.** Initially decided (via `AskUserQuestion`) as one row per individual `Report`, matching `reportedEvents`' flat return shape most simply. **The user reconsidered and requested event-grouped display instead: a moderator reviews an event once, and a single action resolves every pending report on it simultaneously** — closer to how a moderator actually thinks about the work ("is this event OK or not"), not how the report rows happen to be stored. This is a real, non-mechanical scope change from the story's first pass and is reflected as a `Correction` note directly in `epics.md`'s Story 4.7 AC. Consequence: a new `resolveReportsForEvent(eventId)` mutation is required (Task 2) — grouping alone is a free client-side `groupBy`, but *atomically resolving N reports in one moderator click* is not something Story 4.3a's per-report `resolveReport(id, outcome)` can do; building it as N sequential client-side mutation calls would be non-atomic (a partial failure could leave an event half-resolved).
  - **A further simplification fell out of this, verified directly against Story 4.4a's shipped code, not assumed:** `reports.eventId` has `onDelete: 'cascade'` (`packages/database/schema.ts:401`), so `deleteEventPermanently` already removes every report row on that event as a side effect. There is no meaningful "mark these reports `upheld` before the cascade deletes them" step — the rows are gone. So the event-level action set collapses to exactly two real verbs (`resolveReportsForEvent` for "safe", `deleteEventPermanently` for "not safe"), not three, and `resolveReportsForEvent` needed no `outcome` argument at all — it only ever means "dismiss and un-delete."
  - `ignoreSubsequentReports(reportId)` does **not** collapse into either group action — it is scoped to one reporting user, not the event, so it stays a secondary, per-distinct-reporter control nested inside a report group (Task 8).
- **Permanently-deleted events cannot be silently re-extracted from the same source post — verified as an already-existing invariant, no new code needed.** Raised as a real edge case by the user: could a moderator's `deleteEventPermanently` be circumvented by someone re-selecting the same post via Epic 5's future manual extraction flow? Verified directly against the codebase: `posts.isExtracted` (`packages/database/schema.ts:144`) is a write-once flag — `markPostExtracted()` (`apps/backend/src/lib/posts/mark-post-extracted.ts`) only ever sets it `true`, nothing anywhere resets it to `false`, and `events.postId` uses `onDelete: 'set null'` (not cascade), so deleting the event never touches the post row. `enqueuePostForProcessing()` already throws `PostAlreadyExtractedError` server-side when `isExtracted` is true (existing, tested guard on the automated pipeline). Epic 5's not-yet-built manual-selection flow (`epics.md` Story 5.1a) is already specced to read `isExtracted` for its UI-disable, but its actual `selectPostsForExtraction` submission mutation doesn't exist yet — a **Forward note was added to Story 5.1a** in `epics.md` flagging that its future mutation must apply the same server-side `isExtracted` guard (not rely on the UI disable alone), mirroring `enqueuePostForProcessing`'s precedent. **No code change in this story** — the existing invariant already closes the gap; this is purely a heads-up for Story 5.1a's own future creation.

### List Rendering Decision

Unlike Story 4.6's `/reports` (which the user explicitly chose to leave unpaginated, given its personal, bounded scale), `reportedEvents`/`pendingDefaultLocationChanges` are moderator queues that could in principle grow — but neither takes `limit`/`offset` today, and adding pagination to either would reopen an already-`review` backend contract (4.3a) or add unrequested scope to this story's own new query. Given this is an MVP moderation tool (PRD's "moderator access levels are assigned manually via the database" framing implies a small, trusted moderator pool, not a high-volume queue at MVP scale), both sections render their full result set directly, matching Story 4.6's precedent — revisit only if real moderation volume becomes a problem post-MVP.

### i18n Keys Required (AD-6)

- New `ModeratorItemsPage` namespace (`en`/`id`) — see Task 10.
- New `Metadata` namespace additions: `moderatorItemsTitle`, `moderatorItemsDescription`.
- New `DefaultLocationChangeStatus` namespace (`en`/`id`), keyed by exact enum member name: `PENDING_REVIEW`, `ACCEPTED`, `REVERTED`.
- **Reused, not redeclared:** `ReportReason`/`ReportStatus` (`en`/`id`) — already added to `apps/web/locales/{en,id}.json` by the in-progress Story 4.6 (confirmed present in `en.json` at implementation-planning time). Do not duplicate these keys.

### Analytics Events Required (AD-5)

See Task 11: `moderator_items_page_viewed`, `moderator_report_resolved`, `moderator_subsequent_reports_ignored`, `moderator_default_location_change_resolved` — all `noun_verb`/`noun_noun_verb`-shaped, matching AD-5's taxonomy convention.

### State Management Categorization

- **Server State (`@tanstack/react-query` + `graphql-request`):** `reportedEvents`, `pendingDefaultLocationChanges` queries; `resolveReportsForEvent`, `deleteEventPermanently`, `ignoreSubsequentReports`, `resolveDefaultLocationChange` mutations — all via generated hooks, all triggering a refetch of their respective list query on success.
- **URL State (`nuqs`):** the type/status filter on the reported-events section is a candidate for `nuqs` (shareable/bookmarkable filtered moderator view, consistent with how Discovery's filters work) — confirm during implementation whether the filter is URL-backed or plain local component state; either is acceptable since this is a moderator-only, internal tool page, not a rule violation either way (`project-context.md`'s URL State rule governs *shareable* UI state, and a moderator queue filter is a reasonable but not mandatory case for it).
- **Client Global State (`zustand`):** None required — no cross-component ephemeral state.

### Loader Categorization

- Initial list load (both sections): **Non-blocking, Skeleton**, per project-context's "Non-Blocking (Initial Load)" rule.
- `resolveReportsForEvent` / `deleteEventPermanently` / `ignoreSubsequentReports` / `resolveDefaultLocationChange`: **Blocking**, full-screen `<BlockingLoader />` overlay — all are critical, consequential moderation mutations (one of them is a genuine irreversible hard delete) per project-context's Blocking-loader rule.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: one real gap found and fixed (Task 1), one new resource added (Task 3).**
- **Impacted fields/contracts:**
  - `apps/backend/src/schema/events.graphql`: `Event.deletedAt: String` added (was silently missing despite the column existing since Story 4.4a). No resolver changes needed — `buildOptimizedDrizzleSelect` derives it generically from the AST wherever it's already used.
  - `apps/backend/src/schema/reports.graphql`: new `resolveReportsForEvent(eventId: ID!): [Report!]!` mutation.
  - `apps/backend/src/schema/default-location-change-requests.graphql` (new file): new `DefaultLocationChangeRequestStatus`/`DefaultLocationChangeAction` enums, `DefaultLocationChangeRequest` type, `pendingDefaultLocationChanges` query, `resolveDefaultLocationChange` mutation.
  - `packages/ui/src/core/status-badge.tsx`: `StatusBadgeProps.variant` union extended additively with `pendingReview`/`accepted`/`reverted`.
  - `apps/web/src/generated/graphql.ts`: regenerated via codegen against the above (Task 6) — not hand-edited.
  - **Deliberately not touched:** `packages/database/schema.ts` (no new table or column — `defaultLocationChangeRequests` already exists from Story 3.3b, `events.deletedAt` already exists from Story 4.4a; this story only exposes existing columns/tables through GraphQL); `packages/domain` (no reusable pure business logic — event-grouping is page-local display reshaping, not an extractable rule); `apps/backend/src/schema/social-media-accounts.graphql`'s existing `setAccountDefaultLocation`/`editAccountDefaultLocation` mutations (Story 3.3b, untouched).
- **Required DB migration changes:** None. Every table/column this story reads or writes already exists.
- **Required TypeScript type changes:** `apps/web/src/generated/graphql.ts` regenerated (Task 6); `StatusBadgeProps.variant` union widened (Task 4, additive, no breaking change to existing `active`/`invalid`/`pending`/`upheld`/`dismissed` consumers).
- **Backward compatibility and rollout notes:** Every schema change here is additive (new field, new mutations, new type/enums, new file) — no existing query/resolver/component consumer is modified in a breaking way. `resolveReportsForEvent` and `resolveDefaultLocationChange` are entirely new mutation names, no collision risk.
- **Verification checks:** Task 12's integration tests cover every new resolver/mutation branch and every frontend render branch; Task 12's E2E tests prove the two real moderator flows end-to-end; full build/lint/codegen.

### Project Structure Notes

- **New:** `apps/backend/src/schema/default-location-change-requests.graphql`; `apps/web/src/features/moderation/moderation.graphql`; `apps/web/src/app/[locale]/moderator/items/page.tsx`; `apps/web/src/app/[locale]/moderator/items/moderator-items-content.tsx` + `.test.tsx`; `apps/web/src/app/[locale]/moderator/items/reported-event-group.tsx`; `apps/web/src/app/[locale]/moderator/items/pending-location-change-row.tsx`; one new Playwright E2E spec.
- **Modified:** `apps/backend/src/schema/events.graphql` (`Event.deletedAt` field); `apps/backend/src/schema/reports.graphql` (`resolveReportsForEvent`); `apps/backend/src/schema/resolvers.ts` (new resolvers per Tasks 2-3); `packages/ui/src/core/status-badge.tsx` + test (additive variants); `apps/web/locales/en.json`/`id.json` (new namespaces, per Task 10); `apps/web/src/generated/graphql.ts` (codegen, both `apps/backend` and `apps/web` sides).
- **Not modified:** `packages/database/schema.ts` (no migration); `packages/domain`; `packages/shared-types`; `apps/backend/src/schema/social-media-accounts.graphql` (Story 3.3b's mutations, untouched); `apps/web/src/features/events/navigation-hook.ts`; `apps/infrastructure`; `packages/ui/src/core/app-shell/profile-menu-entries.ts` (the `/moderator/items` nav entry already exists, Story 0.7/2.8's scope).

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.7`] — this story's authoritative AC/Note/Correction text (revised in-session per the grouping reconsideration).
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-4.7a`] — the split-off moderator route-guard this story consumes.
- [Source: `_bmad-output/planning-artifacts/epic-readiness/epic-4-readiness.md`] — swept Gate 1/3 report explicitly covering `4.7`.
- [Source: `_bmad-output/implementation-artifacts/4-3a-build-the-reports-backend-graphql-api-layer-and-personal-visibility-filtering.md`, `apps/backend/src/schema/reports.graphql`, `resolvers.ts:1034-1226`] — `reportedEvents`/`resolveReport`/`ignoreSubsequentReports`/`myReports`/`submitReport`, confirmed live and `review`-status by direct code read.
- [Source: `_bmad-output/implementation-artifacts/4-4a-add-soft-delete-to-the-events-table-and-extend-the-events-resolver-and-moderator-mutations.md`, `resolvers.ts:1145-1193`] — `restoreEvent`/`deleteEventPermanently`, confirmed live; `packages/database/schema.ts:170` (`events.deletedAt`), `:401` (`reports.eventId onDelete: cascade`) — confirmed directly, not assumed, since this drove the "Delete Permanently needs no separate report-resolution call" simplification.
- [Source: `packages/database/schema.ts:346-373`] — `defaultLocationChangeRequests` table (Story 3.3b), confirmed already exists with `accountId`/`changedByUserId`/`previousLocation`/`newLocation`/`status`/`reviewedByModeratorId`/`reviewedAt`/`createdAt`.
- [Source: `resolvers.ts:118-130, 355-390`] — `SocialMediaAccountProfile.hasPendingDefaultLocationReview` and `editAccountDefaultLocation`'s existing insert into `defaultLocationChangeRequests`, confirming `previousLocation` is always populated by this table's sole writer.
- [Source: `apps/backend/src/schema/social-media-accounts.graphql`] — `SocialMediaAccountProfile` type shape (`accountId`, `platform`, `displayName`, `username`, `profileImageUrl`), confirmed before designing the new `account` field resolver.
- [Source: `apps/backend/src/lib/posts/mark-post-extracted.ts`, `apps/backend/src/lib/posts/enqueue-post-for-processing.ts:19-21`, `packages/database/schema.ts:144, 169`] — `posts.isExtracted` write-once invariant and `events.postId onDelete: 'set null'`, confirmed directly to close the user-raised re-extraction edge case without new code.
- [Source: `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.9.3, #4.12, #4.14`] — "Moderator Tools" page scope (reports + pending Default Location changes together), `Report`/`DefaultLocationChangeRequest` canonical interfaces.
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-2, #AD-5, #AD-6, #AD-7, #AD-8`] — AD-7 rule 5 ("new moderator-gated resources extend, not bypass" `requireModerator`) directly authorizes this story's new mutations' auth pattern; AD-8's documented hard-delete exception for `deleteEventPermanently` confirmed unchanged by this story.
- [Source: `design-artifacts/C-UX-Scenarios/06-data-quality/06.7-user-moderator-interfaces.md`] — the only (thin, unstyled) scenario sketch of this page's moderator-facing content and actions ("filter by type and status", "Soft-delete event, Mark as safe, Dismiss report").
- [Source: `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`] — `/moderator/items` IA entry and nav-visibility rule (`role === MODERATOR`); "Default Location Pending Review" State Pattern (accept/revert semantics, badge-clearing behavior); Profile menu nav-item registry confirming `/moderator/items` is already wired (Story 0.7/2.8).
- [Source: `apps/web/src/app/[locale]/settings/queue-status/page.tsx`, `queue-status-content.tsx`] — structural precedent for route shell (`generateMetadata`/`Suspense`/`RouteLoader`), loading/empty/error rendering, `StatusBadge` usage, and the `refetchAll`-after-mutation pattern.
- [Source: `apps/web/src/app/[locale]/settings/locations/locations-content.tsx:189-193`] — direct `LocationDetails.formattedAddress`/`placeName` rendering precedent, no formatting utility needed.
- [Source: `apps/web/src/features/reports/reports.graphql`, `apps/web/locales/en.json:230-239`, `packages/ui/src/core/status-badge.tsx`] — confirmed, by direct read, that Story 4.6 (currently `in-progress`) has already added the `ReportReason`/`ReportStatus` i18n namespaces and the `pending`/`upheld`/`dismissed` `StatusBadge` variants this story reuses rather than redeclares.
- [Source: `packages/ui/src/core/blocking-loader.tsx`] — `BlockingLoaderProps` shape confirmed before specifying Task 8/9's mutation-loading treatment.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions, epic-level-sweep-mode guidance, numbering rule (source of Story 4.7a's split).
- [Source: `_bmad-output/project-context.md#UI-Patterns-UX-Invariants, #State-Management-Architecture, #Code-Organization`] — Loader rules (source of Loader Categorization); List Navigation rule (source of List Rendering Decision); Core Primitives rule (source of `StatusBadge` extension); Code Organization rule (source of "grouping is page-local, not `packages/domain`" and filter-control inline decisions).

## Global Rules References

- [ ] `_bmad-output/project-context.md` — UI Patterns & UX Invariants (Blocking-loader rule for all four new mutations; Locale-Sensitive Data Rendering for `reason`/`status`/date formatting; Core Primitives rule for `StatusBadge`); State Management Architecture (Server State via React Query only; optional `nuqs` for the filter); Code Organization (`apps/web`-scoped components, no premature `packages/ui`/`packages/domain` extraction); i18n (next-intl, `en`/`id`, reuse of Story 4.6's existing namespaces).
- [ ] `story-content-structure.md` — canonical section order followed.
- [ ] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-2 (Unified Query DSL — `reportedEvents`/`pendingDefaultLocationChanges` are moderator-scoped queries, not a second events-collection endpoint, so AD-2 is not implicated); AD-5 (Analytics taxonomy); AD-6 (i18n strategy); AD-7 rule 5 (new moderator-gated resources extend `requireModerator`, not a new enforcement mechanism); AD-8 (confirms `deleteEventPermanently`'s hard-delete exception and `reports.eventId`'s cascade, both load-bearing for this story's design).
- [ ] `docs/infrastructure/index.md` — confirmed no infra shard read needed: this story is synchronous request/response GraphQL only (no Lambda/SQS/EventBridge change), consistent with the epic-4 readiness sweep's Gate 1 finding.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/backend/src/schema/default-location-change-requests.graphql`; `apps/web/src/features/moderation/moderation.graphql`; `apps/web/src/app/[locale]/moderator/items/page.tsx`; `apps/web/src/app/[locale]/moderator/items/moderator-items-content.tsx` + `.test.tsx`; `apps/web/src/app/[locale]/moderator/items/reported-event-group.tsx`; `apps/web/src/app/[locale]/moderator/items/pending-location-change-row.tsx`; one new Playwright E2E spec.
- **Modified:** `apps/backend/src/schema/events.graphql`; `apps/backend/src/schema/reports.graphql`; `apps/backend/src/schema/resolvers.ts`; `packages/ui/src/core/status-badge.tsx` + test; `apps/web/locales/en.json`/`id.json`; `apps/web/src/generated/graphql.ts` (regenerated).
- **Not modified:** `packages/database/schema.ts`; `packages/domain`; `packages/shared-types`; `apps/backend/src/schema/social-media-accounts.graphql`; `apps/infrastructure`.

### Rule Mapping

- **AD-7 rule 5:** all four new/consumed mutations (`resolveReportsForEvent`, `deleteEventPermanently`, `ignoreSubsequentReports`, `resolveDefaultLocationChange`) and both queries are `requireModerator`-guarded, extending the existing single enforcement surface.
- **AD-8:** `deleteEventPermanently` used unchanged (its documented hard-delete exception is not renegotiated by this story); `resolveReportsForEvent` is not itself a soft-delete mutation (it's a report-resolution + soft-delete-*reversal* action) so it does not need the `SoftDeleteAction`/rule-4 shape — it takes no direction argument because it only ever means "un-delete and dismiss."
- **Locale-Sensitive Data Rendering rule:** `reason`/`status` enums resolve through the (reused) `ReportReason`/`ReportStatus` namespaces and the new `DefaultLocationChangeStatus` namespace, each keyed by exact enum member name (Task 10); `createdAt` formatted via the existing scoped-locale date pattern (Task 8/9) — never raw strings.
- **Core Primitives rule:** `StatusBadge` extended in place (Task 4), not duplicated.
- **Code Organization rule:** all new components stay in `apps/web` (page-local, single consumer, per Gate 2 findings above); the one deliberate split (route guard) is `apps/web`-scoped too (Story 4.7a), not `packages/ui`, since it depends on `@/i18n/navigation`'s Next.js router, matching how every other page-level auth-gate in this codebase is implemented today (`apps/web`-local, not a `packages/ui` hook).
- **AD-5 (Analytics taxonomy):** four new events (Task 11), all `noun_verb`-shaped.
- **AD-2:** confirmed not implicated — `reportedEvents`/`pendingDefaultLocationChanges` are moderator-domain queries over `reports`/`default_location_change_requests`, not a second events-collection endpoint competing with the Unified Query DSL.

### Verification Plan

- `pnpm --filter backend test` — new `resolveReportsForEvent`/`pendingDefaultLocationChanges`/`resolveDefaultLocationChange`/`DefaultLocationChangeRequest.account` integration tests pass (Task 2/3); no regression in existing `reports.test.ts`/`resolvers.test.ts`/`cancelled-report-visibility.integration.test.ts`.
- `pnpm --filter web test` — new `moderator-items-content.test.tsx` (and any split-out component tests) pass; extended `status-badge.test.tsx` passes including pre-existing variants; `queue-status-content.test.tsx` unaffected.
- `pnpm run codegen` — clean regeneration on both `apps/backend` and `apps/web` sides, no manual edits needed.
- `pnpm build` / `pnpm lint` (root) — full monorepo build/lint clean.
- Playwright E2E: moderator resolves a reported event via "Mark Safe" and it disappears from the list; moderator accepts a pending location change and it disappears from the list.
- Manual runtime check: visit `/moderator/items` as a non-moderator (redirected per Story 4.7a) and as a moderator with zero/one/many reported-event groups and zero/one/many pending location changes (all empty/populated states); toggle `id` locale and confirm every enum/date localizes; confirm a "Delete Permanently" click requires explicit confirmation before firing.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: moderator-only `/moderator/items` page showing event-grouped reported events (one action resolves all pending reports per event) plus a pending Default-Location-change review list; two new backend mutations (`resolveReportsForEvent`, `resolveDefaultLocationChange`) and one new query (`pendingDefaultLocationChanges`) added in this story's own scope, per the three user-confirmed design decisions in Dev Notes.
- [ ] Architecture and boundary confirmation: all new frontend components `apps/web`-scoped (no `packages/ui`/`packages/domain` extraction, per Gate 2); new backend GraphQL surface guarded by `requireModerator` throughout (AD-7 rule 5); no DB migration required.
- [ ] Testing plan confirmation: backend integration tests for every new resolver branch + frontend integration tests for every render/action branch + two E2E happy-path flows, per Task 12.
- [ ] Explicit human approval state (Default: **pending approval**).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Story 4.3a and Story 4.4a are `review` (backend contracts exist and are testable); Story 3.3b is `review` (`defaultLocationChangeRequests` table exists); **Story 4.7a (moderator route guard) is `backlog`, not yet built** — this story's Task 5 has a hard dependency on it; do not begin Task 5/7 (or any frontend work assuming `useRequireModerator()` exists) until Story 4.7a reaches at least a testable implementation state, matching the precedent set by Stories 4.4/4.4a's own sequencing gate.

## Testing Requirements

- [ ] Backend integration tests (Vitest, `apps/backend`): `resolveReportsForEvent` (clears `deletedAt` + resolves pending reports atomically, leaves non-pending reports untouched, `NOT_FOUND`/`FORBIDDEN` paths); `pendingDefaultLocationChanges` (returns only `PENDING_REVIEW` rows, oldest-first); `resolveDefaultLocationChange` (accept/revert semantics, `INVALID_STATE_TRANSITION` on already-resolved, `FORBIDDEN`); `DefaultLocationChangeRequest.account` field resolver.
- [ ] Frontend integration tests (Vitest + msw): route-guard delegation to Story 4.7a; event-grouped rendering with multiple reports per event; Mark Safe/Restore label conditional on `deletedAt`; Delete Permanently confirmation step; per-distinct-reporter Ignore-future-reports control; Accept/Revert location-change rows; empty/error states both sections; all locale-sensitive rendering (reused `ReportReason`/`ReportStatus` + new `DefaultLocationChangeStatus`).
- [ ] `status-badge.test.tsx`: new `pendingReview`/`accepted`/`reverted` variant cases, confirming all five prior variants still pass unchanged.
- [ ] E2E (Playwright): moderator resolves a reported event end-to-end; moderator accepts a pending location change end-to-end; non-moderator/unauthenticated direct navigation to `/moderator/items` redirects away without exposing content (moved here from an earlier assumption that Story 4.7a would own it — see Task 12 Correction note).

## Deliverables Checklist

- [ ] `Event.deletedAt` exposed in GraphQL schema (Task 1).
- [ ] `resolveReportsForEvent` mutation, backend + tests (Task 2).
- [ ] `DefaultLocationChangeRequest` GraphQL type/query/mutation, backend + tests (Task 3).
- [ ] `StatusBadge` additive variant extension + tests (Task 4).
- [ ] `/moderator/items` route (page shell, content, both section components) (Tasks 5-9).
- [ ] `en`/`id` locale keys (Task 10).
- [ ] Analytics events wired (Task 11).
- [ ] Full test suite (backend + frontend + E2E) green (Task 12).
- [ ] `epics.md` Story 4.7a section, `sprint-status.yaml` `4-7a-moderator-route-guard` entry, and `epics.md` Story 5.1a Forward note (all added during this story's creation, not implementation — verify they remain present/unmodified).

## Out of Scope

- **Story 4.7a — the moderator route-guard hook (`useRequireModerator()`) itself.** Split off per the Gate 2 finding above; this story only *consumes* it (Task 5). New backlog entry: `4-7a-moderator-route-guard`.
- **Pagination for `reportedEvents`/`pendingDefaultLocationChanges`.** Both render their full result set, matching Story 4.6's unpaginated-personal-queue precedent — see "List Rendering Decision." Revisit only if real moderation volume warrants it post-MVP.
- **Story 5.1a's `selectPostsForExtraction` server-side `isExtracted` enforcement.** Flagged via a new Forward note on Story 5.1a in `epics.md`; not this story's mutation to build, since Epic 5 has no backend layer yet.
- **Context-Aware Detail Views (Next/Prev) wiring for event links opened from this page.** Not applicable — a moderator's reported-events queue has no meaningful "next/previous" browsing sequence across unrelated events, matching Story 4.6's identical exemption rationale for `/reports`.

## Definition of Done

- [ ] AC1-AC9 satisfied.
- [ ] Backend + frontend integration tests and both E2E tests passing (Task 12).
- [ ] Lint and type checks passing for `apps/backend`, `apps/web`, and `packages/ui`.
- [ ] `pnpm build` clean at the root.
- [ ] No regression in any existing test suite (`reports.test.ts`, `resolvers.test.ts`, `cancelled-report-visibility.integration.test.ts`, `status-badge` consumers, `queue-status-content.test.tsx`).

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
