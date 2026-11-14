---
title: "EXPERIENCE.md: Epic 10 job screens (Stories 10.4, 10.3a, 10.6a)"
status: "final"
created: "2026-11-13"
updated: "2026-11-13"
scope: "A delta spine on design-artifacts/UX-festgrid-run-1/EXPERIENCE.md. It specifies the behaviour of three screen stories of Epic 10 (Background vendor jobs). Where this file and the base spine differ on something it names, this file wins for these screens."
sources:
  - "design-artifacts/UX-festgrid-run-1/EXPERIENCE.md"
  - "_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md (3.18, 3.7, 3.9.3, 3.10, 3.11, 6, FR116 to FR130)"
  - "_bmad-output/planning-artifacts/epics.md (Epic 10: Story 10.4 Jobs page and inline job progress; Story 10.3a subscription cap refusal and upgrade call to action; Story 10.6a Re-extract progress, missing-images banner and Retry)"
  - "_bmad-output/planning-artifacts/background-vendor-jobs-design-notes-2026-11-02.md"
  - "_bmad-output/planning-artifacts/profile-lookup-fallback-and-ux-2026-10-31.md (context only; its decisions D1, D3, D4 stay with the owner)"
companions:
  - "DESIGN.md (tokens)"
  - "copy-keys.md (English and Indonesian copy, by next-intl namespace)"
  - "graphql-read-shape.md (what the screens need from the API)"
  - "decisions.md (design choices to confirm, and open decisions that stay with the owner)"
mode: "Non-interactive (headless). Wherever bmad-ux would ask the owner, the most conservative option that reuses existing components and tokens was chosen and recorded in decisions.md and .memlog.md. No mocks were rendered (creative tools are off in headless mode); every surface is spine-only."
---

# EXPERIENCE.md: Epic 10 job screens

## Foundation

- **Form factor.** Mobile-first responsive web, as the base spine says. The product owner reads on a phone, so every flow below is written for a 320 px wide screen first and widened from there.
- **UI system.** Shadcn/Radix in `apps/web/src/components/ui` plus `@festgrid/ui`. New reusable UI goes to `packages/ui` and receives its text through a `labels` prop (it must not import `next-intl`: project-context, "Scoped locale" and Adapter rules). The `apps/web` side resolves copy with `useTranslations`.
- **Visual identity.** `DESIGN.md` in this folder (delta) over the base `DESIGN.md`.
- **The One Job Rule (FR116 One Job Rule).** A vendor-backed action starts a job and returns at once. These screens never use the full-screen blocking loader for a wait. The inline progress is a dialog the user can minimize.
- **Source of truth is the server (FR123 Jobs Page and Inline Progress).** What a job is doing is read from the job on the server. The browser keeps no copy that matters: after a reload, a navigation or on another device, the same progress is shown. See "Where the progress lives" below.

### Terms used here

| Term | Meaning |
|---|---|
| Place | One of the `MAX_CONCURRENT_JOBS_PER_USER` (default 3) running slots (FR121 Admission Control and Waiting). |
| Queued, Running, Waiting | The three open statuses of FR117 (Lifecycle, Bounded Time and Reasons). Only Running holds a place. |
| Ending | Succeeded, Succeeded with limits, Failed, Expired. "Cancelled" is not a status: it is a Failed job with reason `CANCELLED`, shown with its own neutral look. |
| Chip | The minimized indicator of a job, in flow at the place the action started. |
| Progress view | The one shared component (`JobProgress`) shown as a dialog, as a page panel, or as a chip. |

### Stories and requirement ids used in this file

Story 10.4 (Jobs page and inline job progress component) · Story 10.3a (subscription cap refusal and upgrade call to action) · Story 10.6a (Re-extract progress, missing-images banner and Retry) · Story 10.3 (reuse and admission control to job start) · Story 10.6 (move the moderator re-extract rescrape onto the engine) · Story 10.7 (move subscribe and profile lookup onto the engine) · Story 10.9 (move AI-assisted correction onto the engine) · Story 10.10 (run extract-by-URL as a job) · Story 10.11 (show progress for refresh now) · Story 10.12 (run CLI-only admin batch operations as jobs) · Story 10.12a (run manual post selection as a job) · Story 10.13 (notify when a job finishes) · Story 0.i5a (shared pagination and filter controller) · Story 0.i6a (finish the SubscribedAccountCard and AccountAvatar contract) · AD-7 (Authenticated Context and Authorization) · AD-18 (Filter Apply-Timing Convention, which holds the list pagination rule) · AD-33 (Z-Index Layering Tiers) · AD-34 (Scrape Gate) · AD-40 (Moderator Re-extract Is a Write-Free Preview That Never Keeps a Caption) · AD-53 (The Job Engine) · IDEA-008 (max 5 subscribed accounts) · BUG-099 (re-extract drops carousel slides) · IDEA-261031-nts (profile lookup background phase) · FR116 One Job Rule, FR117 Lifecycle, FR119 Late Results Are Used, FR120 Starting the Same Work Twice, FR121 Admission Control and Waiting, FR122 Reserved Subscription Slots, FR123 Jobs Page and Inline Progress, FR124 Telling the User a Job Has Finished, FR125 Re-extract image refresh, FR130 Who Started a Job.

## Information Architecture

| Surface | Route or place | Who | New or changed |
|---|---|---|---|
| Jobs page (list) | `/jobs` | Any signed-in user; moderator extras | New (Story 10.4) |
| Job detail | `/jobs/{jobId}` | The owner; a moderator for any job | New (Story 10.4) |
| Job progress dialog | Opens over any page | Owner | New shared component (Story 10.4) |
| Job chip | At the place an action started (list below) | Owner | New shared component (Story 10.4) |
| User menu entry "Jobs" | Profile menu, after "Account Settings" | Signed-in | Changed (`profile-menu-entries.ts`): entry `jobs` with a `ListChecks` icon. The finished-since-last-visit `CountBadge` is wired by Story 10.13 (notify when a job finishes), not here. |
| Subscription cap notice | Inline in a form, or in a small dialog | Non-moderator users | New (Story 10.3a) |
| Re-extract progress, banner, Retry | Moderator source-post panel and the Post URL tab of Moderator Tools | Moderator | Changed (Story 10.6a) |

