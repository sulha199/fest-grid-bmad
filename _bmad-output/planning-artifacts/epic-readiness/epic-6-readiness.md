---
epic: 6
swept: true
date: 2026-08-08
stories_covered:
  - 6.1 (Vote for a social media account)
  - 6.2 (View the ranked vote list)
  - 6.3 (Withdraw a vote)
  - 6.4 (Autocomplete voted accounts when subscribing)
  - 6.5 (Configure and generate a widget embed)
  - 6.6 (Register and manage embed domains)
  - 6.7 (Public widget rendering page)
---

# Epic 6 Readiness Sweep — Community Demand & Distribution

Scope: PRD §3.13 (Vote for Social Media Accounts), §3.14 (Embeddable Discovery Widget), §4.15 (`AccountVote`), §4.16 (`EmbedDomain`), FR69-FR86, NFR19-20. Evaluated against the planned story list in the originating prompt (Winston, `bmad-epic-readiness-check`, Gate 1 + Gate 3 only — Gate 2 stays per-story).

This sweep was run by direct architectural analysis (not a delegated subagent call) after loading the full epic scope, cross-epic references, `project-context.md`, the architecture spine, and the relevant `docs/infrastructure/` shards — per this skill's own token-efficiency guidance, that context was already gathered once and reasoned over directly rather than re-paying a subagent's cold-context cost for the same conclusions.

## Gate 1 — Architecture / Infrastructure Completeness (epic-wide)

**Finding 1 (bypass): No backend API layer exists for either of Epic 6's two data domains.**
Stories 6.1-6.4 (votes) and 6.5-6.7 (widget/embed) both read as pure frontend screens manipulating `AccountVote`/`EmbedDomain` data with no owning resolver layer — the same failure mode Stories 2.1a/3.1a/4.1a/5.1a were split off to prevent in every prior epic. Two backend-layer stories are required (see table below) — **not one**, because `AccountVote` and `EmbedDomain` are disjoint data domains (no shared table, no shared consumer story) with disjoint technical shapes (authenticated CRUD+ranking vs. a public boolean check consumed by Next.js Middleware rather than a React data hook). Epic 4 already set the precedent of splitting by data domain (4.1a/4.3a/4.4a) rather than one layer per epic; Epic 6 follows that precedent rather than the simpler single-layer pattern of Epics 2/3/5.

**Finding 2 (new API surface, no backend layer): the widget's public domain-check has no owning query.**
Story 6.7's dynamic `frame-ancestors` CSP requires a per-request, unauthenticated check against `EmbedDomain` data. Resolved as an AC of the new embed-domain backend story (`isEmbedDomainAllowed`), not a new finding requiring its own story — see Finding 1.

**Finding 3 (infra pattern gap, single-consumer — not promoted to Epic 0): the widget needs a dynamic, DB-state-driven security header, and no middleware in this codebase does that today.**
Confirmed by direct inspection: `apps/web/middleware.ts` is exactly 4 lines — `next-intl`'s `createMiddleware(routing)`, nothing else. No `frame-ancestors`/CSP/`X-Frame-Options` logic exists anywhere in shipped code (only in PRD/epics.md prose). Setting a per-request `Content-Security-Policy` header that depends on a live database-backed whitelist, checked via a network call to `apps/backend` from inside Next.js Edge Middleware, is genuinely new infrastructure for this app. This **is** a Gate 1 finding (an architectural layer with no owning story) but is **not** a Gate 3 finding — no other route or epic in the PRD or `epics.md` has, or is expected to have, a per-request dynamic security-header requirement; the PRD's own Security NFR text ("the rest of the application's framing protection is unaffected") frames this as deliberately isolated, not a generalizable pattern. It gets its own single-story architecture split (`6.7a`), scoped to Epic 6, not Epic 0. See the "Dynamic CSP" discussion below for the full reasoning the user asked for.

**Finding 4 (adapter capability gap, cross-epic): the "lightweight profile lookup" Story 6.1 assumes does not exist anywhere, but two independent epics need it.**
See the "Profile-lookup gap" discussion below — this is the sweep's most consequential finding and the one with a genuine cross-epic angle, so it's treated in full below rather than summarized here.

