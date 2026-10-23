# BUG-080 -- Online events get the posting account's default location (and a map pin)

Captured 2026-10-23 while reviewing the event taxonomy (AD-44). Not caused by it.

## Symptom (traced in code, not yet reproduced against live data)

An online-only event (webinar, Zoom class, livestream) whose post states no physical place is
stored with a physical location: the posting account's default location.

- `packages/domain/src/events/transform-gemini-response-to-event-info.ts:34-36` --
  `payload.location || defaultLocation.formattedAddress ?? placeName`.
- `apps/backend/src/lib/ai-processor/resolve-account-and-locations.ts:49` -- the text sent to
  geocoding falls back to the same default location, so the schedule gets real coordinates.
- `apps/backend/src/validation/extracted-event.schema.ts:20,55` -- `location` is `nullable`, so
  "no location" is a normal model answer, and `events.location` is `NOT NULL`
  (`packages/database/schema.ts`), which is why a fallback exists at all.

Effect: a Jakarta account's online webinar shows a Jakarta pin, can get the "nearby" badge, and
passes radius filters. Nothing in the PRD, the Gemini prompt, the types or the domain code
models online events; the only mention is "online audition" as a stage of one event (PRD 3.x
grouping rule 4).

## Why not an `EventType`

`EventType` says what kind of event it is (seminar, workshop). Online vs in person is how people
attend, so an online seminar is still a `SEMINAR`. An `ONLINE` type would mix two axes in the
type facet. (Same principle as AD-44 Rule 1: form and subject are separate; so is attendance.)

## Proposal (needs a PRD change -- route through `bmad-correct-course`, not a direct story)

1. New `AttendanceMode` enum: `IN_PERSON | ONLINE | HYBRID`, stored **per schedule** (location is
   per schedule today; hybrid and mixed series differ by date). Default `IN_PERSON` so existing
   rows are unchanged.
2. Gemini extracts it (cues: online, daring, webinar, zoom, live streaming, virtual, link
   meeting). Definitions-source pattern from AD-44 applies (one definitions list, one renderer).
3. `ONLINE` schedules: no geocoding, **no default-location fallback**, no map pin, no "nearby"
   badge, excluded from radius filters. `events.location` gets a placeholder rule (nullable
   column or a localized "Online" label) -- the one schema decision to make.
4. FilterHub gets an Attendance facet (In person / Online / Hybrid); default stays
   "everything", so online events are not hidden by a location filter unless the user chooses.
5. Locale labels (en/id), GraphQL enum, codegen, PRD data model block (EventInfo / schedule).

## Open questions (owner)

- Should online events show to users who set a location radius? (Proposal: yes by default,
  labelled, because distance is meaningless for them.)
- Per schedule or per event? (Proposal: per schedule.)
- Interim mitigation before the field exists: skip the default-location fallback when the post
  text matches online cues. Rejected for now as a heuristic that the proper field replaces, but
  it is the cheapest way to stop the wrong pins if this waits long.

## Evidence still needed

Reproduce with a real online-event post from a physical-venue account; count live events whose
location equals the account default and whose caption matches online cues.
