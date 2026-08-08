# Story 3.4b: BYOK-pooled scraper-vendor keys (legally gated, optional)

## Story Details

- Epic: 3
- Story ID: 3.4b
- Status: backlog

## LEGAL GATE — READ BEFORE DOING ANYTHING ELSE WITH THIS STORY

**This story is not implementation-ready and must not be moved to `ready-for-dev` (via `bmad-create-story` or otherwise) until written confirmation is obtained from both Apify and Bright Data**, using the outreach emails drafted in Dev Notes below (or your own, covering the same questions). This is a real legal/business-risk question about third-party Terms of Service, not an engineering judgment call — automated research during Story 3.4's creation found genuine, unresolved ambiguity for both vendors (see "ToS Research Recap" below) and could not resolve it either way. Do not build around an assumption here.

If you have already obtained written vendor confirmation, update this section (and the Completion Status) to record what was said, by whom, and when, before proceeding to the conditional Acceptance Criteria below.

## Story

As a system,
I want individual users to optionally contribute their own Apify/Bright Data account's API key — pooled and round-robined the same way Gemini BYOK keys already are (Story 0.13) — as an alternative or supplement to the single app-funded Apify account (Story 3.4),
so that total scraping headroom can scale with community contribution instead of being capped by one centrally-funded account's free tier.

## Acceptance Criteria

**All of the below are conditional on the Legal Gate above being cleared. None should be implemented until then.**

1. **Given** written confirmation has been obtained that this pattern is permitted by a vendor (Apify and/or Bright Data, independently — one vendor confirming does not imply the other has), **when** a user opts to contribute their own key for that vendor, **then** the existing `api_keys` table/UI (Story 3.1b's `/settings/api-keys` page, `createApiKey`/`deleteApiKey` mutations) is extended to accept that vendor as a new `provider` value, rather than building a parallel key-management surface.
2. **And** the scraper adapter's key-selection logic reuses Story 0.13's existing `selectApiKey`/tier-based fairness algorithm (Tier 1 single-contributor, Tier 2 shared round-robin) generalized to a pooled-key resource, rather than reinventing selection/fairness logic specific to scraping.
3. **And** the app-funded key (Story 3.4/3.4a) remains available as a baseline/fallback for accounts with zero contributing users, rather than scraping simply not running for those accounts.
4. **And** whatever usage-consent/disclosure language the confirming vendor(s) required (per the Legal Gate outreach) is surfaced to the contributing user at the point they add their key — e.g. if a vendor requires the user to acknowledge their data may be used to serve other app users, that acknowledgment is captured, not assumed.
5. **And** the per-vendor capacity-gating mechanism from Story 3.4 (`scraper_provider_usage`) is extended to track pooled/contributed keys' usage distinctly from the app-funded key's usage, so a contributing user's own key exhausting its quota doesn't incorrectly block the app-funded fallback (or vice versa).

*Full task breakdown, Dev Notes, and Implementation Plan detail intentionally left light here — the concrete design (which vendor(s) actually permit this, what consent/disclosure they require, whether a partner account type is needed instead of individual accounts) depends entirely on the vendor responses this story is gated on. Re-run `bmad-create-story 3-4b` for a fully detailed story once the Legal Gate clears, rather than treating this file's current level of detail as sufficient for `dev-story`.*

## Tasks / Subtasks

- [ ] Task 1 (the only actionable task right now): Send the vendor outreach emails below (or equivalent), obtain **written** responses, and record them in this file's Legal Gate section. Do not proceed to any other task until this is done.
- [ ] Task 2+ (blocked, sketch only, to be detailed by a future `bmad-create-story 3-4b` run once gated): extend `api_keys`/`/settings/api-keys` for the confirmed vendor(s); generalize Story 0.13's `selectApiKey` for a pooled scraper-key resource; wire the scraper adapter(s) to select from the pool with app-funded fallback; extend `scraper_provider_usage` tracking per contributed key; surface any vendor-required consent/disclosure UI.

## Dev Notes

### ToS Research Recap (from Story 3.4's creation, 2026-08-08)

- **Apify:** Section 5.2 of Apify's Terms and Conditions prohibits sublicensing — exact language: *"sublicense, transfer, or assign any rights or obligations under the license, in whole or in part, to third parties."* A pooled-BYOK model (using User A's key to serve data also shown to Users B/C/D, not just A) is a plausible fit for what "sublicensing to third parties" means, though it is not explicitly named as prohibited. Genuinely ambiguous on the text alone. (One point of reassurance: Apify's Section 4.3 "no multiple Personal Accounts, even under different emails" clause targets one person creating duplicate accounts — it does **not** restrict many different real users each having their own single account, so that separate concern doesn't apply here.)
- **Bright Data:** No explicit sublicensing clause found, but every new account undergoes mandatory **KYC (Know Your Customer)** vetting, and Bright Data states it actively monitors for "any activity that doesn't align with the customer's declared use case." A contributing user's individually-declared use case (presumably personal/individual) may not match how their key would actually be used (serving data to other app users too) — a real use-case-mismatch risk with a vendor that explicitly says it watches for this.
- Neither vendor's publicly available terms/docs explicitly permit **or** explicitly forbid this specific pattern. This is why direct outreach is required rather than proceeding on inferred-from-terms-pages judgment.