**Finding 5 (adapter capability gap, single-consumer): city/province bucketing for the vote region-breakdown has no data source.**
`LocationDetails` (PRD §4.3) and `UserLocationPreference` (PRD §4.6) carry only `coordinates`/`placeName`/`formattedAddress`/`timezone` — no structured city/province field. Story 6.2's region-breakdown AC ("bucketed city/province... suppressed under 5 distinct voters") cannot be computed from anything that exists today. Resolved as an AC of the vote backend layer (`6.1a`), reusing Story 0.16's already-cached raw Geoapify response rather than issuing new external calls — see table below. This does **not** promote to Epic 0: no other epic needs city/province bucketing (only raw-radius distance calculations, which already exist via Story 2.5a's `ST_DWithin` precedent and are reused as-is for Story 6.2's "Near Me" resort — that resort needs no new capability, only the *region-breakdown display* does).

**No gap found (confirmed, not just assumed) for:**
- Story 6.5 (configure/generate widget) needs no backend mutation at all — PRD §3.14 describes an ephemeral snippet generator (filters/mode/theme encoded as URL query params), not a persisted "my saved widgets" list. Confirmed no such retrieval requirement anywhere in PRD §3.14 or the KPI section.
- Story 6.7's reuse of `EventListView`/`WeeklyCalendarView` (Story 1.3d/1.3g, both done) and the events GraphQL query with the Unified Query DSL (Story 1.3a/AD-1, which already supports every filter field the widget needs — account, type, category, keyword, `withinRadius`) requires no new backend query — this exact "public page composing existing components + DSL filters" pattern is already precedented by Story 3.11.
- Story 6.7's `.ics` add-to-calendar reuses Story 2.1b's Route Handler + generator utility as-is — no new API surface.
- Story 6.2's "Near Me" re-sort weighting reuses the same `ST_DWithin`/haversine technique Story 2.5a already established for event radius queries — a hand-written reuse of the same SQL technique (not the DSL itself, since `AccountVote` isn't an event-query resource), not a new capability.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness (epic-wide + cross-epic)

### The profile-lookup gap (does it clear the cross-epic reuse bar? where does it live?)

**Yes, this clears Gate 3's bar.** Two independent consumers, across two epics, both need the identical capability at the identical layer:

1. **Epic 3** (already shipped/shipping): Story 3.4's 2026-08-07 Forward note explicitly names this — Story 3.1's onboarding subscribe form and Story 3.2's "My Subscriptions" subscribe form both want live account validation on submit, but "no concrete per-platform scraper exists yet... consider whether [Story 3.4] should also expose" a lightweight preview/validate capability distinct from the scheduled bulk-scrape. Story 3.1 shipped (is in `review`) with this as an explicit, documented "accepted gap" (handle text only, no validation).
2. **Epic 6** (this sweep): Story 6.1's own PRD source (§3.13) is unusually explicit and *pre-emptively rejects* the placeholder approach: "performs a lightweight profile lookup (existence check + public profile metadata, not a post scrape or AI extraction) to populate `SocialMediaAccountProfile.accountId`/`displayName`/`username`... directly from the platform, **so the new record never depends on a placeholder or the entered handle text**." This line was evidently written with the Epic 3 gap already in mind.

Two independent, PRD-documented consumers is exactly the bar Stories 0.13/0.15/0.16/0.17 were promoted on. **Recommendation: build it, scoped as an amendment to Story 3.3c (the `ScraperAdapter` interface story), not as a new numbered story, and not as an Epic 0 promotion.**

