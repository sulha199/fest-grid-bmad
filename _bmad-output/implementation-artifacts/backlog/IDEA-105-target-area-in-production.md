---
backlog_id: IDEA-105
title: "Target area in production: a mixed-level set, the venue-without-address ladder, an aggregates table, neighbourhood with an anchor"
captured: 2026-10-27
---

# IDEA-105 — Target area in production

## What was decided (owner, 2026-10-27)

Full text and evidence: `planning-artifacts/event-insight-poc/target-area-spec-2026-10-27.md`; the PRD side is Section 3.20 ("A Target Area Is a Set, at Mixed Levels", "Order of the Target Area", "A Venue Named Without an Address"). The POC code is in `apps/backend/scripts/poc-event-insight/`: `target-areas.ts`, `venue-resolution.ts`, `hashtag-places.ts`, `implicit-level-policy.ts`, the prompt `audience-v3` in `audience-insight.ts`.

- The model reports only areas the post STATES (caption or poster); code derives the venue, hashtag and account areas.
- A target area is a set of members at mixed levels with roles (participant, attendee) and qualifiers (`only`, `and_surroundings`, `part_of`); nested members collapse to the widest; at most 8.
- A never-classified account is treated as a curator; a curator's bio-stated audience area counts.
- Large venues resolve to the province in DIY and DKI Jakarta only; Batam stays a city.
- A venue named without an address is resolved with context; an ambiguous or generic one gives no venue signal.

## Open before building

1. Measure the profile read on a sample of real accounts: the bio is not stored for any account today (`description` is empty for all 367 accounts with posts); about 25% of the last 30 days' posts come from never-classified accounts.
2. The owner verifies the 12 seeded aggregates (Kartamantul, Joglosemar, Solo Raya, Malang Raya, Bandung Raya, Semarang Raya, Gerbangkertosusila, Jawa-Bali, Bali Nusra, Sumatera, Kalimantan, Sulawesi).
3. The real gazetteer (Kemendagri / BPS) with a revision date, and the geocoder's kecamatan problem (BUG-087).
4. Where the account-scoped venue memory lives (a table keyed by account and normalised venue name), and how a moderator correction overrides it.
5. Production extraction with poster images for `stated_poster`, and a golden set that includes poster-only posts.
6. The probe set of 14 cases (spec section 7 and the edits draft section H), labelled blind and kept apart from the scored set.

Related: IDEA-081 (target-area resolver), IDEA-075 (profile enrichment), IDEA-103 (reposts), BUG-087, AD-42.