Route decisions: the detail is its own route (not only a dialog) because a push notification and a Jobs row must be able to link to one job (FR124, Story 10.13). `/jobs` is reachable only from the profile menu, like `/reports`; it is not a sixth item of the main navigation (the five-item nav is unchanged). Metadata comes from `generateMetadata` and the `Metadata` namespace (project-context "Dynamic Page Title").

### Where each job type starts, and so where its chip lives

| Job type | Started from | Chip location | Owner story |
|---|---|---|---|
| `REEXTRACT_REFRESH` | Source-post panel row, and Post URL tab (moderator) | In the row, in place of the Re-extract button | Story 10.6a |
| `SUBSCRIBE` | Subscribe dialog, onboarding step, account page | The new row in Subscribed Accounts (as "being added"), the wizard row, or beside the account page toggle | Story 10.7 |
| `PROFILE_LOOKUP` | Vote form | Pending row under the vote form | Story 10.7 (design slot OPEN, see "Open slots") |
| `ACCOUNT_REFRESH` | "Scrape Posts" button of Extract Events | In place of the button | Story 10.11 |
| `EXTRACT_SELECTED_POSTS` | Extract Events confirm | Banner above the post list | Story 10.12a |
| `EXTRACT_FROM_URL`, `CORRECTION` | Correction form | Beside the submit button | Stories 10.10 and 10.9 |
| `ADMIN_OPERATION` | Moderator Tools | In the operation's card | Story 10.12 |

Only the Story 10.6a row is designed in detail here; the others get the same component with their own labels (`copy-keys.md`, phase table). This is the "shared, so every job type's start point uses it" rule of Story 10.4.

## Voice and Tone

Plain words, no jargon, no blame (base spine Voice and Tone). Say what is happening, what will happen next, and what the user can do. Examples: "It will start by itself." "Leaving this page does not stop it." Never name a vendor, a provider, a caption or a raw error to an ordinary user (FR123). A moderator may see provider names, per-provider attempts and the engine's reason code, only inside a collapsed "Technical details" block. Times are formatted for the viewer's locale; durations use `Intl.NumberFormat` units (project-context "Locale-Sensitive Data Rendering"). Every string is in `en` and `id` (see `copy-keys.md`). In Indonesian the page is "Tugas" and, inside sentences, a job is "proses".

## Component Patterns

### Reuse map (what exists, what is new)

| Need | Reused as it is | New |
|---|---|---|
| Page shell | `PageContainer`, `PageHeader` | none |
| Account row | `SubscribedAccountCard` (`variant="list"`, `size="sm"`, `showPlatformBadge`; no subscribe toggle in the DOM) | none |
| Status look | `StatusBadge` (mapping, no new variants) | `JobStatusBadge` wrapper (maps a status to a variant, adds the icon) |
| List paging | `useListPaginationController`, `useReportConnectionPageMeta`, `PaginationControls`, `usePaginationLabels`, `EmptyPageNotice` | none |
| Filters | `Checkbox`, `RadioGroup` (moderator only) | none |
| Dialog | `Dialog` (apps/web), `ConfirmActionDialog` where a confirmation is needed | none |
| Toast | `sonner` toast, `SoftDeleteToaster` is not used | none |
| Count | `CountBadge` | none |
| Table | `Table` (apps/web) for the moderator attempts at `md:` and above | none |
| Preview result | `ReextractPreviewResult` (unchanged, gets a banner slot) | banner component |
| Stepper | none exists | `JobStepper` (pure, `packages/ui/src/features/jobs/`) |
| Progress view | none exists | `JobProgressView` (pure presentation) and `JobChip` in `packages/ui`; `JobProgressHost` and `useJob` in `apps/web/src/features/jobs/` |
| Live announcements | none shared (each page has its own `sr-only` text) | `JobAnnouncer`: one polite live region per page |
| Cap notice | none | `SubscriptionCapNotice` (`packages/ui/src/features/subscriptions/`) |
| Upgrade button | none | `UpgradeCta` (`packages/ui/src/core/`), see the Gate 2 answer |
| Duration and time text | none | `formatJobDuration` (Intl.NumberFormat units), next to `JobProgressView` |

`packages/ui` components are presentational: they take data and a `labels` object. Hooks that fetch (`useJob`, `useMyJobs`, polling) live in `apps/web` because they use the GraphQL client. The pure rules (which steps a type shows, whether Retry is offered, what a reason code means) live on the server and arrive as data (see `graphql-read-shape.md`), so the screens carry no per-type logic except labels.

### Where the progress lives (FR123: re-open at last progress)