**Where it lives — reasoning:**
- **Not Epic 0.** Only two epics need it, both of which already sit on top of Story 3.3c's registry regardless (Epic 6's vote-for-a-new-account path independently requires "validated against the scraper adapter registry" per PRD §3.13/FR70, so Epic 6 already has a hard dependency on Story 3.3c existing — adding one more method to that same interface introduces no *new category* of cross-epic coupling, it just completes the interface Epic 6 was already going to depend on).
- **Not Story 3.4 (the bulk-scrape story).** `lookupAccountProfile` is a synchronous, on-demand, single-account request/response — a fundamentally different call shape than 3.4's scheduled, queued, multi-account bulk job. They don't need to share an implementation *story* just because they'll likely share an HTTP client per platform. Placing the interface addition on 3.3c (which already explicitly scopes itself as "interface/registry scaffold only — first concrete implementation(s) remain Story 3.4's scope") keeps that same interface/implementation split consistent: the *method signature* goes in 3.3c, the *first concrete platform implementation* stays Story 3.4's job, exactly mirroring how `getNewestPosts` itself is split today.
- **Story 6.1 should depend on it, not take Story 3.1's "accepted gap" posture.** Three reasons, not just preference:
  1. PRD §3.13's text already anticipated and explicitly rejected the placeholder approach (quoted above) — treating it as an accepted gap would require *walking back* already-deliberate PRD language, not just accepting an omission.
  2. It's architecturally cheap: one adapter interface method, reusing per-platform routing/proxy logic (e.g. Instagram-via-`imginn.com`) that Story 3.3c/3.4 already have to build for `getNewestPosts` regardless.
  3. **The placeholder approach is actively worse for data integrity than the "accepted gap" framing suggests.** Story 3.1a's lookup-or-create logic matches an account by `platform`+`accountId` (the platform-native identifier) — not by handle text, which isn't guaranteed stable or unique. A vote-created placeholder profile keyed on handle text would have no reliable `accountId` to match against later, when a real subscription (Epic 3, using a real scrape) creates or finds the canonical profile row — risking **duplicate `social_media_account_profiles` rows for the same real-world account**, directly undermining the "exactly one row per account" invariant Story 3.1a exists to enforce (per its own Note). Building the real lookup avoids introducing that reconciliation problem in a brand-new epic.
- **PRD §3.13's text does not need correcting.** It already describes the correct target behavior. The only thing that needed making explicit was the *dependency* (Story 6.1 → Story 3.3c amended → Story 3.4 concrete impl) — an `epics.md`-level concern, not a PRD-level one. **Build-order note:** Story 3.4 is still explicitly flagged in its own text as "high-level/placeholder... has not had its own readiness/create-story pass yet." Story 6.1 cannot actually ship until at least one concrete platform's `lookupAccountProfile` exists — a real, but ordinary, cross-epic sequencing dependency (Epic 6 already assumes Epic 2/3 are built first for `UserLocationPreference`/subscriptions/scraper registry).

### The dynamic CSP / domain-whitelist mechanism (Gate 1, Gate 3, or neither? Epic 0 or Epic 6?)

Answered above under Gate 1 Finding 3 in brief; full reasoning:

- **It is a Gate 1 finding** (a new architectural mechanism — dynamic per-request security headers driven by a backend network call from Edge Middleware — with no owning story), **not a Gate 3 finding** (no second consumer exists or is anticipated anywhere in the PRD; the PRD's own text frames the widget's CSP scoping as deliberately isolated from the rest of the app's — static — framing posture).
- **It needs its own prerequisite story** because it is non-trivial, novel infrastructure (new to this codebase) that would otherwise get silently absorbed as a buried subtask of "build the widget page" (Story 6.7) — the exact Gate 1 failure mode this gate exists to catch — and because Next.js supports exactly one `middleware.ts` per app, meaning this change **must** compose with, not replace, the already-shipped next-intl locale-routing middleware. That composition risk (a shared, already-in-`review` infra file becoming a merge point for two unrelated concerns) is itself worth a dedicated, reviewable story rather than a drive-by edit.
- **It is Epic-6-scoped, not Epic 0.** Reusability across ≥2 epics is what promotes a foundation to Epic 0 (Stories 0.13/0.15/0.16/0.17's precedent, and AD-8's rule about not binding a table speculatively "found to have no documented... action" until one is concretely needed). Exactly one route needs this today. Speculatively generalizing "dynamic security headers" into an Epic 0 primitive with zero second consumer would repeat the same anti-pattern Gate 3 exists to prevent in the *other* direction (over-abstracting ahead of need).

### Other foundational/cross-cutting gaps found

- **AD-8 (Architecture Spine) is out of sync with `project-context.md` for this epic's two new tables.** `project-context.md`'s Soft-Delete Convention paragraph already lists `AccountVote`/`EmbedDomain` as bound tables (evidently updated alongside the PRD's Epic 6 addition), but the Architecture Spine's AD-8 "Binds" line (the canonical, binding document per its own header) was **not** updated to match — it still only names `EventInfo`/`Favorite`/`CalendarEntry`/`Subscription`/`ApiKey`/`UserLocation`. This is an unambiguous documentation-sync correction, not a new story. **Recommended exact text change** (not applied — this sweep is read-only besides this report, per instruction):

  > Append to AD-8's **Binds:** bullet in `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`:
  > `, `AccountVote` (`account_votes`; PRD 4.15) and `EmbedDomain` (`embed_domains`; PRD 4.16) — added ahead of the spine during the PRD's Epic 6 (Community Demand & Distribution) update; project-context.md's soft-delete list already reflects this, the spine is corrected here to match.`

  Both new tables' soft-delete mutations (`withdrawVote`, `deregisterEmbedDomain`) are specified in the new prerequisite stories below to already follow AD-8 rule 4's `action: SoftDeleteAction!` shape, so no story needs to change — only the spine's own text is stale.

- **A minor, pre-existing PRD numbering collision, noted but not this sweep's to fix:** the PRD's Non-Functional Requirements section (and `epics.md`'s copied NFR list) has two `NFR19`s and two `NFR20`s — the widget-CSP/location-reuse-boundary bullets added for Epic 6 collided with the pre-existing "one-way calendar"/"web analytics service" NFR19/20. This is a PM/`bmad-prd` renumbering fix, not an architecture gap — flagged here only so it isn't lost; not acted on by this sweep.

- **Autocomplete UI (Story 6.1/6.4) and the retrofit touch-point on already-`review`/`ready-for-dev` Stories 3.1/3.2:** Story 6.4 says voted accounts "surface as ranked autocomplete suggestions in Story 3.1/3.2's subscribe form," which means reopening UI in stories that are already past dev. This is a real forward-compatibility risk worth flagging for whoever runs `bmad-create-story` on 6.4, but it's a **Gate 2** (UI composition/reusability) concern, intentionally out of this sweep's scope — noted here only as a heads-up, not resolved.

## New Prerequisite Stories

| Key | Title | Classification | Position |
|---|---|---|---|
| `6.1a` | Build the account-vote backend GraphQL API layer | Shared data-ownership (originates in Epic 6) | Before Story 6.1 (first consumer) |
| `6.6a` | Build the embed-domain backend GraphQL API layer | Shared data-ownership (originates in Epic 6) | Before Story 6.6 (first consumer) |
| `6.7a` | Build the widget's dynamic frame-ancestors CSP middleware | Single-story architecture split (Story 6.7's sole consumer) | Before Story 6.7 |
| — | Amendment to **existing** Story 3.3c (no new story number) | AC correction, per Step 4's "unambiguous, epic-wide fix applied directly" carve-out | N/A — amends 3.3c in place |

No Epic 0 promotions this sweep — both candidate cross-cutting mechanisms (profile-lookup, dynamic CSP) were evaluated against the ≥2-independent-epic-reuse bar and only the profile-lookup capability cleared it, and it fits naturally as an amendment to an existing Epic 3 story rather than a new Epic 0 story (see reasoning above).

## AC Corrections Applied Directly (not new stories)

1. **Story 3.3c** — add a `lookupAccountProfile` method to the `ScraperAdapter` interface AC, plus an Amendment note. Full proposed text in the accompanying response (not applied to `epics.md` — read-only sweep per instruction).
2. **Architecture Spine AD-8** — append `AccountVote`/`EmbedDomain` to the "Binds" bullet. Exact text above (not applied — read-only sweep).

Full draft sections for `6.1a`, `6.6a`, `6.7a`, and the Story 3.3c amendment are provided in this sweep's response to the requester, at the same AC-depth as Stories 3.1a/5.1a, for manual insertion into `epics.md` and `sprint-status.yaml`.
