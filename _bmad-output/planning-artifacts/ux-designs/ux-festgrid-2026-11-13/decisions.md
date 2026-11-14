# Decisions: Epic 10 job screens

Companion to `EXPERIENCE.md`. Written headless: where bmad-ux would have asked the owner, the most conservative option that
reuses existing components and tokens was taken and is listed here so the owner can overrule it.

## Design choices for the owner to confirm

1. **The Jobs list pages with the shared Previous/Next controls, not infinite scroll.** Story 10.4 (Jobs page and inline job progress component) and AD-18 (Filter Apply-Timing Convention, list pagination rule) require `useListPaginationController` and `PaginationControls`, while PRD FR123 (Jobs Page and Inline Progress) says "infinite scroll"; I recommend following the story and the rule, and amending the PRD wording to "paged".
2. **The page has two sections: "In progress" (open jobs, not paged) above "Finished" (paged), and status looks reuse `StatusBadge` through a mapping with no new variants.** I recommend this because a phone user wants running jobs first without scrolling past history, and no new badge colours are needed.
3. **The progress shows as a chip at the place the action started, and the chip is found again from the server, never from browser storage.** The dialog opens by itself only after the user's own start, a reload or another device shows the chip, and I recommend this because it meets FR123 (re-open at last progress on any device) with no browser memory.
4. **A job has its own page at `/jobs/{id}`, and "Jobs" (Indonesian "Tugas") is a profile-menu entry after Account Settings, not a sixth main-navigation item.** I recommend this so a push notification and a list row can link to one job, and the five-item navigation stays as it is.
5. **The Upgrade button is a small reusable `UpgradeCta` primitive in `packages/ui/src/core`, composed by `SubscriptionCapNotice` (the answer to Story 10.3a's (subscription cap refusal) Gate 2).** I recommend yes because PRD sections 6 and 8 already name more paid surfaces, and the "coming soon, but clickable so interest is recorded" behaviour should be defined once.
6. **The cap notice appears only after the server refuses (inline in the subscribe dialog and wizard, in a small dialog on the account page and for a restore), with no pre-check count query.** I recommend this because it is exactly what Story 10.3a asks for and adds no endpoint; a live count can follow if it is wanted.
7. **Analytics: the two cap events carry the PRD's two properties plus `reservedCount`, `cap` and `surface`, and Story 10.4 and Story 10.6a (Re-extract progress, missing-images banner and Retry) share four small optional events (`job_progress_minimized`, `job_progress_reopened`, `job_retry_clicked`, `jobs_filter_changed`).** I recommend adding the extra cap properties (they are additive and answer "how full were they"), sending `accountId` only when it is known, and accepting the four job events, none of which carry a handle, URL, caption or vendor.
8. **Reason text comes from the reason code and is translated; the engine's English message is shown only to moderators in "Technical details".** I recommend this because the stored message is English-only and an ordinary user must never see a vendor name or raw error (FR123).
9. **There is no Cancel button in this scope.** A user cancel exists on the server (`cancelJob`) but no PRD line asks for a button; I recommend leaving it out now and adding "Cancel" for Queued jobs only later, because a queued job has no vendor call to stop.
10. **The Re-extract banner names the missing images ("Not read: the cover and slides 3 to 5"), which needs the job to report one entry per image.** I recommend asking for `images[]` (position, role, state, no URLs) in the Story 10.6 (move the moderator re-extract rescrape onto the engine) result; if that is too much, the fallback is counts only ("3 of 5 images were read") with the same cause sentence and Retry.
11. **Re-extract from the Jobs page opens the same preview dialog attached to that job, and closing the dialog no longer discards the job (the Post URL tab uses the same host).** I recommend this because the PRD requires "re-open at last progress ... from the Jobs page" without restarting, and today `reset()` forgets the job on close.
12. **A carousel with more slides than the preview cap gets its own banner line ("Only the first 10 slides are read in a preview") with no Retry.** I recommend it because today's single amber line cannot tell a cap from a failed refresh, and a Retry that cannot help would mislead.

## Open decisions that stay with the owner

| # | Decision | Why it is not decided here | Where it touches this design |
|---|---|---|---|
| 1 | **OI-2 (the lookup fallback flow for a vote), D1: are lookup requests kept durably (a new table), or polled only on the open page?** | Owner decision, to be made through bmad-ux before Story 10.4 and Story 10.7 (move subscribe and profile lookup onto the engine) (PRD 3.18). | `PROFILE_LOOKUP` jobs only outlive the page if durable. The sentence "You can leave this page" (`Jobs.lookup.leaveNote`) is a placeholder marked `[OPEN D1]` and is not rendered. Slot `SLOT-D1` in EXPERIENCE.md. |
| 2 | **OI-2, D3: the time budget of the interactive attempt, and so when the inline view says "Still looking" and hands off to a pending row.** | Owner decision; the audit rows needed to measure it are still collecting. | The slow-state text (`Jobs.lookup.slow`) takes its threshold as a parameter, with none set, and is not rendered. Slot `SLOT-D3`. |
| 3 | **OI-2, D4: does a vote apply by itself when the lookup resolves (with an undo), or does the user confirm?** | Owner decision. | The outcome box of a vote-originated lookup: "Your vote was counted" versus "Confirm your vote", and whether an Undo shows. Keys `Jobs.lookup.voteCounted`, `voteConfirm`, `voteUndo` are placeholders marked `[OPEN D4]`. Slot `SLOT-D4`. |
| 4 | **What the Upgrade button leads to once a paid plan exists, and what the "coming soon" wording promises.** | There is no paid tier; PRD Section 6 only defines the coming-soon state. | The note says plans are "not available yet" and promises nothing (no "we will tell you"). Changing it later is a copy change. |
| 5 | **How many production users already hold more than the cap of 5 (design notes decision 20: "check it before deploying").** | A production fact the design cannot know. | The notice shows the real numbers ("You have 7 accounts added. The limit is 5.") and never removes anything. If many users are above the cap the owner may want gentler wording. |
| 6 | **Which owner label a moderator sees on a job ("Started by {name}").** | A privacy call. I proposed the display name only (no email, no id). | `Job.owner { displayName }`, moderator only. |
| 7 | **PRD OI-3 (whose vendor credential a job uses) and PRD OI-4 (whether correction jobs move onto the engine's table).** | OI-3 is the owner's legal gate; OI-4 is the architect's, decided in Story 10.9 (move AI-assisted correction onto the engine). | No visible effect: vendor and credential never appear to an ordinary user, and the Jobs list shows correction jobs either way. Slots `SLOT-OI3`, `SLOT-OI4`. |

## Choices taken non-interactively (conservative defaults, for the record)

| Where bmad-ux would ask | What was chosen | Why |
|---|---|---|
| Working mode | Fast path: draft both spines with a delta on the existing ones, creative tools off | Headless; the repo already has base spines |
| Mocks | None rendered; every surface is spine-only | Headless; layouts reuse existing components, so a spine table is enough. A reviewer who wants a mock can ask for the three key screens (list, dialog, banner). |
| New spines vs update | A delta spine in a new run folder, inheriting `design-artifacts/UX-festgrid-run-1/` | Keeps the base spines unchanged in this planning pass; a later pass can merge the keepers into them |
| Dialog vs bottom sheet on mobile | The existing `Dialog` | One primitive, already bounded for short screens |
| Floating jobs tray | Not used | Fights the bottom tab bar and the z-index tiers (AD-33, Z-Index Layering Tiers) and the PRD asks for the place the action started |
| Per-type step lists | Proposed in `copy-keys.md` and confirmed by each adoption story (10.7, 10.9, 10.10, 10.11, 10.12, 10.12a) | Only the Re-extract phases exist in code (`refresh`, `preview`) |
| Status naming | Map onto existing `StatusBadge` variants | No new colour tokens |
| Polling | 2 s open dialog, 5 s chip, 10 s list, paused when the tab is hidden, back-off on error | Matches the existing 2 s Re-extract poll; saves battery on a phone |
| Accessibility audit | Not run (reviewer lenses are opt-in and costly); the Accessibility sections of EXPERIENCE.md are the design-time floor | The owner can request an accessibility review lens on the finished spines |