1. **A job never lives in the browser.** The chip and the dialog render a job fetched by id. The only browser state is view state: is the dialog open right now.
2. **Finding the job again.** A start point that can show a chip asks the server `activeJobs(subject, endedWithinMinutes)` on mount (the subject is the thing the action is about: a post id, an account, the user's selection). If it returns an open job, the chip is shown. This is what makes the chip appear after a reload, after navigating away and back, and on another device, without storing anything in `localStorage`.
3. **Dialog or chip on arrival.** The dialog opens by itself only as the direct result of the user's own start action in that tab. Any other discovery (reload, another device, coming back) shows the chip, never a dialog. Tapping the chip opens the dialog at the job's current step and the steps already done.
4. **Same action started again** re-attaches (FR120 Starting the Same Work Twice): the start call returns the existing job id with outcome `REUSED`, and the dialog opens on that job. The user sees "This is already running" (announced), not an error.
5. **Ended jobs.** A chip is shown for open jobs. For a job that ended while the user was watching, the chip turns into its ending ("Done", "Done, with limits", "Failed") and stays until the user opens it; opening it shows the result and then removes the chip. After a reload, a chip for an ended job appears only where the start point asks for it with `endedWithinMinutes` (the Re-extract panel asks for 30, the length of the Apply window of FR125; other start points ask for 0, because their result is visible in the place itself, for example the account in the list).

### Progress dialog (the inline job progress component, dialog form)

Structure, top to bottom:
1. Title: the job's type label plus subject ("Adding @handle", "Re-extracting a post").
2. Status line with the `JobStatusBadge` and, while open, elapsed time (`Running for 1 min 20 s`, not announced).
3. State area (one of the states below): stepper, queued box, waiting box, outcome box.
4. Footer: **Minimize** while the job is open, **Close** when it ended; **Retry** and the result link (for example "Open the account") when they apply; "See all in Jobs" link.

Behaviour:
- **Minimize, Escape and the outside tap do the same thing** while the job is open: shrink to the chip. There is no separate "close" that could be mistaken for "stop". Nothing in this dialog stops a job. When the job has ended the same controls close the dialog and drop the chip.
- Focus: opens on the title (`DialogTitle`), traps inside (Radix default). On Minimize focus returns to the chip (it is rendered in the same step), on Close to the control that started the action (Re-extract button, Subscribe button). If that control is gone, focus goes to the page's main heading.
- Mobile: the dialog is the existing bounded `DialogContent` (scrolls inside itself, never wider than the screen). Buttons are full width and stack, Minimize last in the DOM order so Retry is reached first (primary first), each `min-h-11`.
- Never blocking: tapping outside is allowed and minimizes. No overlay spinner.

### Stepper

An `<ol aria-label="Steps">`. Each item: marker (check, spinner, number or minus), label, optional detail ("3 of 8 finished"). The current item has `aria-current="step"` and a visually hidden state word after the label ("in progress"). Steps come from the server (`steps[]` with `state`), so a skipped step (for example "Fetching fresh images" when the images were still fine) shows "skipped" and is not counted as a failure. A job type that declares no steps shows one generic step "Working on it". The stepper is vertical at every width.

### Chip

A button, `min-h-11`, spinner icon while open (static dot under `prefers-reduced-motion`, via `usePrefersReducedMotion`), short label: "In progress: step 2 of 3", "Waiting for a place (#2)", "Waiting until 14:20", "Done", "Done, with limits", "Failed". Accessible name: "Show progress: {title}. {status}". It truncates inside `min-w-0` and wraps under a long neighbour, never causing horizontal page scroll.

### Jobs page (list)

- **Header:** `PageHeader` title "Jobs" and one-line description. No action button.
- **Moderator filters (only when the viewer is a moderator):** a `RadioGroup` "Show: My jobs / All users" and a `Checkbox` "Include system jobs" (FR130 Who Started a Job). They apply immediately, no Apply button (AD-18 Filter Apply-Timing Convention). Defaults: My jobs, system jobs off. Ordinary users see no filter row at all.
- **Section "In progress"** (queued, running, waiting): from `activeJobs`, newest first, not paged (at most 3 running, 10 queued, plus waiting). Polled while visible.
- **Section "Finished"** (the five endings plus cancelled): from `myJobs`, newest first, paged with the shared controller. `filterKey` is `{ scope, includeSystem }`.
- **Row:** `JobRow` is a link to `/jobs/{id}`: badge + type label; the subject line (a `SubscribedAccountCard` for account jobs, plain text for "12 posts" or "Post DcntzF0mB7z"); meta: "Started 14:02", then "Running for 1 min 20 s" or "Took 1 min 20 s"; for a queued job "Number 2 in line"; for a waiting job "Next try 14:20". Moderators also see "Started by {name}" or "System job".
- **Paging:** AD-18 rule 4. `useListPaginationController({ filterKey, initialCursor: undefined })`, `pagination.cursor` goes into the query, `useReportConnectionPageMeta(pagination, connection)` reports the page, and `PaginationControls` with `usePaginationLabels` renders Previous/Next. No `useState` cursor, no `hasNextPage` state. A control that clears filters also calls `pagination.resetToFirstPage()`. A filter handler never calls `refetch()`. A later page with no rows shows `EmptyPageNotice` above the controls; a failing later page shows its error, not the notice. **This is a deliberate reading of FR123's "infinite scroll"** (see decisions.md, choice 1).
- **Page size** 20.

### Job detail

`PageHeader` with a back link "Jobs". Then the same `JobProgressView` in its **panel** form (no dialog): status, stepper, queued/waiting/outcome box, Retry and the result link. Below: timing (started, finished, took), the late-result note when `completedAfterDeadline`, and for moderators a collapsed "Technical details (moderators)" block (`<details>`): provider attempts (provider, result, time given, time used, reason), engine reason code, the engine's plain message, job id, who started it. At `md:` and above the attempts are a `Table` inside an `overflow-x-auto` box; below `md:` each attempt is a stacked definition list. For a Re-extract job a button "Open the preview" opens the same Re-extract dialog attached to this job (Story 10.6a).

### Retry

One button, one rule: the server says whether it is offered (`canRetry`) and when it becomes available (`retryNotBefore`). Retry starts a **new** job for the same input (a new id) and is subject to reuse, admission, the cooldown and the slot rules (FR123). Outcomes:
- Started: the dialog or the detail page moves to the new job (`router.replace` to its id on the detail page). The old job stays in the list as history. Announced: "Started again."
- Reused (an open job for the same work exists): move to that job. Announced: "This is already running."
- Subscription cap refused (a Subscribe job): the cap notice (Story 10.3a) is shown in place, inline on the detail page.
- Queue full: a message with a link to Jobs (copy `startQueueFull`).
- Cooldown: the button reads "Retry at 14:42" and is `aria-disabled` with that text as its description; it enables itself when the time passes (a timer, no poll).

### Start-refusal messages (all start points)

`JOB_QUEUE_FULL` (FR121: at most `MAX_QUEUED_JOBS_PER_USER` waiting) says why and points to the Jobs page. `SUBSCRIPTION_CAP_REACHED` opens the cap notice. Any other refusal uses the generic message. One helper in `apps/web/src/features/jobs/` maps a start error to one of these so no start point re-invents it.

## State Patterns

### The states of one job (all job types)

Each row: what the user sees in the **dialog or panel**, what the **chip** and **list row** show, the **announcement**, and what actions exist. Copy keys are in `copy-keys.md` (namespace `Jobs`).

| State | Dialog / panel | Chip and list row | Announcement (polite unless noted) | Actions |
|---|---|---|---|---|
| **Loading** (first fetch of a job by id) | Skeleton: title bar, three stepper rows (the same heights as the real ones, project-context "Keep Skeletons in Sync") | Chip not shown until known; row skeletons on the list | none | none |
| **Empty** (no jobs at all) | n/a | Page: "No jobs yet", one sentence on what creates a job | none | none |
| **Empty, filtered** (moderator) | n/a | "No jobs match these filters" + Clear filters (also `resetToFirstPage()`) | `status` once | Clear filters |
| **Empty page** (page past the end) | n/a | `EmptyPageNotice` above the still-visible controls | `role="status"` (existing) | Previous |
| **Queued** | Blue info box: "Waiting for a free place". Body: you can run N at once, all N are in use, it starts by itself. Position "Number 2 in line" (or "Next in line"). If the queue limit is near its end: "If it has not started by 14:32 it will be dropped." (the 30-minute bound, FR121). Stepper shown with all steps "not started". | Badge "Waiting for a place"; chip "Waiting for a place (#2)"; row meta "Number 2 in line" | On entering: "{title} is waiting for a free place. Number 2 in line." A later change of position is **not** announced (it changes too often); the text updates silently. When it starts: "{title} is now in progress." | Minimize. Cancel is not offered (see decisions.md, choice 9). |
| **Running** | Stepper with done steps checked, current step spinning, later steps numbered. "Step 2 of 3" text. Count detail when known ("3 of 8 finished"). Note: "Leaving this page does not stop it." | Badge "In progress"; chip "In progress: step 2 of 3"; row meta "Running for 1 min 20 s" | On every **step change**: "{title}: step 2 of 3, checking the account type." Not on each poll. | Minimize |
| **Waiting** | Blue info box naming what it waits for: a retry ("Waiting to try again at 14:20"), a result on its way ("Waiting for the answer to arrive. This can take a few minutes."), or posts still being worked ("Waiting for the posts to finish extracting (3 of 8 done)"; "Waiting to retry a post at 14:20"). A waiting job holds no place; the box says "You can start other jobs meanwhile." Stepper keeps the current step. | Badge "Waiting"; chip "Waiting until 14:20" (or "Waiting"); row meta "Next try 14:20" | On entering: "{title} is waiting. {reason}." The resume time is not re-announced. | Minimize |
| **Succeeded** | Green check, "Done". What it produced (link to the account, "N events from M posts", or "Open the preview"). Timing "Took 1 min 20 s". | Badge "Done"; chip "Done" until opened | "{title} is done." | Result link, Close |
| **Succeeded with limits** | Amber box "Finished with what we had" and the reason in plain words (copy `reason.*`). Result link. For a late result: "The answer arrived late but was still used." | Badge "Done, with limits" | "{title} finished with limits. {reason}" | Result link, Retry when `canRetry`, Close |
| **Failed** | Red box "Could not finish" and the reason in plain words. Never a raw error. | Badge "Failed" | `role="alert"` (assertive) only when the user is watching the dialog; polite in the list. "{title} failed. {reason}" | Retry when `canRetry`, Close |
| **Expired** | Slate box "Stopped" and the reason: "It took too long and was stopped." or, for `WAITED_TOO_LONG`, "It waited more than 30 minutes for a free place and was dropped. Try again when your other jobs have finished." | Badge "Expired" | "{title} was stopped. {reason}" | Retry when `canRetry`, Close |
| **Cancelled** (Failed with reason `CANCELLED`) | Slate box "Cancelled". Reason text "It was cancelled." (for the moderator stuck-job replacement and a removed account being added, FR122 releases the slot). | Badge "Cancelled" | "{title} was cancelled." | Retry when `canRetry`, Close |
| **Load error** (the job or the list could not be fetched) | Red box "We could not load this job." + Try again; polling continues with back-off | List: error with Try again | `role="alert"` once | Try again |
| **Not found or not yours** | "This job was not found." with a link to Jobs (the server answers the same for another user's job as for a missing one; a moderator sees any job) | n/a | none | Back to Jobs |

Notes:
- A job that ended with the five endings is also "Done" in the sense of a closed list item: it stays listed `JOBS_HISTORY_RETENTION_DAYS` (30) days (FR123), then it is gone and its link shows "Not found".
- A system job (FR130) never appears to an ordinary user. A moderator sees it only with "Include system jobs" on, labelled "System job".
- Reason text is resolved from the reason **code**, never from the engine's English message (that message is shown to moderators only, in Technical details).

### Which reasons offer Retry

Decided by the server and sent as `canRetry` (this table is the design intent the story author turns into the rule; copy is in `copy-keys.md`).

| Reason code | Retry | Note |
|---|---|---|
| `NO_PROVIDER_REACHABLE`, `PROVIDER_OVER_QUOTA`, `TIMED_OUT`, `WAITED_TOO_LONG`, `CANCELLED`, `SOME_POSTS_NOT_EXTRACTED`, `VENDOR_RUN_FAILED`, generic engine endings | Yes | |
| `COOLDOWN` | Yes, from `retryNotBefore` | Button reads "Retry at {time}" until then |
| `REFRESH_IN_PROGRESS`, `CHAIN_IN_FLIGHT`, `QUOTA_EXHAUSTED`, `EXTRACTION_FAILED`, `REFRESH_DID_NOT_HEAL_IMAGES` | Yes | |
| `ACCOUNT_NOT_FOUND`, `ACCOUNT_PRIVATE`, `ACCOUNT_TYPE_NOT_SCRAPED`, `POST_UNAVAILABLE`, `POST_NOT_FOUND` | No | Retrying the same input cannot help. For `ACCOUNT_NOT_FOUND` the text says to try another handle. |

### Polling

2 s while the dialog is open, 5 s for a chip, 10 s for the list while it holds an open job, none when every job is ended. Polling stops while the tab is hidden (`visibilitychange`) and resumes with one immediate fetch on return. After an error the interval doubles up to 30 s. A hidden tab never announces. The existing Re-extract hook already polls at 2 s (`POLL_INTERVAL_MS`); the shared `useJob` replaces its private loop.

## Story 10.4: the Jobs page and the inline job progress component

### Flow 1, Aisyah adds an account on a train with one bar of signal (subscribe, mobile)

Aisyah (mom of two, commuting, reads FestDaily on her phone) subscribes to a venue account while she already has two other jobs running and one more queued.
1. She taps Subscribe. The request returns in under a second with a job id (FR116). The dialog "Adding @venue" opens with the steps "Finding the account", "Checking what kind of account it is", "Fetching its first posts".
2. The job is Queued: the box says all 3 places are in use and she is number 2 in line. She hears "Adding @venue is waiting for a free place. Number 2 in line."
3. She taps Minimize. The dialog shrinks to a chip next to the Subscribe button, and the new account row already shows in Subscribed Accounts "being added" (FR126).
4. She locks her phone and reads something else. Her train goes through a tunnel.
5. Later she opens the app on her laptop. The Subscribed Accounts page asks the server for open jobs for that account and shows the chip: "In progress: step 2 of 3". Nothing was stored in the phone's browser.
6. **Climax:** she taps the chip on the laptop and the dialog opens exactly at step 2, steps 1 checked. A minute later it reads "Done" with "Open the account".
7. She opens Jobs from the profile menu and sees the same job under "Finished" with "Took 3 min 5 s".

### Flow 2, the job fails and she retries

A different account was not found. The dialog shows the red box "We could not find this account. Check the spelling and try another handle." with no Retry (`ACCOUNT_NOT_FOUND`). A third one hit a provider outage: "We could not reach the platform right now. Try again in a few minutes." with **Retry**. Retry starts a new job, subject to the cap: if she is at her limit the cap notice (Story 10.3a) appears in place.

### Flow 3, a moderator looks for what went wrong

Wayan (moderator) opens Jobs, sets "All users" and "Include system jobs". Rows now show "Started by {name}" or "System job". He opens a failed job, expands "Technical details (moderators)" and sees the two provider attempts: the first "Ran out of time, 20 s given, 20 s used", the second "Over quota". An ordinary user sees none of this.

### Edge cases (Story 10.4)

- **Two tabs, one job.** Both poll the same job; the same ending is shown in both. Only the tab that started it opened a dialog.
- **User starts a fourth job.** It is accepted and Queued, never refused (FR121). At the 11th waiting job the start is refused with the queue-full message and a link to Jobs.
- **Reload mid-job.** Chip, not dialog (see "Where the progress lives").
- **A vendor result arrives after the deadline** (FR119): the job ends Succeeded or with limits and the note "The answer arrived late but was still used." is shown.
- **The job record is deleted by retention** while the page is open: the next poll returns not found; show "This job was not found."
- **Owner is offline.** Polling errors back off; the last known state stays visible with a small "Reconnecting" line (polite, once).
- **Long handles and ids** break inside `min-w-0`; the page never scrolls sideways at 320 px.

### Accessibility (Story 10.4)

- One `JobAnnouncer` per page: one visually hidden `role="status" aria-live="polite" aria-atomic="true"` announcer region per page, plus one alert region used only for a watched failure. It receives a message only when a job's **status or step changes**, never on a poll with no change, and coalesces messages within 3 s so a burst of changes in the list reads as "3 jobs updated" instead of three interruptions. Failure in a dialog the user is watching uses `role="alert"`.
- Status is text plus icon plus color; the badge text is the accessible status. The stepper uses `aria-current="step"` and a hidden state word per item.
- Rows are real links with an accessible name "Open details: {title}, {status}".
- The chip is a button with an accessible name that includes title and status.
- Focus order in the dialog: title, state area, Retry or result link, Minimize/Close. Focus is restored as described above.
- Pagination follows the existing controls: a `nav` landmark "Pagination" with Previous/Next, disabled while loading.
- Reduced motion: the spinner and any transition stop; the current step shows a static filled dot.
- Time is not conveyed by an animation or a countdown; clock times and durations are text.
- Touch targets `min-h-11 min-w-11`. Text contrast follows `StatusBadge` pairs (already audited).
- A screen reader reaches the moderator filters as a labelled radiogroup and a checkbox, each with a visible label.

### Mobile behaviour (Story 10.4)

Single column; rows wrap their header; the account card is the `sm` size; the paging controls are full width; the moderator filters stack (radiogroup above the checkbox); the dialog is the bounded `DialogContent` with stacked full-width buttons; the page uses `PageContainer` so it clears the bottom tab bar (`z-chrome`). The attempts table is a stacked list below `md:`. The page is covered by the responsive-overflow Playwright matrix (320 to 1440 px) and the dialog by a new scenario in the responsive-popups spec (project-context "Responsive Containment"); both run with `E2E_FAKE_AUTH=1` so the moderator filters are exercised.

### Analytics (Story 10.4)

Optional, small, and never carrying a handle, a URL, a caption or a vendor name (see decisions.md, choice 10). All through `@festgrid/analytics` (`capturePostHogEvent`), snake_case names, camelCase properties, like the existing events.

| Event | Properties | When |
|---|---|---|
| `job_progress_minimized` | `jobType`, `status` | The user minimizes the dialog |
| `job_progress_reopened` | `jobType`, `status`, `source` (`chip` or `jobs_page`) | The user opens a chip or a job from the list |
| `job_retry_clicked` | `jobType`, `reasonCode` | The user taps Retry |
| `jobs_filter_changed` | `scope`, `includeSystem` | A moderator changes a filter |

### GraphQL the screens need

See `graphql-read-shape.md`: `job(id)`, `myJobs(filter, first, after)`, `activeJobs(filter, subject, endedWithinMinutes)`, a `retryJob(jobId)` mutation, and the `Job` type with `steps`, `queue`, `waiting`, `reasonCode`, `canRetry`, `retryNotBefore`, `subject`, `outcome`, and moderator-only `moderatorDetails`.

## Story 10.3a: the subscription cap refusal and the Upgrade call to action

### When it appears

A subscribe or a restore is refused by the server with `SUBSCRIPTION_CAP_REACHED` carrying `activeCount`, `reservedCount` and `cap` (Story 10.3, reuse and admission control to job start; already built, in `extensions`). A moderator never sees it (exempt) and voting is never blocked (PRD Section 6). The cap applies to every non-moderator today (decided 2026-11-11).

### Flow, Dewi hits her limit during onboarding (mobile)

Dewi is in the onboarding wizard adding her sixth account. She has 3 accounts added and 2 more being added (reserved slots), so the cap of 5 is full.
1. She taps Subscribe on the sixth. The server refuses it before any scrape starts (no vendor cost).
2. The wizard step shows the **cap notice** where the Subscribe button was: "You have reached your limit. You have 3 accounts added and 2 more being added. The limit is 5." and the hint "Remove an account you no longer need to make room. If an account being added fails, its place is freed."
3. Below it, **Upgrade** with a "Coming soon" badge and the note "Paid plans with a higher limit are not available yet." Showing it fired `subscription_cap_upgrade_cta_shown`.
4. **Climax:** she taps Upgrade out of curiosity. `subscription_cap_upgrade_cta_clicked` fires and the note changes to "Thanks for your interest. Paid plans are not available yet." Nothing is purchased; nothing breaks. She taps Continue and moves on.

### Surfaces and presentation

| Surface | Presentation | The blocked action |
|---|---|---|
| Subscribe dialog (`subscribe-account-dialog.tsx`, Account Settings) | Inline: the notice replaces the dialog's Subscribe button; the handle field stays editable; Close remains | The Subscribe submit button is not rendered while the refusal stands |
| Onboarding subscribe step | Inline below the form; Continue/Skip stay available (the wizard never traps, FR127) | The add action is replaced by the notice |
| Account page (`SubscribedAccountCard` toggle) | A small `Dialog` containing the notice (no room inline) | The toggle returns to "not subscribed" |
| Restore of a removed subscription (the Undo toast) | A small `Dialog` containing the notice; the toast itself shows the short `restoreFailedToast` | The row stays removed |
| Job detail, Retry of a Subscribe job | Inline in the detail page, under the failed box | Retry is replaced by the notice |

The notice is one component (`SubscriptionCapNotice`); the dialog form just wraps it. It replaces the generic error: today a refused subscribe shows a generic toast.

### Content and states

| State | What is shown |
|---|---|
| Refused, nothing being added (`reservedCount` 0) | Title "You have reached your limit". Body: "You have 5 accounts added. The limit is 5." Hint. Upgrade button, badge, note. |
| Refused, some being added | Body adds "and 2 more being added" (plural forms in `copy-keys.md`) |
| Above the cap already (for example 7 of 5, from before the cap) | Same notice with real numbers ("You have 7 accounts added. The limit is 5."); existing subscriptions are never removed (PRD Section 6). No special wording. |
| After the user taps Upgrade | The note is replaced by "Thanks for your interest. Paid plans are not available yet." (live region, polite). The button stays focusable. |
| After the user makes room (removes an account) | The notice is not live-updated; the user taps Subscribe again and the server decides. (A live count query is a possible enhancement; see decisions.md, choice 6.) |
| Moderator | Never shown (exempt). If it ever arrived, fall back to the generic error. |
| Network error instead of a refusal | Generic error toast, no notice, no analytics event |

### Upgrade call to action: Gate 2 (is it its own `packages/ui` primitive?)

**Answer: yes, a small domain-agnostic primitive in `packages/ui/src/core/` named `UpgradeCta`, composed by `SubscriptionCapNotice`.**
Reasons: (1) PRD Section 6 and 8 already name more paid surfaces (premium slug editing, organizer promotion), so a second consumer is foreseen, not hypothetical; (2) the "coming soon" behaviour (a real focusable button that records interest instead of a dead disabled control) is a pattern worth defining once; (3) it keeps the cap-specific words and counts out of the primitive. The primitive knows nothing about the cap: props are `label`, `comingSoonLabel`, `note`, `afterClickNote`, `onShown`, `onClick` and `labels`; it calls `onShown` once when it first mounts visible, and `onClick` on every click. `SubscriptionCapNotice` supplies the counts and the analytics callbacks. The recommendation is flagged for the owner (decisions.md, choice 5).

### Accessibility (Story 10.3a)

- On mount the notice moves focus to its title (`tabIndex={-1}`) and is a `role="status"` region, so a screen reader hears "You have reached your limit. You have 3 accounts added and 2 more being added. The limit is 5." once. The dialog form is a plain dialog with the same title (an alert dialog is not needed: the refusal is information, not an emergency).
- The Upgrade button is a normal `button` with `aria-describedby` pointing at the "Coming soon" note. It is not `disabled` and not `aria-disabled`, because it must be focusable and clickable (it records interest).
- The "Coming soon" badge is text, not color alone.
- After a click the replaced note sits in a polite live region.
- Touch target `min-h-11`; the notice wraps at 320 px.

### Mobile behaviour (Story 10.3a)

Inline notice is full width inside the form; the Upgrade button is full width below `sm:`; the dialog form is the bounded `DialogContent`. No floating element.

### Analytics (Story 10.3a)

| Event | Properties | When |
|---|---|---|
| `subscription_cap_upgrade_cta_shown` | `accountId`, `currentSubscriptionCount` (PRD Section 6); additionally `reservedCount`, `cap`, `surface` (recommended extra, additive; see decisions.md, choice 7) | The Upgrade button first appears for a refusal (once per refusal, not on re-render) |
| `subscription_cap_upgrade_cta_clicked` | same | Every click on the button |

`accountId` is the platform account being added, sent when it is known (account page, vote suggestion) and omitted when the user typed a handle that has no profile yet (the cap check runs before the lookup). `currentSubscriptionCount` is `activeCount` (the number of subscriptions the user holds); `reservedCount` carries the in-flight ones. Neither carries a handle or a name.

### Copy

Namespace `SubscriptionCap` (fixed by Story 10.3a), full text in `copy-keys.md`.

## Story 10.6a: Re-extract progress, the missing-images banner and Retry

### What exists today (traced)

- `ModeratorSourcePostsPanel` (apps/web `features/moderation`) lists an event's source posts, each with a **Re-extract** button that opens `ReextractPostDialog`.
- `ReextractPostDialog` starts a job on open (`previewPostReextraction`), shows one line "Extracting. This can take up to a minute." while it polls (`usePostReextractionPreview`, 2 s), then `ReextractPreviewResult`. Closing the dialog calls `reset()`, which **forgets the job**: reopening starts a new one. The same dialog flow is used by the Post URL tab (`reextract-content.tsx`).
- The result already carries `rescraped`, `imagesAvailable`, `imagesSent` and shows one amber line when `imagesSent < imagesAvailable` ("Only {sent} of {available} images were read...").
- The engine job (Story 10.6, move the moderator re-extract rescrape onto the engine) keeps a `refresh` report in `jobs.result_data` (outcome, reasons, saved, lateResultPending, retryAfter, expiredLinks) that **is not in the GraphQL schema yet**, and the job ends Succeeded with limits and a reason when the refresh did not deliver (`decideReextractEnding`: COOLDOWN, ACCOUNT_TYPE_NOT_SCRAPED, REFRESH_IN_PROGRESS, POST_UNAVAILABLE, NO_PROVIDER_REACHABLE, PROVIDER_OVER_QUOTA, TIMED_OUT, REFRESH_DID_NOT_HEAL_IMAGES). A post with no stored caption ends **Failed** with the same reason (nothing to preview from).
- The preview status polled today is `PENDING / PROCESSING / SUCCEEDED / FAILED`; the new design needs the richer job (steps, queue, waiting) and the refresh report. The Apply window is 30 minutes from the job's finish; Apply and the confirmation are unchanged.

### Changes

1. **Start.** Re-extract starts the job and opens the shared progress dialog (not a private spinner). Steps (two): "Fetching fresh images" (may show "skipped": the images were fine) and "Reading the post and finding events". The "up to a minute" line is removed (a refresh can run about two minutes plus the preview).
2. **Minimize and re-open.** Minimize turns the Re-extract button of that post row into a chip ("Re-extracting: step 1 of 2"). The job keeps running. The chip survives navigation, reload and another device because the panel asks `activeJobs(subject: post, endedWithinMinutes: 30)`. Tapping the chip opens the dialog at the last progress; if the job ended, it opens at the result with the banner and Apply as they were. From the Jobs page, the Re-extract job's detail has **Open the preview**, which opens the same dialog **attached to that job id** (no new job, no restart). This needs `usePostReextractionPreview` to gain an `attach(jobId)` and `ReextractPostDialog` an `attachJobId` prop; closing the dialog no longer calls `reset()` for an open job, it only minimizes. **Known limit (Story 10.4's rule, kept):** Close, Escape or an outside tap on an ENDED job closes the dialog and drops its chip for this page view; the way back is a reload within the 30-minute `activeJobs` window, or the job's page under Jobs with **Open the preview**.
3. **Banner.** When the job ended Succeeded with limits, the result view shows the missing-images banner above the preview (it replaces the old single amber line; same box, same test id). It says, in plain words:
   - **How many were read:** "3 of 5 images were read."
   - **Which are missing:** "Not read: the cover and slides 3 to 5." (cover, single slide, ranges; formatted with `Intl.ListFormat` for the locale; needs per-image data, see below).
   - **Why:** one cause sentence from the list in the PRD (Section 3.9.3): the image links expired and the refresh failed; the refresh is still running and a late result will be saved (FR119); the refresh was not tried because the post was refreshed less than 10 minutes ago, with the time it can be tried again; the account type is not scraped; the post is no longer available. Plus the engine's other reasons (no provider reached, quota used up, took too long, a provider answered but nothing usable).
   - **A line that Apply works as before:** "You can still apply this preview. Events shown only on unread images will be missing." (the existing wording, shortened).
   - **Retry** (below).
4. **Retry.** Starts the refresh again (a new job for the same post, through the same start call), and the dialog returns to the progress view for the new job. The button is shown when the cause can change: expired and failed, still running, took too long, no provider, quota, did not heal. It reads "Retry at 14:42" and is `aria-disabled` until then for the 10-minute cooldown. It is **not** shown for "account type is not scraped" and "post is no longer available" (retrying cannot help; the sentence says so), and not for the preview-cap case below.
5. **Failure.** A caption-less post whose refresh was refused ends **Failed**: the dialog shows the red box with the plain reason and **Retry** where the table says so.
6. **A shortfall that is not a failure.** If images were not read only because a carousel has more slides than the preview cap (`MAX_REEXTRACT_CAROUSEL_IMAGES`, 10), the banner says "Only the first 10 slides are read in a preview." with no Retry and no cause line. Today's single amber line cannot tell the two apart.

### States (Re-extract)

| State | Panel row | Dialog |
|---|---|---|
| Idle | `Re-extract` button | Closed |
| Starting (under 1 s) | Button disabled with a spinner "Starting…" | Dialog opens on the progress view as soon as the id is back |
| Queued (all 3 places busy) | Chip "Waiting for a place (#1)" | Queued box (shared) |
| Running, refresh | Chip "Re-extracting: step 1 of 2" | Stepper: step 1 current |
| Running, preview | Chip "Re-extracting: step 2 of 2" | Stepper: step 1 done or skipped, step 2 current |
| Waiting | Not used by this job type (a Bright Data snapshot that outlives the refresh budget lets the job continue on the stored images, and its late result only heals the post, Story 10.6) | n/a |
| Succeeded | Chip "Preview ready" until opened | Preview result, no banner, Apply |
| Succeeded with limits | Chip "Preview ready (some images missing)" | Banner + Retry above the preview result, Apply unchanged |
| Failed | Chip "Failed" | Red box with reason, Retry where allowed |
| Expired (ran past its 10 minute bound, or waited too long) | Chip "Expired" | Slate box with reason, Retry |
| Cancelled (replaced by a new click after 5 minutes of no progress, Story 10.6) | Chip "Cancelled" for a moment, then the new job's chip | Slate box "Cancelled", reason "It was cancelled." (the engine's own message, "The job made no progress for 5 minutes and was replaced by a new Re-extract.", is visible to moderators in Technical details) |
| Applied (after Apply) | Chip gone | The existing applied summary |
| Apply window over (30 minutes) | Button back to `Re-extract` | If opened from Jobs: "This preview is too old to apply. Start a new one." with a Re-extract button (the existing `EXPIRED` apply refusal) |

