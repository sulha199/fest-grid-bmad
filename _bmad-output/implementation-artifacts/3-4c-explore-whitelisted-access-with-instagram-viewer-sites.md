# Story 3.4c: Explore sanctioned/whitelisted access with Instagram-viewer sites (exploratory, optional)

## Story Details

- Epic: 3
- Story ID: 3.4c
- Status: backlog

## STATUS — EXPLORATORY OUTREACH ONLY

This story is not implementation-ready. Unlike Story 3.4b (which is blocked on a legal yes/no), this one is blocked on whether a **workable business offer exists at all** — there may be no reply, no free/cheap tier, or terms that don't fit an MVP-stage budget. No adapter code should be written under this story until a concrete offer is on the table and evaluated as actually worth building against (cost, reliability, and whether it covers "get an account's recent posts," not just single-item downloads).

## Story

As a system,
I want to explore whether any of the Instagram-viewer/proxy sites identified during Story 3.4's research (storiesig.info, mollygram.com, imginn.com) would grant sanctioned API/whitelisted access — offering attribution/backlink exposure in exchange — as a possible lower-cost or higher-quality alternative or supplement to the app-funded Apify adapter (Story 3.4),
so that the scraping pipeline has another option evaluated, without committing engineering effort until a concrete offer exists.

## Acceptance Criteria

**All of the below are conditional on receiving a workable offer. None should be implemented until then.**

1. **Given** a vendor (storiesig.info, mollygram.com, and/or imginn.com) responds with concrete API-access terms, **when** those terms are evaluated, **then** the decision to build an adapter against them is based on: (a) does it actually cover "fetch an account's recent posts by username," not just single-item lookups/downloads (mollygram's likely shape problem, confirmed during Story 3.4's research); (b) is the cost/rate-limit workable at MVP scale (comparable to or better than Apify's ~1,852 free records/month); (c) is the access explicitly sanctioned in writing, not a gray-area continuation of the unauthenticated `403`-blocked access already found for `imginn.com`, or the CAPTCHA-gated endpoint already rejected for `storiesig.info`, during Story 3.4's creation.
2. **And** if a workable offer exists, the resulting adapter follows the exact same `ScraperAdapter` interface (Story 3.3c) and registration pattern Story 3.4 established for Apify — this is a third adapter option, not a redesign of the registry/dispatch mechanism.
3. **And** if the vendor's offer includes an attribution/backlink request (per this story's own outreach offering that in exchange), the implementation includes whatever attribution is agreed to (e.g. a credit line or link on the public per-account event page, Story 3.11) — scoped and confirmed with the user once real terms exist, not assumed from this draft.

*As with Story 3.4b, full task breakdown and Implementation Plan detail are intentionally deferred — the concrete design depends entirely on what, if anything, comes back from outreach. Re-run `bmad-create-story 3-4c` for a fully detailed story once a workable offer exists.*

## Tasks / Subtasks

- [ ] Task 1 (the only actionable task right now): Send the outreach email below to storiesig.info and to imginn.com. Optionally send the shorter mollygram inquiry too (lower priority — see "Why mollygram is lower priority" below). Record whatever comes back in this file's "Vendor Responses" section.
- [ ] Task 2+ (blocked, sketch only): build the adapter against whatever concrete terms are received, following Story 3.4's Apify adapter as the structural template (fetch/parse or REST call → map to `ScrapedPost[]` → register against Story 3.3c's registry) — to be detailed by a future `bmad-create-story 3-4c` run.

## Dev Notes

### Research Recap (from Story 3.4's creation, 2026-08-08/09)

