---
date: 2026-08-01
trigger_story: none (proactive brand decision)
scope: Moderate
status: approved (planning artifacts applied; app code handed off, not yet implemented)
---

# Sprint Change Proposal — FestGrid → FestDaily Rebrand (User-Facing Only)

## 1. Issue Summary

The product owner (shulha) determined that "FestGrid" reads as too technical/engineering-sounding for the app's intended casual audience, and decided to rebrand the app-facing name to **"FestDaily."** This is a proactive brand/positioning decision, not a bug or technical constraint discovered during implementation.

**Explicit scope constraint from the trigger:** only user-facing surfaces are renamed — product name as seen/read by users and referenced in planning/UX documentation. Code-level identifiers are explicitly out of scope and unchanged:
- Workspace package names (`@festgrid/shared-types`, `@festgrid/ui`, `@festgrid/analytics`, `@festgrid/database`, `@festgrid/domain`, `@festgrid/graphql-select`, `@festgrid/eslint-config`, `@festgrid/typescript-config`)
- Repository name
- Database/schema names
- The PRD folder slug `festgrid-prd-2026-07-10-2047` (internal artifact identifier)

## 2. Impact Analysis

- **Epic Impact:** None. No epic (0–5) has its scope, acceptance criteria, or sequencing changed. This is a cross-cutting copy/branding change layered on top of existing functional work.
- **Story Impact:**
  - Story 0-6 ("Set up i18n foundation (next-intl)", status `review`) — owns [layout.tsx](apps/web/src/app/[locale]/layout.tsx), which hardcodes `title: 'FestGrid'` and a "Music Festival Grid" description. Needs a small patch before review is finalized.
  - Story 0-7 ("Build the global app shell and navigation layout", status `review`) — owns [Logo.tsx](packages/ui/src/core/app-shell/Logo.tsx), which renders the "Fest"/"Grid" logotype text. Needs a small patch before review is finalized.
  - No `done` stories are affected — the only two stories touching brand-name strings in app code are both still in `review` (implemented, not yet approved), so this does not require reopening completed/accepted work.
- **Artifact Conflicts:**
  - PRD (`prd.md`) — 9 occurrences of "FestGrid" as the product name.
  - Architecture spine (`festgrid-architecture-spine.md`) — 3 occurrences, all in the document title/intro sentence (no architectural decision content changes).
  - `epics.md` — 4 occurrences (product name references, no scope/AC changes).
  - UX design docs (`design-artifacts/`) — 23 occurrences across 13 files (scenario docs, trigger map, product brief, `DESIGN.md`/`EXPERIENCE.md` for both the main app and wizard-page UX runs).
- **Technical Impact:**
  - `layout.tsx` — `metadata.title` and `metadata.description` strings.
  - `Logo.tsx` — logotype text spans only. The 2×2 grid logomark icon is a visual pun on "Grid" and is **explicitly not redesigned in this change** — flagged as a separate follow-up design task once new brand visuals are decided.
  - Tests likely asserting the old title string — [page.test.tsx](apps/web/src/app/[locale]/page.test.tsx) and [home.spec.ts](apps/web/e2e/home.spec.ts) — flagged for the implementer to check/update alongside the code change.
  - i18n locale files (`apps/web/locales/en.json`, `id.json`) — no occurrences found; the brand name isn't currently routed through translation keys, so no locale-file changes are needed for this rename.
  - No email templates exist yet (Story 0-15, outbound email adapter, is `ready-for-dev`/unstarted) — no impact there.
  - Left unchanged, confirmed out of scope: `design-artifacts/UX-festgrid-run-1/` folder name (internal artifact path, not user-facing) — decided by user to leave as-is.

## 3. Recommended Approach

**Option 1 — Direct Adjustment**, selected. This is a content/copy rename with no functional or architectural implications. Nothing needs rollback; MVP scope and goals are unaffected. Effort: **Low**. Risk: **Low** — mechanical find/replace of a display string across docs, plus two small, well-isolated code edits in stories that haven't been approved yet (so no reopening of accepted work).

## 4. Detailed Change Proposals

### PRD (`_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`)
- Global replace: "FestGrid" → "FestDaily" (9 occurrences). Name-only; no requirement text changes.

### Architecture Spine (`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`)
- `title: "Architecture Spine: FestGrid"` → `"Architecture Spine: FestDaily"`
- Heading and intro sentence: "FestGrid" → "FestDaily" (3 occurrences total). No changes to architectural invariants/content.

### `epics.md`
- Global replace: "FestGrid" → "FestDaily" (4 occurrences). No epic scope, AC, or sequencing changes.

