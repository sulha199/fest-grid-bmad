---
backlog_id: CC-033
---

# Sprint Change Proposal: Attendance mode (in person / online / hybrid) — BUG-080

Date: 2026-10-25 · Prepared for: shulha · Mode: Batch · Status: **approved 2026-10-25 (shulha), scope: Moderate**

## 1. Issue summary

**Trigger.** BUG-080, captured 2026-10-23 during the AD-44 taxonomy review, not caused by it. The product has no concept of *how* an event is attended. An online-only event (webinar, Zoom class, livestream) whose post names no physical place is stored with a physical location: the posting account's default location.

**Problem type.** Misunderstanding of original requirements (a requirement gap, not a regression): the PRD models every event as physical.

**Evidence (traced in code, not yet reproduced on live data):**

- `packages/domain/src/events/transform-gemini-response-to-event-info.ts` — `payload.location || defaultLocation.formattedAddress ?? placeName`.
- `apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts:49` — the text sent to geocoding falls back to the same default location, so the schedule gets real coordinates.
- `events.location` is `NOT NULL`, which is why a fallback exists at all; `schedules.location`, `latitude`, `longitude` are already nullable.
- Effect: a Jakarta account's online webinar shows a Jakarta pin, can earn the "Nearby" badge, and passes radius filters. The only online mention in the PRD is "online audition" as a stage of one event (§3 grouping rule 4).

**Still missing:** a real online-event post from a physical-venue account, and a count of live events whose location equals the account default with online cues in the caption. Carved out as a child row (see §6), because it does not block the design.

## 2. Impact analysis

**Epics.** No completed epic is invalidated. The work is a new **feature epic** (mechanism story + adoption stories + ratchet, per `epic-formation-gate.md`); number assigned at formation via `bmad-form-epics`. It touches the behaviour delivered by Epic 1 (event discovery: FilterHub, cards, calendar, detail) and Epic 9 (AI prompt filter vocabulary) but needs no change to their done stories.

**PRD.** Seven edits (§4.1). No MVP goal changes; the MVP remains achievable.

**Architecture.** One new decision, provisionally **AD-45** (number to be confirmed against the other architecture branches at write time): `AttendanceMode`, one definitions source (the AD-44 pattern), per-schedule storage, a nullable `events.location`, and a rule that only `IN_PERSON` schedules may fall back to an account default location. AD-22 (distance for nearby badges) gains one clause.

**UX.** `DESIGN.md` / `EXPERIENCE.md`: an attendance chip on cards, list rows, calendar tiles and detail; an Attendance facet in FilterHub; no map and no distance for online schedules. Needs a `bmad-ux` pass before the UI story.

**Technical impact (files / areas):**

| Area | Change |
|---|---|
| `packages/shared-types` | `AttendanceMode` enum; definitions source + aliases (daring, webinar, zoom, live streaming, virtual, link meeting) |
| `packages/database` | `schedules.attendance_mode text NOT NULL DEFAULT 'IN_PERSON'` (no pgEnum, per AD-44 Rule 6); `events.location` → nullable |
| Gemini extraction | `attendanceMode` per schedule in the model-facing response schema, **required** (the 2026-10-25 `groupingReason` finding: optional fields get omitted) |
| `resolve-account-and-locations.ts`, `transform-…-event-info.ts` | skip geocoding and the default-location fallback for non-`IN_PERSON` schedules |
| GraphQL / codegen | `AttendanceMode` enum, `Schedule.attendanceMode`, `Event.location: String` (nullable), `EventFilterInput.attendanceModes` |
| Filters | radius operator becomes "within radius **or** `ONLINE`"; FilterHub Attendance facet; AI-filter vocabulary + golden prompts |
| Web / ui | chip + no pin + no distance badge; ICS omits `LOCATION` (about 30 `event.location` readers must tolerate null) |
| Corrections | `proposed-event-correction` schema gains `attendanceMode`; `location` becomes optional |
| i18n | en/id labels (Online / Daring, In person / Tatap muka, Hybrid) |
| Tests | golden corpus gains online and hybrid fixtures (live run, mind the Gemini RPM/RPD limits in `project-context.md`) |

**Deploy-order risk.** The Lambdas deploy separately (AD-44 Rule 7). Making `events.location` nullable is backward-compatible for old writers, but an old reader meeting a null on `String!` errors. So readers (GraphQL nullable + UI tolerance) must ship before any writer stores a null.

## 3. Recommended approach

**Direct adjustment** (new feature epic within the existing plan). Rollback and MVP reduction are not applicable: nothing shipped needs reverting and the MVP is unaffected.

- Effort: **Medium–High** (about 5 stories, touches DB, extraction, filters, UI, i18n).
- Risk: **Medium**, mainly the `events.location` nullability rollout and prompt/schema regression (mitigated by the golden corpus and CC-024 regression).
- Scope classification: **Moderate** — PRD and architecture change plus a backlog reorganisation; no replan. Hand off to PM/Architect for the PRD and AD text, then `bmad-form-epics` and `bmad-create-story`.

**Owner decisions already taken (2026-10-25):** per **schedule**, not per event; online events **shown and labelled** under a radius filter (never hidden by distance); **no interim keyword fix** — wait for the proper field; batch review.

## 4. Detailed change proposals

### 4.1 PRD (`prds/festgrid-prd-2026-07-10-2047/prd.md`)

**P1 — new requirement, in the event/schedule section (§3 near the grouping rules and §4.2 Schedule).**
NEW: "**Attendance mode (added 2026-10-25).** Each schedule has an attendance mode: `IN_PERSON`, `ONLINE` or `HYBRID`, extracted from the post (cues such as online, daring, webinar, zoom, live streaming, virtual). Existing and unstated schedules are `IN_PERSON`. An `ONLINE` schedule has no map pin, no coordinates, no 'Nearby' badge and no distance, and never inherits an account's default location."