- **storiesig.info:** Its API is CAPTCHA-gated when accessed without authorization (confirmed via a real captured-request replay during Story 3.4's creation — `422 CAPTCHA_REQUIRED`), and its Terms of Use explicitly prohibit automated/commercial access without permission. However, its own **API FAQ page explicitly invites contact for official access**: *"To get access or get more information contact us at [email]."* This is a materially different, lower-risk path — sanctioned access sidesteps the ToS prohibition rather than violating it. No pricing/rate-limit information is published; this is a contact-and-negotiate model.
- **mollygram.com:** Terms of Service contain no explicit scraping/API/commercial-use prohibition, and the site "reserve[s] the right to charge for its services... at any time and for any reason" (implying a paid tier could exist or be negotiable). However, the site's actual product is a single-item story/post/reel **downloader** (paste one URL, get one download), not a persistent per-account post feed — confirmed during Story 3.4's own research (attempting `/profile/{username}`-style URLs consistently 404'd; the site's own 404 page describes itself as an "Anonymous Instagram Story Viewer"). Even with full sanctioned access, this likely does not solve "fetch an account's recent posts by username."
- **imginn.com:** A direct fetch of `imginn.com` returned `403 Forbidden` during Story 3.4's creation (likely bot-detection at the edge, not an application-level block), but the user separately retrieved the site's public FAQ/About/Privacy Policy content directly. Findings: this **is** the right shape (a per-username profile/post viewer, unlike mollygram) — their own FAQ describes searching a username and browsing/downloading that account's public photos, videos, Stories, and Reels. Their "About" section states plainly: *"imginn.com is an online instagram backup tool that helps users save instagram photos through the instagram public API"* — i.e. imginn.com itself operates by calling Instagram's own (undocumented/unofficial) public-facing API, not a licensed data feed of their own; a partnership with them would be one layer removed from Instagram itself, not a step closer to an official source. Unlike storiesig.info, **no dedicated developer/API/partnership channel is advertised** — the only contact point found is a generic Privacy Policy "Contact Us" email (`imginn.com@gmail.com`), scoped in context to privacy questions and content-removal requests ("If you do not wish to be downloaded, please submit your information remove account"), not business inquiries. Their FAQ's legality answer ("respect Instagram's terms of service and copyright laws") is about end users of their free tool, not about third parties requesting programmatic access to imginn.com itself — it does not address our use case either way.

### Why mollygram is lower priority, and imginn.com is a longer shot

Given the shape mismatch, mollygram outreach is optional/lower-value — worth a low-effort inquiry only if the other two don't pan out. No draft below; if pursuing it, ask directly and early whether they have *any* per-account/profile post-listing capability (not just single-item download) before going further.

imginn.com is the right shape (unlike mollygram) but has no advertised partnership channel (unlike storiesig.info) — the outreach below is a cold inquiry to a generic contact address, not a response to an explicit invitation, so expectations should be set lower than storiesig.info despite the better shape-fit.

### What Not to Disclose (idea-protection guidance)

These sites already have direct access to the raw Instagram post data we'd be requesting — that's the entire service they run. The part of this product that has real value is what happens *after* the raw data is fetched (AI-based event-information extraction, aggregation across accounts, the discovery/calendar experience), not the fetching itself. When reaching out:

- **Do** describe the need functionally: periodic, structured access to recent public posts (caption text, media URL, timestamp) for a list of accounts specified by end-users of an application.
- **Do not** mention AI/Gemini-based event extraction, "event discovery," or describe the product's actual end-user value proposition in detail — there's no reason to hand a potential future competitor (one who already sits on the data source) the idea of what to build on top of it.
- **Do not** share the app's name, domain, or marketing materials in the initial inquiry unless/until terms are far enough along that a real partnership is being negotiated — a generic project description is sufficient to get a pricing/terms conversation started.
- If asked directly what the data is used for, a truthful-but-generic answer such as "content aggregation and organization for an application's users" is sufficient at this stage.
- **Send from a dedicated, non-personal email address — not a project-branded one either.** An address like `festdailyapps@gmail.com` fixes the *personal-identity* leak (not traceable to a real name or a public GitHub commit-email trail) but reopens the *brand* leak this section otherwise avoids — a recipient doesn't need to link the email to a person at all if the address itself names the product; they can just search the brand name directly. Use a fully generic address unrelated to the project name (e.g. an address built from unrelated words, not "festdaily"/"festgrid" or any variant). Before using any address for this outreach, confirm it is not the email listed on a public GitHub profile and has never been used as `git config user.email` on a commit pushed to a public repo — both are common, well-known ways an email gets linked back to a specific GitHub account and, from there, to whatever that account has made public.
- **Reality check, since the project's GitHub repo (`festgrid`) is confirmed public (2026-08-09):** the outreach-email hygiene above raises the bar against a recipient *easily and directly* connecting an inbound email to this specific project, but it does not achieve real secrecy — a public repo named `festgrid`/referencing "FestDaily" is independently discoverable by anyone who searches GitHub for either name, entirely separately from any email sent. If genuine confidentiality of the AI-extraction concept matters more than the portfolio value of a public repo, that is a repo-visibility decision to make deliberately (e.g. keeping planning/strategy docs out of the public repo even if code stays public) — it is not something outreach-email wording alone can solve, and this story does not recommend a specific choice on it either way.

### Possibility vs. Risk (subjective estimate, not researched fact — for planning judgment only)

| | Chance of any reply | Chance of workable (free/cheap) terms | Legal/ToS risk if granted | Actually solves our need |
|---|---|---|---|---|
| storiesig.info (official API contact) | ~60-70% | ~20-30% (sites like this typically monetize API access as real revenue; may not fit an MVP budget) | Low — sanctioned, in writing | Yes, if terms are workable |
| imginn.com (cold inquiry, no advertised channel) | ~25-35% (generic privacy/removal contact address, not a business-inquiry channel — lower reply odds than a site that explicitly invites this) | ~15-25% if they do reply (an ad-supported free tool with no visible monetized-API business line may simply have nothing to offer, or may decline since their own operation already depends on an unofficial Instagram API and formalizing a downstream partnership adds visibility they may not want) | Low if explicitly granted in writing; **note their own operation already relies on Instagram's unofficial public API**, so even sanctioned access from them sits one layer removed from a fully clean source | Yes, if granted — correct shape (per-username profile/post access, unlike mollygram) |
| mollygram.com (lower-priority inquiry) | ~40-50% | ~30-40% (looser ToS, more negotiating room) | Low — explicit permission | Low, ~15-20% even if granted (wrong shape — single-item downloader, not a feed) |

The larger realistic risk here is not legal (sanctioned access resolves that for whichever vendor grants it) — it's spending outreach time for no reply, or pricing that doesn't fit a bootstrapped MVP, and mollygram specifically not being useful even in the best case. imginn.com is the best-shaped candidate of the three but the least likely to have a formal channel to say yes through.

### Vendor Outreach — Email Draft

**To: storiesig.info (via the email address listed on their API FAQ page)**
**Subject: API access inquiry — periodic structured post data for public accounts**

> Hello,
>
> I'm building an application that helps users track and organize content from public social media accounts they follow, and I'm interested in your API for periodic, structured access to recent posts (caption, media URL, and timestamp) for accounts our users specify.
>
> Could you share:
> 1. Pricing and rate limits for API access at a small/early-stage scale (a modest number of accounts, checked roughly once per day)?
> 2. Whether the API supports fetching an account's most recent posts by username, and whether it supports a "posts newer than X date" filter to avoid re-fetching already-seen content?
> 3. Any requirements or restrictions on how the data may be used or displayed?
>
> As a smaller/early-stage project, I'd also be glad to provide attribution or a backlink to your service from any public pages we build that surface data sourced through your API, if that's of interest as part of the arrangement.
>
> Thank you,
> [Name]

**To: imginn.com (`imginn.com@gmail.com` — general contact address, not an advertised business/API channel; set expectations accordingly)**
**Subject: Business inquiry — API/partnership access for periodic post data**

> Hello,
>
> I'm reaching out about a possible business/API partnership rather than a content-removal or privacy question. I'm building an application that helps users track and organize content from public social media accounts they follow, and I'm interested in whether imginn.com offers (or would consider) sanctioned, programmatic access to public profile/post data — specifically, periodic structured access to an account's recent posts (caption text, media URL, and timestamp) for accounts our users specify.
>
> If this is something you're open to, could you share:
> 1. Whether any form of API or bulk/programmatic access is available, and if so, pricing and rate limits at a small/early-stage scale.
> 2. Whether such access would support fetching an account's most recent posts by username, and a "posts newer than X date" filter.
> 3. Any requirements or restrictions on how the data may be used or displayed.
>
> As a smaller/early-stage project, I'd also be glad to provide attribution or a backlink to imginn.com from any public pages we build that surface data sourced this way, if that's of interest.
>
> If this isn't something imginn.com offers or if this is the wrong contact channel for this kind of inquiry, I'd appreciate being pointed in the right direction.
>
> Thank you,
> [Name]

### Vendor Responses (fill in once received)

- **storiesig.info:** *(not yet contacted / awaiting response / response received — record date, respondent, terms, and pricing here)*
- **imginn.com:** *(not yet contacted / awaiting response / response received — record date, respondent, terms, and pricing here)*
- **mollygram.com:** *(not contacted / not yet contacted / awaiting response / response received — record date, respondent, and summary here)*

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.4c] — this story's epics.md section and its Note recording the same research recap.
- [Source: _bmad-output/implementation-artifacts/3-4-scrape-new-posts-from-subscribed-accounts.md] — Story 3.4, the app-funded Apify baseline this story would supplement or offer an alternative to; source of the original `403`/CAPTCHA/ToS findings for `imginn.com` and `storiesig.info`, and the shape-mismatch finding for `mollygram.com`.
- [Source: _bmad-output/implementation-artifacts/3-4b-byok-pooled-scraper-vendor-keys.md] — the sibling exploratory/gated story this one's structure and status conventions mirror.
- [Source: https://storiesig.info/en/api-faq/, https://mollygram.com/tos] — directly fetched during this story's creation; source of the API-contact invitation and the ToS findings above.
- [Source: imginn.com's FAQ, About, and Privacy Policy pages] — direct fetch of `imginn.com` returned `403 Forbidden` during this story's creation; content instead supplied directly by the user from the live site (FAQ, "About" section, and Privacy Policy's "Contact Us"), since automated fetch was blocked. Source of the "instagram public API" self-description and the `imginn.com@gmail.com` contact address.

## Global Rules References

- [x] `_bmad-output/project-context.md` — no code changes yet; a future detailed pass would follow the same Adapter Pattern (`ScraperAdapter`, Story 3.3c) as Story 3.4's Apify adapter.
- [x] `story-content-structure.md` — canonical section order followed, with the exploratory status called out ahead of the Acceptance Criteria.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — not yet applicable; deferred to a future detailed pass.
- [x] `docs/infrastructure/index.md` — no infra change from this file.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **None yet.** No code changes are in scope until a workable offer exists. The only concrete deliverable of this version of the story is the outreach itself (Task 1) and this file's record of the response(s).

### Rule Mapping

- Reuse over reinvention (Story 3.3c's `ScraperAdapter` interface/registry, Story 3.4's adapter-registration pattern) → sketched in AC2 for whenever this unblocks, so a future detailed pass builds a third adapter option the same way, not a bespoke mechanism.
- Idea-protection / competitive-risk awareness → this story's own "What Not to Disclose" section, informing how Task 1's outreach is actually worded.

### Verification Plan

- Task 1's "done" condition is outreach sent and any response recorded, not a test or build step.
- No automated verification applies until a workable offer exists and a future `bmad-create-story 3-4c` run produces real tasks/tests.

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this version of the story's only in-scope deliverable is outreach and recording the response(s); no code is written under this story until a workable, concrete offer exists.
- [ ] Architecture and boundary confirmation: N/A until then — deferred to a future detailed pass.
- [ ] Testing plan confirmation: N/A until then.
- [ ] Explicit human approval state (Default: **pending approval** — approval here means "send the outreach email," not "start coding").
- [ ] A workable offer (pricing/terms that fit the project's scale, and confirmed to cover per-account post listing, not just single-item lookup) is the prerequisite for moving this story to `ready-for-dev`.

## Testing Requirements

- [ ] None applicable yet — no code in scope. A future detailed `bmad-create-story 3-4c` run will define real testing requirements once (and if) concrete terms exist.

## Deliverables Checklist

- [ ] storiesig.info outreach email sent.
- [ ] imginn.com outreach email sent.
- [ ] mollygram.com inquiry sent (optional, lower priority).
- [ ] Any response(s) recorded in this file's "Vendor Responses" section, or a documented decision to abandon this avenue after a reasonable follow-up window.

## Out of Scope

- Any actual adapter code — deferred to a future, fully-detailed `bmad-create-story 3-4c` run once a workable offer exists.
- Continuing to probe or work around either site's *unauthenticated* access (CAPTCHA bypass, URL-guessing) — already explicitly rejected during Story 3.4's creation and unaffected by this story, which only pursues sanctioned access.
- Any commitment to attribution/backlink terms — this story's outreach only *offers* the possibility; actual terms are confirmed with the user once/if a real negotiation is underway.

## Definition of Done

- [ ] Outreach sent to storiesig.info and imginn.com (and optionally mollygram.com).
- [ ] Response(s), or an explicit non-response after a reasonable follow-up window, recorded in this file.
- [ ] A clear go/no-go decision recorded, with reasoning (cost, shape-fit, sanctioned-in-writing), before this story is ever moved to `ready-for-dev`.

## Completion Status

- [ ] Not started (outreach not yet sent)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
