# Backlog History Log

Extracted from `backlog.yaml`'s `last_updated` field on 2026-09-18, where this
narrative had accumulated as an unbounded, ever-appended quoted YAML string
(peaked at 54KB, read in full by every skill that consults the backlog board).
The field also turned out to contain the same entries repeated multiple times
(83 raw date-prefixed segments collapsing to 30 unique ones after a merge with
`master` re-combined branches that had each appended independently) --
deduplicated below. See `sprint-history.md` for the earlier, identical pattern
found and fixed in `sprint-status.yaml`.

**This file is historical record only -- nothing here should be re-read by
ritual skills as part of normal backlog activation.**

---

2026-09-18 (BUG-037 added+done: found incidentally when the FIND-034 batch's BUG-015/FIND-020/FIND-017/IDEA-015 quick-dev step turned out to be spec-only (no target-scope code ever landed) and its post-check auto-fix pass, chasing 2 real pre-existing test failures, correctly fixed an unrelated cross-user createApiKey duplicate-check bug (resolvers.ts:434 was missing an apiKeys.userId filter) plus a Story 4.8 test-isolation flake. Independently re-verified (all 74 resolvers.test.ts tests pass) and committed. User confirmed proceeding: commit these stray fixes first, then re-dispatch the stalled 4-item batch step, split smaller this time.)

---

2026-09-18 (FIND-035 added, user-reported mid-batch during the FIND-034 ritual-orchestrator run: observed the daily scraper issuing an overlapping date range every run instead of scraping incrementally. Root-caused via direct code reading: scraper.ts's EventBridge daily-batch path hardcodes newerThan=now-7days for every account every run (real, recurring Bright Data/Apify metered vendor cost, not AWS free-tier float); the correct incremental fix (use newestPost.publishedAt, fall back to scrapeInitialLookbackDays only for a first-ever scrape) already exists in process-scrape-job.ts but is wired only to the SQS-fallback path, never the primary cron path. User asked for a direct recommendation between backlog-and-defer vs fix-now; recommended capture + fix via quick-dev as the next batch step (ahead of FIND-024/FIND-022/IDEA-010 already queued) since it's low-risk, high-value, and reuses a proven existing pattern with no architectural/UX ambiguity -- user's response ('what your suggestion?') deferred the call to this recommendation, which was then acted on.)

---

2026-09-18 (BUG-002/FIND-017/BUG-015/FIND-020/IDEA-015 triaged and FIND-034 given blocks: [BUG-002], user-directed follow-up to FIND-034: swept the board for rows sharing FIND-034's Lambda/queue-infra neighborhood (BUG-002, FIND-017, BUG-015, FIND-020) and the scraper-cost neighborhood (IDEA-015), moved all five from backlog to triaged, and cross-linked FIND-034 -> BUG-002 since BUG-002's missing-timeout framing is specific to the ESM-invocation model FIND-034's fix removes for aiProcessorLambda/ingestorLambda. Also surveyed backlog items on the auto-ingestion pipeline itself (scrape -> AI extraction -> DB ingest): FIND-024 (hashtags not forwarded to persistScrapedPost), FIND-022 (repost/coauthor misattribution), IDEA-010 (can't distinguish inactive vs scrape-in-progress account) were already triaged; none overlap FIND-034, which is purely about SQS transport cost, not ingestion correctness.)

---

2026-09-17 (FIND-034 added via direct AWS CLI investigation: user reported an AWS Free Tier billing alert (SQS 867,586/1,000,000 monthly requests). Traced via CloudWatch NumberOfEmptyReceives to all 6 non-DLQ queues' always-on Lambda SqsEventSource mappings continuously long-polling regardless of content — 854,420 of the 867,586 requests (98.5%) were empty polls, half from the 3 dev queues which processed zero real messages all month. Applied a manual stopgap (disabled the 3 dev event-source-mapping UUIDs via aws lambda update-event-source-mapping) that will not survive the next cdk deploy. User confirmed scraping/AI-extraction/data-ingestion can all tolerate minutes of delay, so the durable fix is: stage-gate dev's ESM enabled flag (context-flag opt-in) and replace all 3 prod ESMs with a 5-minute EventBridge-scheduled poll-and-drain, modeled to cut prod daily SQS requests ~96% and bring the month-end projection from ~225k over the free tier to ~95k under. Full investigation, numbers and implementation shape in backlog/FIND-034-sqs-lambda-poller-idle-cost.md.)

---

2026-09-16 (IDEA-012 promoted via bmad-create-story, row id named directly by the user: Story 0.37 extends AI extraction (Gemini schema/prompt + AJV validation) to capture `links: {url, label?}[]`, threads it through a new pure packages/domain sanitizeEventLinks function into a new events.links jsonb column (mirrors locationDetails/proposedData, not contactInfo's flat text() column) and a new GraphQL Event.links field (zero new resolver code, buildOptimizedDrizzleSelect passthrough verified directly against source), then renders it read-only in EventDetailView.tsx as one clickable row per link. Gates 1/2/3 all ran fresh (no epic-0-readiness.md sweep applies) and all returned no gap; Gate 2 confirmed zero UX-spec coverage of this row in DESIGN.md/EXPERIENCE.md after a real search. Two genuine design tradeoffs (Correct Data dialog scope, multi-link layout) were confirmed by the user via AskUserQuestion, routed through the ritual-orchestrator's mailbox relay after this session's own direct AskUserQuestion calls hit a repeated 'Stream closed' tool error — both answered with their recommended defaults ('Display-only now'; 'One row per link'), not assumed from the failure. Split the deferred Correct Data dialog scope into a new child row, IDEA-036 (parent: IDEA-012, status: backlog), rather than silently absorbing or dropping it.)

---

2026-09-16 (FIND-029 promoted via bmad-create-story: 4 bundled Story-2.7-code-review findings -- settings-lookup race, schedule isMainSchedule uniqueness, duplicated past-event threshold logic, Discovery dynamic-export inconsistency -- fanned into one standalone Epic 0 story, 0-36-harden-past-events-visibility-mechanism, matching the FIND-016/0.34/0.35 standalone-Epic-0 precedent since no formed epic exists for this row. Scoping the schedule-uniqueness migration's blast radius surfaced a 5th, previously-uncaptured gap (processIngestionJob.ts's AI-extraction insert path has no isMainSchedule-exactly-one-true guard, unlike the separate correction-edit path) -- folded into the same story as a new AC rather than left as a landmine the story's own migration would trigger; see Story 0.36's Dev Notes for the full record and its 3 AskUserQuestion-confirmed tradeoffs.)

---

2026-09-15 (IDEA-035 added via bmad-create-story during Story 0.i5b: Gate 2 found no EXPERIENCE.md/DESIGN.md coverage of scroll-position behavior on filter change; user chose to add scroll-to-top-on-filter-reset to Discovery's home-content.tsx directly rather than leave it unspecified, and this idea tracks formalizing it as a cross-surface convention if/when other useListPaginationController adopters need the same treatment.)

---

2026-09-15 (BUG-035/BUG-033/BUG-034/FIND-030/FIND-031 added via bmad-agent-architect: follow-up event-detail page performance audit requested by user after AD-16/IDEA-028. Found eventBySlug's full resolver chain runs twice per pageview (generateMetadata's server-side fetch is discarded, then EventDetailWrapper re-fetches the identical over-fetching query client-side, no HydrationBoundary/dedup — BUG-035, also explains why the existing next/prev router.prefetch() is more expensive than it should be); a Schedule.isAddedToCalendar N+1 scoped to one event's schedule list, same defect class as BUG-030 (BUG-033); favorites missing an eventId-leading index, forcing a full table scan on every favoriteCount resolution (BUG-034); useGetMySubscriptionsQuery firing unconditionally with no shell-level warm cache unlike useMeQuery (FIND-030); and minor client-side hygiene (unmemoized prop mapper, raw img tags) (FIND-031). None required an architecture pass — implementation fixes, not cross-cutting invariants. Note: BUG-032 was originally drafted for the eventBySlug-double-fetch finding but renumbered to BUG-035 on discovering BUG-032 was already claimed by a concurrent bmad-help session's commit e00192c for an unrelated hashtag-persistence finding — see that entry below.)

---

2026-09-15 (BUG-032 + IDEA-029..IDEA-033 added via bmad-help: user's six sections captured as separate backlog items — hashtag persistence investigation (BUG-032, sibling of FIND-024), reusable location link component (IDEA-029), event-detail UI batch (IDEA-030), event-detail platform account element (IDEA-031), platform account location info (IDEA-032), event-detail schedule (IDEA-033); each got a tier-1 note under implementation-artifacts/backlog/)

---

2026-09-15 (IDEA-028 added via bmad-architecture: user-initiated architecture session for the event-detail page — declared it the #2-traffic endpoint, proposed platform-prefixed event slugs to enable DB-free parallel Instagram oEmbed resolution, and supplied a full backlog-items survey of the event-detail/oEmbed cluster as input. Produced Architecture Spine AD-16 (Platform-Prefixed Event Slugs & Parallel oEmbed Resolution): events.slug becomes {platformSlug}_{postType}_{platformPostId} for platform-sourced events, reusing the existing platform-registry.ts mapping; posts gains platformPostId/platformPostType columns parsed once at scrape time; oEmbed resolution stays apps/backend-owned but becomes DB-free, invoked via a second parallel React Query hook in EventDetailWrapper.tsx instead of a nested blocking resolver field. Supersedes IDEA-022's sequential-split proposal — see IDEA-028's note and IDEA-022's SUPERSEDED note. Also reconciled prd.md's stale 'Nano ID' slug description (Sections 4.1/4.4/8.2) and project-context.md (Unique Identifiers + new Database & Performance eventBySlug #2-traffic-endpoint rule). Full decision trail: planning-artifacts/.memlog.md.)

---

2026-09-15 (BUG-031 added via bmad-help: user reported the shared infinite-scroll pagination (packages/ui/src/hooks/useInfiniteScroll.ts, used by Discovery/Feed/Favorites/Archive/Account) can jump the viewport straight to the very bottom right after the next page loads — mobile always, desktop intermittently; logged as an unconfirmed backlog bug pending scroll-position diagnosis.)

---

2026-09-15 (BUG-030/FIND-027/FIND-028 added via bmad-agent-architect review: user asked for a review of the getEvents endpoint and its usage across Discovery/Feed/Favorites, flagging it as the highest-traffic endpoint. Traced apps/backend/src/schema/resolvers.ts's `events` resolver and `Event` type resolvers plus all three consumer hooks. Confirmed a real N+1 (BUG-030): buildOptimizedDrizzleSelect only maps requested fields to physical `events` columns, so the shared getEvents.graphql document's favoriteCount/isFavorited/schedules fields fall through to per-row Event.* field resolvers despite fieldMap already having EXISTS-subquery forms for several of them, unused for output. Also found totalCount computed unconditionally every call (FIND-027, the resolver's own comment already flags it) and no client-side staleTime on any of the three consumers' React Query hooks, causing refetches on every remount/refocus (FIND-028). Two other suspects cleared: the favorites two-round-trip ID-snapshot pattern is a deliberate stable-ordering trade-off, not a defect; the default sort's correlated subqueries are properly backed by schedule_event_date_idx. Added durable notes to _bmad-output/project-context.md (Database & Performance section) and the PRD's NFR Performance section flagging getEvents as needing stricter-than-default optimization scrutiny.)

---

2026-09-15 (IDEA-027 added via bmad-help: user flagged a missing user-account-settings UI to configure the user's own settings; verified the existing settings/account page has no tab for the PRD's User.displayName/timezone/locale/email fields, only api-keys/subscriptions/posts/notifications — genuinely unscoped, needs a bmad-ux pass)

---

2026-09-14 (BUG-029 added via bmad-help: user reported queryActorRuns — the Moderator Tools Actor Runs query, Story 3.4k — returns HTTP 502 in production; no repro detail supplied, logged as a bare unconfirmed report pending a prod log pull)

---

2026-09-14 (FIND-026 added; IDEA-026 marked spec-complete-but-uncoded; IDEA-016/IDEA-017/CC-019 amended via bmad-png-to-html: a full UX design pass across masonry/calendar-row/new-calendar-grid-item EventCard surfaces in design-artifacts/UX-festgrid-run-1/, 8 feedback rounds prototyped in HTML first per user directive then folded into DESIGN.md/EXPERIENCE.md, commits 70564a0/3fb9233/e3fe946 — see CC-019's own amendment note for the full summary and its child items' notes for per-surface detail)

---

2026-09-13 (IDEA-026/BUG-028 added, IDEA-025 amended via ritual-orchestrator HIL during the epic-1-i1 create-story/dev-story batch: user confirmed the Upcoming/Nearby badge treatment (IDEA-025) should apply to BOTH the mobile compact row and the desktop calendar grid, not just mobile — split the desktop half into new IDEA-026 since desktop's `variant='grid'` cells have zero thumbnail/badge infrastructure today and need a fresh bmad-ux pass (date box flattened to inline text, positioned right of the badges). Also fixed BUG-028 same session, directly (not via bmad-dev-story): WeeklyCalendarView's Previous-week control had no floor, could browse arbitrarily far into the past — now disables once the displayed week is today's week or earlier, verified via lint/build/full test suite, commit dc2d6bc.)

---

2026-09-11 (BUG-027/IDEA-023 amended via bmad-help: user proposed adding a confidence score to resolved schedule locations and gating the event-detail map link on it — coordinate when confident, place text when not. Confirmed Geoapify already returns rank.confidence/match_type per result, currently discarded entirely by geoapify-client.ts; folded the field addition into BUG-027 and resolved IDEA-023's open combine-placename-and-coordinates question into this threshold design, with the caveat that a low-confidence fallback should use disambiguated text (place + known city/country), not the bare ambiguous string that likely caused the low confidence in the first place)

---

2026-09-11 (BUG-027/IDEA-023 added via bmad-help: user asked whether Geoapify is used for schedule-location geocoding (confirmed yes, and it's the only provider per CC-004) and whether the account's country should bias that search — confirmed no country bias param is sent today and no country field is even mapped from Geoapify's response into LocationDetails, so schedule locations can resolve to a same-named venue in the wrong country; split out a related event-detail Google-Maps-link question (combine placeName + coordinates in the query) as IDEA-023, flagged as partly a downstream symptom of the same root cause and with its own open question about whether Google's Maps Search URL API actually supports combining free text with a coordinate bias)

---

2026-09-11 (IDEA-022 split out via bmad-help: researched whether the Instagram embed's oEmbed call can move fully client-side — confirmed the manual embed.js pattern works without oEmbed, but confirmed embed.js has no failure callback for deleted/private posts, so the backend call stays for its deterministic AVAILABLE/UNAVAILABLE signal; found the real bottleneck instead — getEventBySlug is one client-side React Query fetch, so a slow nested instagramEmbed field blocks the whole page's first paint, not just the embed — recommended splitting it into its own query over @defer, since graphql-yoga's defer/stream support is plugin-gated+experimental and graphql-request can't consume multipart responses; user agreed, item is now story-ready)

---

2026-09-11 (IDEA-020 amended and IDEA-021 split out via bmad-help: user supplied 3 cited sources on Instagram oEmbed caching best practices — confirmed 2 of 3 claims already match this repo's code (24h TTL, embed.js loaded once), and split the 3rd (untested `omitscript=true` param) into its own xs-effort IDEA-021 since it's independently actionable)

---

2026-09-11 (IDEA-020 added via bmad-help: Instagram embed load-speed improvement — frontend-generated embed markup, Meta-JS/CDN caching, and a service-worker-backed PWA install path with iOS-specific UX, unscoped and flagged for bmad-architecture/bmad-ux)

---

2026-09-11 (BUG-026 added via bmad-help: recurring single-day-of-week schedules — e.g. 'every Monday Sep 7-28' — extract as one contiguous eventStartDate/eventEndDate span with no field narrowing which weekdays within it are actually valid, and this is a live correctness bug, not just an extraction nicety: buildEventsQueryCondition.ts's dayOfWeek AI-filter already matches any date inside that span regardless of weekday. Proposed a new Schedule field reusing the existing DayOfWeek enum, deferred to a PRD/architecture decision.)

---

2026-09-11 (IDEA-019 amended via bmad-help: user-directed rule added — the happening-now/upcoming/all toggle applies to card view only, not calendar view, since WeeklyCalendarView already expresses time structurally; flagged that EventDiscoveryPanel.tsx's activeView/currentViewId state is currently internal-only and would need to be exposed to gate the toggle by view)

---

2026-09-11 (BUG-024/BUG-025/IDEA-019 added via bmad-help: event-list-filter backlog session — collapsed discovery filter header missing a solid background, Feed/Favorites hardcoding isAuthenticated=false and dropping the location/AI-filter buttons Discovery has, and a proposed happening-now/upcoming/all temporal filter with a suggested segmented-toggle placement)

---

2026-09-11 (IDEA-018 added via bmad-help: Apify webhook token uses Math.random() instead of Bright Data's crypto.randomBytes, found while fixing the webhook-token-mismatch bug that left scraper_actor_runs/pending jobs stuck PENDING despite vendor runs completing; trigger-scraper.yml extended with a job_type input (daily-batch/stale-job-sweep) for on-demand recovery of stuck jobs)

---

2026-09-11 (IDEA-017 added, FIND-023/IDEA-016 revised via bmad-ux: reopened the masonry EventCard date-box/TILL-badge design against 4 new reference screenshots — resolved as a prominentPoster-gated split, not a reversal, of CC-019/Story 1.3b's shipped overlay decision, with a new default-state beside-a-thumbnail composition and a recolored/repositioned TILL badge (IDEA-017, parented to CC-019); fully specified WeeklyCalendarView's calendar-row-card composition including a single date box repurposed to show till/end info instead of a redundant start date (IDEA-016, now parent CC-019); tokenized the FIND-023 graceful-degrade fallback identically across both surfaces via a new shared event_card_favorite_count_badge_large token. DESIGN.md/EXPERIENCE.md updated, status left draft. User directed all engineering follow-up be tracked as backlog only, not new/amended story files, until picked up.)

---

2026-09-11 (FIND-023/IDEA-016 added via bmad-help: event-card layout audit against two user-provided screenshots — broken/expired event image should render nothing rather than an 'image not available' placeholder, parented to CC-018/3-7c; WeeklyCalendarView has no thumbnail image at all today and needs one, with the favorite icon enlarging as the fallback when the image is missing/expired)

---

2026-09-11 (IDEA-014/IDEA-015 added via bmad-help: SCRAPE_RESULTS_LIMIT 10->30 cron-skip fix reverted mid-session per user request and logged instead, multi-account-vs-per-account scrape batching cost research (low priority, own bash/pwsh script required); IDEA-013 added via bmad-help: no per-cron-cycle scraper-batch record; manual scraper trigger shipped same session as .github/workflows/trigger-scraper.yml, not a backlog item)

---

2026-09-07 (BUG-023/IDEA-012 added via bmad-help: favorite-icon/date-badge size mismatch, event-links extraction+display; BUG-021/BUG-022 added via bmad-help bug-report session: ended-event visibility triaged to Story 2.7's still-review status; EventCard TILL/date-box gap folded into Story 1.3b AC19)

---

2026-09-18 (Story 1.i1k created via bmad-create-story: IDEA-042/FIND-025 reconciled as duplicates of the same EventCardDateBox two-tier-chrome gap -- FIND-025 finding (2), a lint guard against reintroducing a dynamically-interpolated Tailwind arbitrary-value class, folded directly into Story 1.i1k's own scope rather than a separate follow-up. Wiring that guard surfaced packages/ui has no lint script/ESLint config at all -- split into new FIND-035 -> Story 0.41 (renumbered from 0.40 on merge with master, which independently landed its own Story 0.40 for FIND-034 first), out of Story 1.i1k's scope.)
