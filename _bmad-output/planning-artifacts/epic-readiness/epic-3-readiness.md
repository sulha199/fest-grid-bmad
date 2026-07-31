---
epic: 3
swept: true
date: 2026-07-31
stories_covered:
  - 3.1
  - 3.2
  - 3.3
  - 3.3a
  - 3.4
  - 3.5
  - 3.6
  - 3.6b
  - 3.7
  - 3.8
  - 3.9
  - 3.10
---

# Epic 3 Readiness Report — Social Media Event Integration

## Scope

Epic 3 already carried significant retroactive gate work from earlier sweeps: Stories 0.13 (AI Gateway adapter), 0.14 (AWS IaC), 0.15 (outbound email adapter), 0.16 (Geolocation adapter), and 0.17 (GraphQL authenticated-context layer) were all promoted into Epic 0 explicitly because Epic 3's stories (3.1, 3.2, 3.6, 3.10, FR33) needed them. Story 3.3a (posts table) and Story 3.6b (Ingestor Lambda) were likewise already split off Story 3.6 by a prior per-story gate pass. This sweep checked whether anything *still* unaddressed remains in Epic 3's current story list, epic-wide and cross-epic.

## Gate 1 — Architecture / Infrastructure Completeness

**Already resolved (cited, not re-flagged):** the original 3.6 direct-DB-write mistake (now fixed via 3.6b's Ingestor Lambda split), missing IaC (0.14), and direct Gemini calls (0.13's adapter requirement).

**Gaps found — all resolved as AC corrections to existing stories, no new prerequisite story needed:**

1. **Missing "via backend GraphQL API" language in Stories 3.1, 3.2, 3.3, 3.7.** Unlike Epic 1's stories, which explicitly state persistence/fetching goes through the backend API "not directly from the database," Epic 3's onboarding/subscription/feed stories omitted this. Backing infrastructure already exists (Story 0.8 scaffold, Story 0.17 auth context, Story 1.1 tables) — this was an AC-phrasing gap only. **Corrected directly in `epics.md`** (see below).
2. **No story stated that BYOK API keys are encrypted via KMS on write.** Story 0.13 only covers *decrypting* a stored key for outbound Gemini calls; Story 0.14 provisions the KMS key itself; nothing said submission (Story 3.1) must encrypt through it. **Corrected directly in `epics.md`** (Story 3.1 AC).
3. **Story 3.7's Feed needs a query dimension Story 1.3a didn't expose** — filtering events by `sourceSocialMediaAccountId` scoped to the current user's subscriptions (FR31). This extends 1.3a's existing resolver rather than requiring a new one. **Corrected directly in `epics.md`** (Story 1.3a and Story 3.7 ACs).

No other Gate 1 violations found in 3.4, 3.5, 3.6, 3.6b, 3.9, 3.10 beyond the call-outs below.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

**No new cross-cutting gap found.** Everything Epic 3 needs that other epics also need is already homed: AI Gateway adapter (0.13, also Epic 4), IaC (0.14), outbound email adapter (0.15, also Epic 4/FR35), Geolocation adapter (0.16, also Epic 2/FR33), GraphQL authenticated-context (0.17, also Epic 2/4).

The KMS-encryption-on-write gap and the 1.3a filter-extension gap were evaluated against Gate 3's promotion bar (≥2 independent epics needing the same unbuilt thing) and do **not** qualify — encryption-on-write is Epic-3-only (only BYOK subscriptions write secrets), and the subscription-scoped event filter is needed only by Story 3.7 today. Both stay in-epic as AC corrections.

## Call-out verdicts

| Story | Verdict |
|---|---|
| **3.7** | AC correction — extend Story 1.3a's resolver with an account-scoped filter; add "via backend GraphQL API" bullet to 3.7. Not a new story. |
| **3.8** | Simple correction — add `Depends on: Story 0.12, Story 2.9` (FCM foundation + push-notification settings toggle). No infra gap. |
| **3.9** | Correction (duplication) — Story 0.13's AC already implements the Tier 1/Tier 2 round-robin quota algorithm and billing-cycle reset verbatim. Story 3.9 is narrowed from "implement the algorithm" to "verify its observable multi-subscriber behavior end-to-end," avoiding two stories owning the same logic. |
| **3.10** | Simple correction — add `Depends on: Story 0.15` (0.15's own Note already names 3.10 as a consumer; 3.10 never stated it back). No infra gap. |

## Other findings (FR-coverage gaps, not architecture gaps — flagged for PM awareness, no prerequisite story proposed)

- FR30/FR31 (feed search + filter-by-account) have no owning story beyond display (Story 3.7).
- FR23 (real-time queue-status display in user menu) has no owning story.
- FR34/FR35/FR36/FR37 (reactive key validation, consecutive-invalid-attempt email, key-fallback-on-invalid, push-notification suppression for invalid-key accounts) are largely uncovered. FR36 is partially covered by Story 0.13's fall-through behavior; FR34/35/37 have no owning story anywhere, despite Story 0.15's own Note already promising FR35's invalid-key email as a consumer.
- `/settings/api-keys` (UX-DR9) has no dedicated "manage API keys" story outside first-run onboarding (Story 3.1).

These are epic-breakdown/FR-coverage concerns for `bmad-create-epics-and-stories`/PM follow-up, not Gate 1/Gate 3 architecture-completeness violations — no prerequisite story is proposed for them here.

## New Prerequisite Stories Added

**None.** Unlike the Epic 0 and Epic 1 sweeps, every gap found here was resolvable via AC corrections to stories that already have their backing infrastructure in place (0.8, 0.13, 0.14, 0.15, 0.17, 1.1, 1.3a). This is expected — Stories 0.13–0.17 were explicitly built in anticipation of Epic 3's needs.

## AC Corrections Applied Directly to `epics.md`

- **Story 3.1:** added two bullets — API key persisted via backend GraphQL mutation with KMS encryption on write (Stories 0.8/0.14/0.17); first subscription persisted via the same mutation layer, not a direct DB write.
- **Story 3.2:** added bullet — subscription saved via backend GraphQL mutation (Stories 0.8/0.17), not a direct DB write.
- **Story 3.3:** added bullet — default location persisted via the same backend mutation as Story 3.2, not a direct DB write.
- **Story 1.3a** (Epic 1): added bullet — resolver extended to filter events by `sourceSocialMediaAccountId` scoped to the current user's subscriptions (Story 0.17), for Story 3.7's reuse.
- **Story 3.7:** added bullet — events fetched via backend GraphQL API (Story 1.3a), scoped to the user's subscribed accounts, not directly from the database.
- **Story 3.8:** added `Depends on: Story 0.12, Story 2.9`.
- **Story 3.9:** AC replaced — narrowed from reimplementing the quota algorithm to verifying Story 0.13's existing algorithm's observable multi-subscriber behavior end-to-end; added a `Note:` explaining the Gate 1 duplication finding and a `Depends on: Story 0.13` line.
- **Story 3.10:** added `Depends on: Story 0.15`.

No `sprint-status.yaml` changes were needed — no new backlog stories were created.