### Flow, Wayan re-extracts a post whose image links expired (mobile)

Wayan (moderator, reading on his phone) opens an event whose single source post has dead image links and taps Re-extract.
1. The dialog opens with "Fetching fresh images" spinning. He taps Minimize, the row shows the chip, and he reads the event description.
2. The refresh takes longer than usual. He reloads the page by accident; the chip is back ("Re-extracting: step 1 of 2") because it comes from the server.
3. He goes to Jobs, sees the job under "In progress", taps it: the detail shows the same stepper.
4. The refresh runs out of budget; the preview continues on the stored images. The job ends with limits.
5. **Climax:** he taps "Open the preview" and sees the banner: "3 of 5 images were read. Not read: the cover and slides 3 to 5. The image links have expired and refreshing them failed." with **Retry**. He taps Retry; a new job starts, the dialog goes back to the stepper, and this time it ends "Done" with 5 of 5 read.

### Accessibility (Story 10.6a)

- The shared announcer covers progress and endings; the banner is a `role="status"` region (it already is) and the dialog moves focus to the banner title when the result opens with limits, so the screen reader hears the shortfall before the events.
- The banner's missing-image sentence is real text (not an icon strip); the list is formed with `Intl.ListFormat`.
- Retry is a normal button; the cooldown variant is `aria-disabled` with the time in its accessible description.
- Minimize/Escape do not discard a result; closing after an ended job does not lose the 30-minute Apply window (it is on the server).

