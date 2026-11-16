# Proposed GraphQL read shape for the job screens

Companion to `EXPERIENCE.md`. This is the **read shape the screens need**, so the Story 10.4 author (Jobs page and inline job
progress component) can derive the backend. It is a proposal for the backend story to accept, change or reject; it is not a
schema change. Nothing here is built.

## What exists today (traced, 2026-11-13)

- Engine tables in `packages/database/schema.ts`: `jobs` (type, owner_user_id, trigger, input_key, input, status, phase, reason_code, error_message, result_data, deadline_at, completed_after_deadline, admitted_at, queued_since, leader_job_id, resume_at, finished_at), `job_attempts` (provider, outcome, budget_ms, elapsed_ms, reason_code) and `job_vendor_snapshots`. Statuses: `QUEUED, RUNNING, WAITING, SUCCEEDED, SUCCEEDED_WITH_LIMITS, FAILED, EXPIRED`. There is no CANCELLED status: a cancelled job is FAILED with `reason_code = CANCELLED`.
- `jobs.error_message` is a fixed plain-words string by design (AD-53, The Job Engine: the Jobs page reads that column). The screens still resolve text from `reasonCode` so it is translated; the message is shown to moderators only.
- GraphQL today: no `job`, `myJobs` or `activeJobs`. The Re-extract preview is served from the engine job through the old operations (`previewPostReextraction` returns `jobId`; `postReextractionPreview(id)` returns `{ status: PENDING|PROCESSING|SUCCEEDED|FAILED, preview, errorCode, errorMessage }`; `applyPostReextraction(jobId)`). The cap refusal is a GraphQL error with `extensions { code: SUBSCRIPTION_CAP_REACHED, activeCount, reservedCount, cap }`, and a refused start returns `errorCode` `JOB_START_FAILED | JOB_QUEUE_FULL | SUBSCRIPTION_CAP_REACHED`.
- The `ReextractRefreshReport` (outcome, reasons, saved, lateResultPending, retryAfter, expiredLinks) is in `jobs.result_data` but **not exposed** (Story 10.6 left it to Story 10.6a). `imagesAvailable` and `imagesSent` are exposed, but only as counts.
- Paging convention for a new list: a Connection `{ edges, pageInfo { hasNextPage endCursor }, totalCount }` like `ActorRunConnection`; the resolver ends its `ORDER BY` in a unique key (`id`) and encodes the cursor as the position after its row (project-context, AD-18 Filter Apply-Timing Convention, rule 4); a walking test pins it.

## Authorization

Every new root field calls `requireAuth(context)` as its first statement (AD-7, Authenticated Context and Authorization; the auth-surface ratchet). `scope: ALL_USERS` and `includeSystem: true` additionally require a moderator and answer `FORBIDDEN` otherwise (the check follows the top-level `requireAuth`). An ordinary user's `job(id)` for another user's job, or for a system job, answers like a missing job (`null`). The API never takes a `userId` argument.

## Proposed schema