### Vendor Outreach — Email Drafts

Send both (they are independent; one vendor confirming does not imply the other has). Replace `[Name]`/`[FestDaily]` placeholders as appropriate. Keep a copy of the response (screenshot, forwarded email, or support-ticket link) for this story's record.

---

**To: Apify (via their support/sales contact form or account manager)**
**Subject: Question about permitted use — user-contributed API keys used within a multi-tenant application**

> Hi Apify team,
>
> I'm building FestDaily, an event-discovery app where users subscribe to public social media accounts to have new posts checked for event information. I'd like to let individual users optionally contribute their own Apify account's API token (in addition to a token our application itself pays for) so scraping calls for accounts they're interested in can run under their own account rather than solely under ours.
>
> The part I want to confirm before building this: the data returned by a call made using User A's token may be shown to other users of our app who are also "subscribed" to the same public account — not exclusively to User A. Section 5.2 of your Terms and Conditions prohibits sublicensing, transferring, or assigning rights under the license to third parties, and I want to make sure this pattern doesn't fall under that restriction before we build around it.
>
> Could you confirm:
> 1. Does using an individual customer's API token, within a third-party application, to fetch data that may also be displayed to other end-users of that application (not just the token owner), constitute prohibited sublicensing under Section 5.2?
> 2. If so, is there an approved partner/reseller program or account type that would permit this pattern?
> 3. Are there any restrictions, requirements, or best practices (e.g. required disclosures to the contributing user, usage caps) you'd want in place if this pattern is acceptable?
>
> We'd be using the `apify/instagram-scraper` actor specifically. Happy to share more detail about our exact use case if useful.
>
> Thank you,
> [Name]

---

**To: Bright Data (via their sales/support contact form or account manager)**
**Subject: Clarification on declared use case — API key used within a third-party multi-tenant application**