**P2 — data model: `interface Schedule` (line ~594).**
OLD: `location?: string;` … (no attendance field)
NEW: add `attendanceMode: AttendanceMode; // IN_PERSON | ONLINE | HYBRID, default IN_PERSON` and an `enum AttendanceMode { IN_PERSON, ONLINE, HYBRID }` block with a pointer comment `// see ATTENDANCE_MODE_DEFINITIONS`.

**P3 — data model: `interface EventInfo` (line ~414).**
OLD: `location: string;`
NEW: `location?: string; // absent when every schedule is ONLINE`

**P4 — Nearby Badge (line 37).**
OLD: "…a card for an event within 5km of the viewer's current position shows a 'Nearby' badge. …"
NEW: append "An event whose schedules are all `ONLINE` never shows the badge and has no distance."

**P5 — nearby search (§3.3, line 48).**
NEW sentence: "Online schedules are never excluded by a radius: a radius filter matches schedules within the radius **or** online schedules, which are labelled 'Online'. The Attendance facet narrows this."

**P6 — grouping rule 4 (line 91).**
OLD: "**Dependent stages** (e.g. online audition → finalists → final) are **one event** …"
NEW: append "Each stage carries its own attendance mode (an online audition stage is an `ONLINE` schedule of the same event)."

**P7 — filters: §4.18 `EventFilterInput` and §3.15 locked vocabulary (line 291).**
NEW field `attendanceModes?: AttendanceMode[]` on `EventFilterInput`; add "attendance (in person / online / hybrid)" to the list of things a prompt can populate; FilterHub gets a matching facet.

### 4.2 Architecture (`festgrid-architecture-spine.md`)

**A1 — new AD-45 (provisional number): "AttendanceMode Is a Per-Schedule Fact With One Definitions Source".**
Rules: (1) `AttendanceMode` is a schedule attribute and never an `EventType` (type = what kind, attendance = how attended; same separation as AD-44 Rule 1). (2) One definitions source + renderer in the AD-44 pattern, rendered into the extraction and AI-filter prompts. (3) Stored as `text NOT NULL DEFAULT 'IN_PERSON'`, validated by AJV and the GraphQL enum, **no pgEnum**. (4) Only `IN_PERSON` schedules may use the account default-location fallback; `HYBRID` uses only a stated venue; `ONLINE` never geocodes. (5) `events.location` is nullable; null means "no event-level physical location". (6) Required in the model-facing response schema. (7) No backfill and no re-extraction: existing rows are `IN_PERSON`; wrong pins on past online events are fixed through the existing moderator correction flow. (8) Rollout order: readers tolerate null → migration → writers. (9) A source-scan ratchet: no code path may assign coordinates to a schedule without consulting its attendance mode.

**A2 — AD-22 (nearby distance): add a clause.**
NEW: "A schedule without coordinates, and every `ONLINE` schedule, gets no `distanceKm` and no nearby badge."

### 4.3 Epics / stories (new feature epic; shape only, `bmad-form-epics` finalises)

1. **Mechanism:** enum + definitions source + renderer + `schedules.attendance_mode` + nullable `events.location` + GraphQL + codegen + corrections schema + readers tolerate null (ships first).
2. **Extraction:** model schema + prompt + resolve/transform changes + golden-corpus online/hybrid fixtures + live eval + CC-024 regression.
3. **Distance and filters:** "radius or online" operator, `EventFilterInput.attendanceModes`, FilterHub facet, AI-filter vocabulary + golden prompts.
4. **UI:** attendance chip, no pin/badge/distance, detail view, calendar tiles, ICS, en/id labels (after the `bmad-ux` pass).
5. **Ratchet:** the AD-45 rule 9 source-scan test.

### 4.4 UX (`design-artifacts/UX-festgrid-run-1/DESIGN.md`, `EXPERIENCE.md`)

Add an `attendance_chip` token and usage rule (on cards, list rows, calendar tiles, detail), the FilterHub Attendance facet pattern, and the "Online" state of the location line (no map, no distance). Run `bmad-ux` before story 4.

### 4.5 Other artifacts

- `docs/infrastructure/*` and `architecture-diagram.md`: **not affected** (no service, queue, Lambda, scraper, database, host or major library is added or removed; CLAUDE.md §4 not triggered).
- `.github/workflows/ai-filter-golden-prompt-nightly-eval.yml`: new golden prompts for the attendance facet.
- `project-context.md`: add an "Attendance mode" rule when AD-45 lands.

## 5. Implementation handoff

- **Scope:** Moderate.
- **PM / Architect:** apply P1–P7 and write AD-45 (confirm AD numbering first).
- **UX:** `bmad-ux` pass for §4.4.
- **SM / PO:** `bmad-form-epics` to form the epic, then `bmad-create-story` per story.
- **Dev:** implement in the order above; stories 1 → 2 order is a hard dependency (deploy-order risk).
- **Success criteria:** an online-only post yields an `ONLINE` schedule with no coordinates, no pin, no badge and no default-location address; it appears under a radius filter labelled "Online" and is removable via the Attendance facet; existing events are unchanged; golden corpus and CC-024 regression pass.

## 6. Carved-out items (to become child rows on approval)

- Reproduce BUG-080 on live data and count affected events (evidence query) — also decides whether a one-off moderator clean-up of past online events is worth doing.
- A joinable-link field for online schedules (registration/meeting link) — out of scope here.
- Hybrid events with two distinct venues — out of scope.