```graphql
enum JobType {
  SUBSCRIBE
  PROFILE_LOOKUP
  ACCOUNT_REFRESH
  CORRECTION
  EXTRACT_FROM_URL
  EXTRACT_SELECTED_POSTS
  REEXTRACT_REFRESH        # the engine's 'reextract-post'
  ADMIN_OPERATION
}

enum JobStatus {
  QUEUED
  RUNNING
  WAITING
  SUCCEEDED
  SUCCEEDED_WITH_LIMITS
  FAILED
  EXPIRED
}

enum JobTrigger { USER SYSTEM }

# The user-safe reasons (PRD 4.21 JobReasonCode). The engine-internal endings
# (HANDLER_ERROR, HANDLER_NOT_REGISTERED, HANDOFF_MISSING, START_FAILED, UNSPECIFIED)
# are mapped to GENERIC for everyone; a moderator also gets the raw code in moderatorDetails.
enum JobReasonCode {
  ACCOUNT_NOT_FOUND ACCOUNT_PRIVATE NO_PROVIDER_REACHABLE PROVIDER_OVER_QUOTA
  ACCOUNT_TYPE_NOT_SCRAPED POST_UNAVAILABLE COOLDOWN TIMED_OUT CANCELLED
  WAITED_TOO_LONG SOME_POSTS_NOT_EXTRACTED REFRESH_IN_PROGRESS
  REFRESH_DID_NOT_HEAL_IMAGES POST_NOT_FOUND CHAIN_IN_FLIGHT QUOTA_EXHAUSTED
  EXTRACTION_FAILED VENDOR_RUN_FAILED GENERIC
}

enum JobStepState { DONE CURRENT PENDING SKIPPED }

type JobStep {
  key: String!               # looked up as Jobs.phase.<JobType>.<key>; unknown -> generic.working
  state: JobStepState!
  done: Int                  # "3 of 8 finished" (EXTRACT_SELECTED_POSTS); null when not a counting step
  total: Int
}

type JobQueueInfo {          # present only while status = QUEUED
  position: Int!             # 1-based among this user's queued jobs, oldest first (queued_since)
  maxConcurrent: Int!        # MAX_CONCURRENT_JOBS_PER_USER, so the copy says "3 at once" without a client constant
  expiresAt: DateTime!       # queued_since + JOB_QUEUE_MAX_WAIT_MINUTES
}

enum JobWaitingFor { RETRY_AT RESULT_FROM_PROVIDER EXTRACTION_QUEUE }

type JobWaitingInfo {        # present only while status = WAITING
  waitingFor: JobWaitingFor!
  resumeAt: DateTime         # RETRY_AT, or the next automatic retry of a post
  done: Int                  # EXTRACTION_QUEUE
  total: Int
}

enum JobSubjectKind { ACCOUNT POSTS POST NONE }

# Safe identity of what the job is about. Never a caption, never an image URL of a post.
type JobSubject {
  kind: JobSubjectKind!
  # ACCOUNT. platform + username let the client build the account link with buildAccountHref
  # (packages/ui never builds one; the numeric account id never goes in a URL, AD-35 Account URLs Resolve by Username, Never by account_id).
  accountId: ID
  platform: String
  username: String
  displayName: String
  profileImageUrl: String    # the account's public avatar, as SubscribedAccountCard already receives it
  # POSTS
  postCount: Int
  # POST (Re-extract). The platform's public short code, e.g. the 'DcntzF0mB7z' of /p/DcntzF0mB7z/.
  postCode: String
  postId: ID
}

enum JobOutcomeKind { ACCOUNT PREVIEW EVENTS NONE }

type JobOutcome {
  kind: JobOutcomeKind!
  eventCount: Int
  postCount: Int
  # PREVIEW (Re-extract): when the Apply window closes (finished_at + 30 min), and whether it was applied.
  previewApplyUntil: DateTime
  previewApplied: Boolean
}

# Moderator-visible only.
type JobAttempt {
  provider: JobProvider!     # APIFY | BRIGHT_DATA (the schema maps the table's BRIGHTDATA to the PRD spelling)
  outcome: JobAttemptOutcome!
  budgetMs: Int!
  elapsedMs: Int!
  reasonCode: JobReasonCode
}
enum JobProvider { APIFY BRIGHT_DATA }
enum JobAttemptOutcome { SUCCEEDED FAILED EMPTY TIMED_OUT OVER_QUOTA SKIPPED }

type JobModeratorDetails {
  attempts: [JobAttempt!]!
  engineReasonCode: String   # the raw jobs.reason_code, including the engine-internal ones
  engineMessage: String      # jobs.error_message (already plain words, never a raw vendor error)
}

type JobOwner { displayName: String }   # moderator only; no email, no user id

# The Re-extract refresh report (Story 10.6, in jobs.result_data), exposed for the banner (Story 10.6a).
enum JobRefreshOutcome {
  NOT_NEEDED REFRESHED COOLDOWN NOT_SCRAPED IN_FLIGHT POST_UNAVAILABLE
  NO_PROVIDER_REACHABLE PROVIDER_OVER_QUOTA TIMED_OUT
}
enum JobImageRole { COVER SLIDE }
enum JobImageState { READ NOT_READ_EXPIRED NOT_READ_UNAVAILABLE NOT_SENT_OVER_CAP }

type JobImage {
  position: Int!             # 0 = cover, 1.. = slides (the banner shows "slide 3" as position 3)
  role: JobImageRole!
  state: JobImageState!
}

type JobRefreshReport {
  outcome: JobRefreshOutcome!
  saved: Boolean!
  lateResultPending: Boolean!
  retryAfter: DateTime       # COOLDOWN only
  expiredLinks: Int!
  images: [JobImage!]!       # one entry per image the post lists: cover + slides, no URLs
  imagesAvailable: Int!
  imagesRead: Int!
  previewImageCap: Int!      # MAX_REEXTRACT_CAROUSEL_IMAGES, so "first 10 slides" needs no client constant
}

type Job {
  id: ID!
  type: JobType!
  trigger: JobTrigger!
  status: JobStatus!
  # Derived for the UI: true when status = FAILED and reasonCode = CANCELLED. (Convenience; the client could derive it.)
  isCancelled: Boolean!
  reasonCode: JobReasonCode               # always set for every ending other than SUCCEEDED (FR117)
  # Parameters some reason texts need (COOLDOWN: time; WAITED_TOO_LONG: minutes).
  reasonRetryAfter: DateTime
  reasonQueueMaxWaitMinutes: Int
  createdAt: DateTime!
  startedAt: DateTime                     # admitted_at; null while QUEUED
  finishedAt: DateTime
  deadlineAt: DateTime!
  completedAfterDeadline: Boolean!        # FR119: "the answer arrived late but was still used"
  subject: JobSubject!
  steps: [JobStep!]!                      # ordered; empty list -> the UI shows the generic step
  queue: JobQueueInfo
  waiting: JobWaitingInfo
  outcome: JobOutcome
  canRetry: Boolean!                      # server owns the rule (see EXPERIENCE.md, "Which reasons offer Retry")
  retryNotBefore: DateTime                # COOLDOWN
  refresh: JobRefreshReport               # REEXTRACT_REFRESH only
  # Moderator only (null for everyone else, and for an ordinary user the field is absent from the response)
  owner: JobOwner
  moderatorDetails: JobModeratorDetails
}

type JobEdge { node: Job! cursor: String! }
type JobConnection { edges: [JobEdge!]! pageInfo: PageInfo! totalCount: Int! }

enum JobsScope { MINE ALL_USERS }          # ALL_USERS: moderator only
input JobsFilter {
  scope: JobsScope = MINE
  includeSystem: Boolean = false           # moderator only
}

# What an action is about, so a start point can find its own open job again after a reload.
input JobSubjectInput {
  type: JobType!
  postId: ID                               # Re-extract of a stored post
  postUrlKey: String                       # Re-extract of a URL that is not stored (the engine's input key)
  accountId: ID                            # account jobs
  # EXTRACT_SELECTED_POSTS: the user's own open selection job is found by type alone (one per user at a time, FR129)
}

extend type Query {
  job(id: ID!): Job
  # Newest first. Includes every status; the Jobs page passes onlyEnded to build the "Finished" section.
  myJobs(filter: JobsFilter, onlyEnded: Boolean = false, first: Int = 20, after: String): JobConnection!
  # Open jobs (QUEUED, RUNNING, WAITING), newest first, not paged (bounded: 3 running + 10 queued + waiting).
  # With subject: only jobs for that subject. endedWithinMinutes also returns jobs that ended in that window (the Re-extract
  # panel passes 30 to cover its Apply window; others pass 0).
  activeJobs(filter: JobsFilter, subject: JobSubjectInput, endedWithinMinutes: Int = 0): [Job!]!
}

enum RetryJobOutcome { STARTED REUSED REFUSED }
type RetryJobResult {
  outcome: RetryJobOutcome!
  job: Job                                  # the new job, or the one that was re-attached to
  errorCode: JobStartErrorCode              # when REFUSED
  # SUBSCRIPTION_CAP_REACHED numbers, so the cap notice can render in place (same names as the error's extensions)
  activeCount: Int
  reservedCount: Int
  cap: Int
  maxQueued: Int                            # JOB_QUEUE_FULL
  retryNotBefore: DateTime                  # COOLDOWN
}
enum JobStartErrorCode { JOB_QUEUE_FULL SUBSCRIPTION_CAP_REACHED COOLDOWN JOB_START_FAILED }

extend type Mutation {
  retryJob(jobId: ID!): RetryJobResult!     # owner only; starts a new job for the same input, through the same admission rules
}
```