### Mobile behaviour (Story 10.6a)

The panel row is `flex flex-wrap`: the post link truncates, the chip or button wraps under it on a narrow phone (today the row is a non-wrapping `flex items-center justify-between` that could push the button off a 320 px screen when a long title is present; add `flex-wrap` and `min-w-0`). The dialog is the existing `max-h-[85vh] overflow-y-auto` content. Banner actions wrap.

### Analytics (Story 10.6a)

No required events. If the owner accepts the optional set of Story 10.4, Re-extract shares it (`job_progress_minimized`, `job_progress_reopened`, `job_retry_clicked` with `jobType: REEXTRACT_REFRESH`). The banner adds no event.

### Copy

Namespace: the existing `ReextractPreview` (fixed here for Story 10.6a: one namespace for one dialog; new keys are added, the obsolete `running` is removed). Full text in `copy-keys.md`.

## Open slots reserved for the owner (OI-2 and others)

Marked so a later decision drops in without a redesign. Nothing here is decided by this document.

| Slot | Where it touches this design | What the design does meanwhile |
|---|---|---|
| **SLOT-D1** (OI-2, D1: are lookup requests kept durably?) | A `PROFILE_LOOKUP` job only exists after the user left if requests are durable. It decides whether the sentence "You can leave this page" may be shown for a lookup and whether the pending row survives a reload. | The generic job UI is complete for `PROFILE_LOOKUP` (type label "Looking up an account", the usual states). The reassurance sentence is a separate copy key `lookup.leaveNote`, marked `[OPEN D1]`, and is not rendered until the owner decides. |
| **SLOT-D3** (OI-2, D3: the budget of the interactive attempt) | The profile-lookup draft has "Looking up (0 to 8 s)" and "Slow (8 to 20 s)" states before hand-off; the time at which the inline view switches from "Looking up @handle" to "Still looking, this is slow" and from the interactive form to the Jobs-style pending row depends on that budget. | A neutral text key `lookup.slow` exists with its threshold a **parameter** (`slowAfterSeconds`), default none; nothing is rendered until D3 is set. |
| **SLOT-D4** (OI-2, D4: does a vote apply by itself when the lookup resolves?) | The outcome box of a vote-originated `PROFILE_LOOKUP`: "Your vote was counted" (auto-apply) versus "Confirm your vote" with a button, and whether an Undo is shown. | The outcome box shows only "Account found" with the Open-the-account link for a lookup; the vote wording is `[OPEN D4]` keys `lookup.voteCounted`, `lookup.voteConfirm`, `lookup.voteUndo`, not rendered. |
| **SLOT-OI3** (OI-3, whose vendor credential a job uses) | None visible: vendor and credential never appear in ordinary-user copy. | none |
| **SLOT-OI4** (OI-4, do correction jobs move onto the engine's own table) | None for the UI: the user sees the same rows either way (FR123). The Jobs list needs `CORRECTION` rows from whichever table. | The type label and phases exist. |

## Inspiration & Anti-patterns

- Follow the existing "Soft Delete with Undo" idea: the user can always back out, and the app says what is happening in plain words.
- Avoid a global floating "jobs tray" (as some file managers have): it would fight the bottom tab bar and AD-33 tiers, and the PRD asks for the indicator at the place the action started.
- Avoid progress percentages the engine cannot know: steps and counts only.
- Avoid a vendor-error toast: the old "Failed to cast vote" for every error is exactly what this epic removes.