> Hi Bright Data team,
>
> I'm building FestDaily, an event-discovery app where users subscribe to public social media accounts to have new posts checked for event information. I'm considering letting individual users optionally sign up for their own free Bright Data account and contribute their API key so our application can use it to scrape data related to accounts that specific user is interested in.
>
> I understand new accounts go through a KYC process where the customer declares an intended use case, and that Bright Data monitors for activity that doesn't align with the declared use case. The scenario I want to confirm before building around it: the contributing user's own declared use case would presumably be personal/individual, but their key would be used within a shared, multi-tenant application, and the resulting data could be shown to other users of that application (not exclusively the key's owner) who are also interested in the same public account.
>
> Could you confirm:
> 1. Does this pattern — an individually-KYC'd account's key used within a third-party multi-tenant application, where scraped data may be shown to other users of that application — require a different declared use case, a different account type, or a partner/reseller agreement?
> 2. What use-case description should an individual contributing user provide during KYC for this to be compliant?
> 3. Is there a business/partner account type intended for an application that pools multiple individually-owned accounts' usage this way?
>
> We're specifically looking at the Instagram posts-discovery capability. Happy to provide more detail about our exact use case if useful.
>
> Thank you,
> [Name]

---

### Vendor Responses (fill in once received)

- **Apify:** *(not yet contacted / awaiting response / response received — record date, respondent, and summary here)*
- **Bright Data:** *(not yet contacted / awaiting response / response received — record date, respondent, and summary here)*

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.4b] — this story's epics.md section and its Note recording the same research recap.
- [Source: _bmad-output/implementation-artifacts/3-4-scrape-new-posts-from-subscribed-accounts.md] — Story 3.4, the app-funded baseline this story would extend, and the source of the original ToS ambiguity finding.
- [Source: apps/backend/src/lib/ai-gateway/adapter.ts, select-api-key.ts (packages/domain)] — Story 0.13's existing BYOK key-pool/fairness algorithm this story's AC2 proposes generalizing, once/if legally cleared.
- [Source: apps/backend/src/lib/subscriptions (Story 3.1b), packages/database/schema.ts `api_keys`] — the existing key-management table/UI this story's AC1 proposes extending rather than duplicating.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Security (BYOK key handling precedent, Story 0.13); this story's actual code changes (once/if gated) would follow the same encryption-at-rest/KMS pattern already established for Gemini keys.
- [x] `story-content-structure.md` — canonical section order followed, with the Legal Gate called out explicitly ahead of the Acceptance Criteria as this story's dominant constraint.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — not yet applicable in detail; a full pass is deferred to the future fully-detailed `bmad-create-story 3-4b` run once gated.
- [x] `docs/infrastructure/index.md` — no infra change from this file; any real infra impact is deferred to the future detailed story.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **None yet.** No code changes are in scope until the Legal Gate clears. The only concrete deliverable of this version of the story is the outreach itself (Task 1) and this file's record of the vendor responses.

### Rule Mapping

- Legal/business-risk questions must be resolved by the user directly with the vendor, not inferred from automated ToS research → this story's own Legal Gate → Task 1.
- Reuse over reinvention (existing `api_keys` table/UI, Story 0.13's key-pool algorithm) → sketched in AC1/AC2 for whenever this unblocks, so a future detailed pass doesn't reinvent BYOK infrastructure that already exists for Gemini.

### Verification Plan

- Task 1's "done" condition is a written vendor response on file for each vendor being pursued (screenshot/forward/ticket link), not a test or build step.
- No automated verification applies until the Legal Gate clears and a future `bmad-create-story 3-4b` run produces real tasks/tests.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this version of the story's only in-scope deliverable is vendor outreach and recording the responses; no code is written under this story until the Legal Gate clears.
- [ ] Architecture and boundary confirmation: N/A until gated — deferred to a future detailed pass.
- [ ] Testing plan confirmation: N/A until gated.
- [ ] Explicit human approval state (Default: **pending approval** — approval here means "send the outreach emails," not "start coding").
- [ ] **Legal Gate is the prerequisite** — this story must not be marked `ready-for-dev` until both vendor responses are on file (or the user explicitly decides to proceed with only one vendor's confirmed permission, dropping the other).

## Testing Requirements

- [ ] None applicable yet — no code in scope. A future detailed `bmad-create-story 3-4b` run will define real testing requirements once the design is known (which depends on the vendor responses).

## Deliverables Checklist

- [ ] Apify outreach email sent.
- [ ] Bright Data outreach email sent.
- [ ] Both responses recorded in this file's "Vendor Responses" section (or a documented decision to proceed with only one, or neither).

## Out of Scope

- Any actual code implementation — deferred to a future, fully-detailed `bmad-create-story 3-4b` run once the Legal Gate clears.
- Extending Story 3.4a (Bright Data batch-priority adapter) with BYOK pooling — that adapter doesn't exist yet either; this story's scope is the legal question first, for either/both vendors.
- Proceeding on the basis of this story's own ToS-page research alone — that research is exactly what motivated the Legal Gate, not a substitute for it.

## Definition of Done

- [ ] Both outreach emails sent.
- [ ] Both vendor responses (or explicit non-response after a reasonable follow-up window) recorded in this file.
- [ ] A clear go/no-go/partial (one vendor only) decision recorded, with the reasoning, before this story is ever moved to `ready-for-dev`.

## Completion Status

- [ ] Not started (outreach not yet sent)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
