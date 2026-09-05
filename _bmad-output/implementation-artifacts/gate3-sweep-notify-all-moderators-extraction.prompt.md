# Gate 3 Sweep: Extract a Reusable "Notify All Moderators" Mechanism

## Scope

Repo: fest-grid-bmad (Instagram-scraping event-discovery app, "FestDaily"). Before doing
anything, read:
- `_bmad-output/project-context.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`
- `_bmad-output/planning-artifacts/story-split-gate.md` (Gate 1/2/3 definitions,
  execution protocol, numbering rule, lightweight-guard/sweep-mode escape hatch)

## The trigger

Two shipped modules are near-verbatim duplicates of the same "email every
`role='moderator'` user" pattern:

- `apps/backend/src/lib/notifications/send-dangerous-report-moderator-alerts.ts`
  (Story 4.5)
- `apps/backend/src/lib/notifications/send-scraper-audit-alert.ts` (shipped
  2026-09-05, from a scraper-audit-trail bugfix)

Both do the identical sequence: `db.select().from(users).where(eq(users.role,
'moderator'))` → empty-check-and-log → build `moderatorReviewUrl` from
`loadBackendEnv().webAppBaseUrl` → `Promise.allSettled` fan-out of
`sendTemplatedEmail(<template-key>, mod.email, <variables>)` → per-rejection
`console.error`. They differ only in function name, template key, and template
variables.

A **third** near-identical consumer is already planned and unstarted: Story 3.4q
(`_bmad-output/implementation-artifacts/3-4q-fix-brightdata-auth-failure-and-alert-moderators-when-a-scraper-provider-goes-down.md`,
Task 5, `send-scraper-provider-down-alerts.ts`). Read that story in full — its own
task text already flags the risk: *"reusing the exact same query as the
dangerous-report alert — do not duplicate the moderator-lookup logic, extract a
small shared `getModeratorEmails()` helper if the duplication would otherwise be
exact, per the 'reuse over reinvention' rule"* — but stops short of mandating the
full extraction.

This was already flagged and deferred, not freshly discovered — read both:
- `_bmad-output/implementation-artifacts/deferred-work.md`, the section headed
  `## Deferred from: quick-dev fix of scraper-audit-trail-alerting (2026-09-05)`,
  bullet 2 (the duplication finding)
- `backlog.yaml`'s `FIND-020` entry, which references it

Bullet 2 already names the repo's own extraction bar and a proposed shape:

> "Per this project's own established bar for extracting shared infrastructure
> (Story 0.22's `activeOnly()` precedent, and Story 0.23's Dev Notes citing the
> same rule) — 'once ≥2 real call sites exist, not speculatively for one' —
> extraction into a shared `notifyAllModerators(templateKey, variables)` helper
> is now justified."

## Why this needs a real Gate 3 pass, biased toward extraction

Story 3.4q *already ran* Gate 3 over this exact pattern two days before this prompt
was written (`3-4q-...md`, Dev Notes → "Architecture & UX Gate Findings"). Read that
section in full. Its verdict was **"No gap found"** — reasoning that the moderator-
query-and-email pattern "already exists and already has two consumers... this is
exactly the kind of already-established, reusable foundation Gate 3 exists to
confirm is not being built ad hoc for the first time."

That reasoning conflates two different things: *reusing an established pattern* and
*extracting it into one shared implementation*. It let a second real duplicate ship
under the "no gap" verdict, and would let a third ship the same way if 3.4q proceeds
unchanged.

**When you run Gate 3 in this session, do not repeat that reading.** The repo's own
stated bar — "once ≥2 real call sites exist" — is not a bar for *tolerating
duplication of a pattern*, it's a bar for *extracting a shared implementation*. Two
real call sites already exist today, unmodified since 3.4q's own pass; a third is
about to be added by that same still-unstarted story. Treat this as a genuine,
already-cleared Gate 3 trigger (a named reusable utility with no home yet), not a
"pattern exists, ship another copy" pass.

## What to do

1. Run the Gate 1/2/3 sweep properly, via `bmad-create-story` (which invokes
   `story-split-gate.md`'s Step 3.5 mechanics directly) for a new prerequisite
   story: extract `notifyAllModerators(templateKey, variables)` (or a better name
   you land on during design) as shared infrastructure. Per the numbering rule in
   `story-split-gate.md` §"Numbering Rule," a foundational/tooling gap like this
   becomes a new, sequentially-numbered Epic 0 story — let `bmad-create-story`'s
   own numbering step assign the number by reading the current `epics.md`/
   `sprint-status.yaml` state; do not guess a number here.
2. Design the extracted helper against both existing call sites' real shapes (not
   just one) — read `send-dangerous-report-moderator-alerts.ts` and
   `send-scraper-audit-alert.ts` in full before designing. Preserve: the `deps`
   injection param both already use (for testability), the "never throws to the
   caller" contract, and the zero-moderators/partial-failure behavior both already
   test. Decide deliberately (and record the decision) whether the helper should be
   generic over any `EmailTemplateKey` + variables shape, or scoped to a narrower
   "moderator alert" template subset — this is a real design choice, not a given.
3. Refactor both existing shipped call sites onto the new helper. Note in the new
   story that Story 3.4q's Task 5 (`send-scraper-provider-down-alerts.ts`, still
   unstarted) should consume this helper once built rather than writing a fourth
   copy — flag this as a note for whoever implements 3.4q, not necessarily
   something this story edits directly.
4. Follow the normal `bmad-create-story` flow through to a real story file (Gate
   1/2/3 findings recorded in Dev Notes, `epics.md`/`sprint-status.yaml` updated
   per the numbering rule) before any implementation begins.

## Explicitly do not

- Do not silently re-conclude "no gap" by re-treating "a pattern already exists" as
  sufficient — that is the exact reasoning this prompt exists to correct.
- Do not touch Story 3.4q's own file to force it to consume the new helper as part
  of this story — that's 3.4q's own implementer's job, once this extraction ships.
- Do not scope-creep into the other deferred findings from the same session
  (`FIND-020`'s throttling/cooldown, DB-outage blind spot, or `FIND-021`'s
  HTML-escaping gap) — those are separate, already-tracked backlog items.