### UX Design Docs (`design-artifacts/`)
- Global replace: "FestGrid" → "FestDaily" across all 23 occurrences in 13 files:
  - `A-Product-Brief/project-brief.md`
  - `B-Trigger-Map/trigger-map.md`
  - `UX-festgrid-run-1/DESIGN.md`, `UX-festgrid-run-1/EXPERIENCE.md`
  - `UX-wizard-page-run-1/DESIGN.md`
  - `C-UX-Scenarios/00-login-flow/00.1-google-login.md`, `00.2-logout.md`, `00.3-getting-started-onboarding.md`
  - `C-UX-Scenarios/01-sarahs-weekend-rescue/01-sarahs-weekend-rescue.md`, `01.1-event-discovery/01.1-event-discovery.md`
  - `C-UX-Scenarios/02-alex-manages-locations/02.1-manage-locations.md`
  - `C-UX-Scenarios/04-alex-manages-keys/04.1-manage-api-keys.md`
  - `C-UX-Scenarios/04-alex-extracts-events/04.7-email-notification-quota.md`
- Text-only; no flow/wireframe/interaction changes.
- Folder `UX-festgrid-run-1/` name: **left unchanged** (user decision — internal artifact path, not user-facing).

### App Code (`apps/web`, `packages/ui`) — user-facing strings only
- [layout.tsx](apps/web/src/app/[locale]/layout.tsx) line 16: `title: 'FestGrid'` → `title: 'FestDaily'`
- [layout.tsx](apps/web/src/app/[locale]/layout.tsx) line 17: description reworded to drop "Grid" (e.g. `'AI-Powered Music Festival Planner and Scheduler'` — exact wording to be finalized with the user at implementation time)
- [Logo.tsx](packages/ui/src/core/app-shell/Logo.tsx) lines 16-17: logotype spans `"Fest"` / `"Grid"` → `"Fest"` / `"Daily"`
- Logo icon (2×2 grid logomark): **unchanged in this proposal** — flagged as a follow-up design task (new icon concept needed since the current icon visually puns on "Grid")
- Tests to check/update: `page.test.tsx`, `home.spec.ts` (likely assert the old title string)

## 5. Implementation Handoff

**Scope: Moderate** — no fundamental replan, but touches two stories currently in `review` status (0-6, 0-7) plus several planning/UX docs.

- **Planning artifacts (PRD, architecture spine, `epics.md`, UX design docs):** apply directly once this proposal is approved — pure text edits, no further review needed.
- **App code (`layout.tsx`, `Logo.tsx`, associated tests):** hand off to the Developer agent (`bmad-dev-story` or `bmad-quick-dev`) as a small patch against Stories 0-6 and 0-7 before their review is finalized. No `sprint-status.yaml` status change needed — both stories remain in `review`, this is an addendum to their existing scope, not new required scope that blocks approval.
- **Follow-up (not part of this proposal):** new logomark icon concept to replace the grid-pun icon, once new brand visuals are decided. Recommend tracking this as a small backlog item rather than blocking the text rename.

## Execution Log

- 2026-08-01: PRD, architecture spine, `epics.md`, and all 13 UX design doc files patched directly (39 total "FestGrid" → "FestDaily" occurrences, verified by re-scan — zero remaining in the approved-scope files). `UX-festgrid-run-1/` folder name and `festgrid-prd-2026-07-10-2047` slug intentionally left unchanged per user decision.
- App code (`layout.tsx`, `Logo.tsx`, `page.test.tsx`, `home.spec.ts`) **not yet touched** — remains a handoff item for a Developer-agent workflow (`bmad-dev-story` against Stories 0-6/0-7, or `bmad-quick-dev`).
- 2026-08-01 (addendum): `prfaq-festgrid.md` (24 occurrences) also renamed after user review — on reflection this is customer-facing narrative copy (same genre as the product brief), not a process/audit record, so it was reclassified out of the "leave alone" bucket and updated. Filename left as `prfaq-festgrid.md` (internal artifact slug, same treatment as the PRD folder).
- Historical/audit-trail artifacts intentionally left untouched (out of proposal scope): `.memlog.md` files, `review-rubric*.md`, `validation-report*.md/html`, `consolidation.md` — these are point-in-time process records, not living documents.

## Success Criteria
- No remaining case-sensitive "FestGrid" occurrences in PRD, architecture spine, `epics.md`, or UX design docs (except the intentionally-preserved `UX-festgrid-run-1/` folder name and the `festgrid-prd-2026-07-10-2047` slug).
- App displays "FestDaily" in the browser tab title and the app-shell logotype.
- `page.test.tsx` / `home.spec.ts` updated and passing against the new title string.
- `@festgrid/*` package names, repo name, and DB/schema names remain untouched.