## Where each screen reads what

| Screen part | Fields |
|---|---|
| Jobs list row | `id type status isCancelled subject{...} startedAt createdAt finishedAt queue{position} waiting{resumeAt} owner{displayName} trigger` |
| Chip | `id type status isCancelled steps{key state} queue{position} waiting{resumeAt}` |
| Progress dialog and detail panel | all of the above plus `reasonCode reasonRetryAfter reasonQueueMaxWaitMinutes outcome canRetry retryNotBefore completedAfterDeadline deadlineAt` |
| Moderator technical details | `moderatorDetails{attempts engineReasonCode engineMessage}` and `id` |
| Re-extract banner (Story 10.6a) | `refresh{outcome saved lateResultPending retryAfter expiredLinks images{position role state} imagesAvailable imagesRead previewImageCap}`, `status`, `canRetry`, `retryNotBefore` |
| Re-extract preview result | unchanged `postReextractionPreview(id)` and `applyPostReextraction(jobId)` (same id) |
| Cap notice (Story 10.3a) | the error's `extensions { activeCount reservedCount cap }` (exists) or `RetryJobResult` (same numbers) |

## Notes for the story authors

1. **Steps from the server.** The server derives `steps[]` from the type's declared phase list and the job's `phase`, so a skipped step (Re-extract refresh `NOT_NEEDED`) is `SKIPPED` and the client holds no per-type phase logic. The engine's `phase` is text today; Story 10.4 adds the ordered list per type to the registry (each adoption story declares its own).
2. **Named images.** The banner needs `images[]` to name what is missing; if the owner would rather ship a smaller first version, the fallback is counts only ("3 of 5 images were read") using `imagesAvailable` and `imagesRead`, and the sentence about which images is dropped.
3. **No caption anywhere.** `subject`, `outcome` and `refresh` carry no caption and no image URL (a post is identified by its public short code).
4. **Vendor names only to moderators.** `moderatorDetails` is null for an ordinary user; `JobProvider` appears only there.
5. **Attach to a job.** `usePostReextractionPreview` gets `attach(jobId)`, which polls `postReextractionPreview(id)` for the result and `job(id)` for the steps; or the preview result can be folded into `Job` later (Story 10.9 decides whether `manual_extraction_jobs` moves, PRD OI-4).
6. **Pagination test.** The new list adds a case to a walking test like `moderator-list-pagination.test.ts` (unique tiebreaker on `id`; cursor is the position after the row).
7. **Optional, not required.** A `mySubscriptionCapStatus { activeCount reservedCount cap }` query would let a subscribe form show the numbers before a refusal; Story 10.3a does not need it.
