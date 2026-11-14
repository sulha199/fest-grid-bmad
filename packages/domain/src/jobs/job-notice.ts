import type { JobGraphqlType } from "./job-presentation.js";

// Story 10.13 (notify when a job finishes; PRD 3.18 FR124, FR130; Architecture Spine AD-53) -- the pure rules of the job-finished notice:
// who is told, when (grace, merge window, max age) and in which words. `announceEndedJobs` (apps/backend) reads the rows and sends; every
// rule lives here. The text builders take NO vendor, caption, URL or error text as input, so none can reach a push or a mail.

/** A terminal user job that has not been announced yet, as the announcer reads it. */
export interface PendingJobNoticeRow {
  id: string;
  finishedAt: Date;
}

export interface DecideJobNoticeInput {
  /** The jobs pending for ONE owner (terminal, owner not yet notified). A system job (no owner) is never passed in. */
  jobs: readonly PendingJobNoticeRow[];
  pushEnabled: boolean;
  hasDevice: boolean;
  isModerator: boolean;
  /** `user_settings.last_job_push_at`: when this owner was last sent a notice group (a push or, for a moderator, the mail). */
  lastPushAt: Date | null;
  now: Date;
  windowMinutes: number;
  graceSeconds: number;
  maxAgeMinutes: number;
}

export type JobNoticeGroup = "NONE" | "SINGLE" | "MERGED";

export interface JobNoticeDecision {
  group: JobNoticeGroup;
  /** Send the push (push enabled and a device exists). */
  push: boolean;
  /** Send the moderator mail (the owner is a moderator). */
  mail: boolean;
  /** The jobs the notice covers (the group), sorted by id. */
  notify: string[];
  /** The id the mail's throttle entity uses: the smallest id of the group; null with no group. */
  entityJobId: string | null;
  /** Jobs to mark handled with nothing sent (too old, or the group has no channel). */
  markHandled: string[];
  /** Jobs left unmarked for a later run (inside the grace, or inside the merge window). */
  hold: string[];
}

/**
 * What to do about one owner's pending ended jobs. Too old (past the max age, which also absorbs the first run after a deploy and an
 * outage) is handled with no notice; younger than the grace is held (the owner may be watching, `acknowledgeJobEnded` may still arrive);
 * the rest forms the group first and the channels apply to it: a group with neither channel is handled with nothing sent, and while
 * `lastPushAt` is inside the window the group is held and goes out merged when the window closes (one notice per owner per window).
 */
export function decideJobNotice(input: DecideJobNoticeInput): JobNoticeDecision {
  const markHandled: string[] = [];
  const hold: string[] = [];
  const eligible: string[] = [];
  const maxAgeMs = input.maxAgeMinutes * 60_000;
  const graceMs = input.graceSeconds * 1000;
  for (const job of input.jobs) {
    const ageMs = input.now.getTime() - job.finishedAt.getTime();
    if (ageMs > maxAgeMs) markHandled.push(job.id);
    else if (ageMs < graceMs) hold.push(job.id);
    else eligible.push(job.id);
  }
  eligible.sort();
  const none = (): JobNoticeDecision => ({ group: "NONE", push: false, mail: false, notify: [], entityJobId: null, markHandled, hold });
  if (eligible.length === 0) return none();

  const push = input.pushEnabled && input.hasDevice;
  const mail = input.isModerator;
  if (!push && !mail) {
    markHandled.push(...eligible);
    return none();
  }
  if (input.lastPushAt !== null && input.now.getTime() - input.lastPushAt.getTime() < input.windowMinutes * 60_000) {
    hold.push(...eligible);
    return none();
  }
  return {
    group: eligible.length === 1 ? "SINGLE" : "MERGED",
    push,
    mail,
    notify: eligible,
    entityJobId: eligible[0],
    markHandled,
    hold,
  };
}

/** What a job is about, for the notice text. Only an account handle or a post count ever appears. */
export type JobNoticeSubject = { handle: string | null; postCount: number | null };

export type JobFinishedNoticeInput =
  | { mode: "SINGLE"; jobId: string; graphqlType: JobGraphqlType; subject: JobNoticeSubject }
  | { mode: "MERGED"; count: number };

const TYPE_LABELS: Record<JobGraphqlType, { en: string; id: string }> = {
  SUBSCRIBE: { en: "Subscribe", id: "Berlangganan" },
  PROFILE_LOOKUP: { en: "Profile lookup", id: "Pencarian profil" },
  ACCOUNT_REFRESH: { en: "Account refresh", id: "Penyegaran akun" },
  CORRECTION: { en: "Correction", id: "Koreksi" },
  EXTRACT_FROM_URL: { en: "Extract from a link", id: "Ekstraksi dari tautan" },
  EXTRACT_SELECTED_POSTS: { en: "Extract selected posts", id: "Ekstraksi postingan terpilih" },
  REEXTRACT_REFRESH: { en: "Re-extract", id: "Ekstraksi ulang" },
  ADMIN_OPERATION: { en: "Admin operation", id: "Operasi admin" },
  OTHER: { en: "Job", id: "Tugas" },
};

/** The label of a job type in English and Indonesian (every GraphQL type has one; the test enumerates `JOB_GRAPHQL_TYPES`). */
export function getJobTypeNoticeLabel(graphqlType: JobGraphqlType): { en: string; id: string } {
  return TYPE_LABELS[graphqlType];
}

const HANDLE_PATTERN = /^[A-Za-z0-9._]{1,40}$/;

function subjectText(subject: JobNoticeSubject): { en: string; id: string } | null {
  if (subject.handle !== null && HANDLE_PATTERN.test(subject.handle)) {
    const text = `@${subject.handle}`;
    return { en: text, id: text };
  }
  if (subject.postCount !== null && Number.isInteger(subject.postCount) && subject.postCount > 0) {
    const n = subject.postCount;
    return { en: `${n} ${n === 1 ? "post" : "posts"}`, id: `${n} postingan` };
  }
  return null;
}

/** The plain sentence in both languages (the mail shares it with the push so the two cannot drift). */
export function buildJobFinishedSummary(input: JobFinishedNoticeInput): { summaryEn: string; summaryId: string } {
  if (input.mode === "MERGED") {
    return { summaryEn: `${input.count} jobs finished`, summaryId: `${input.count} tugas selesai` };
  }
  const label = getJobTypeNoticeLabel(input.graphqlType);
  const subject = subjectText(input.subject);
  return {
    summaryEn: subject ? `${label.en} finished: ${subject.en}` : `${label.en} finished`,
    summaryId: subject ? `${label.id} selesai: ${subject.id}` : `${label.id} selesai`,
  };
}

export interface JobFinishedPush {
  title: string;
  body: string;
  /** Strings only, as FCM requires. */
  data: { type: "JOB_FINISHED"; path: string };
}

/** The push text: English and Indonesian in one pair (the server stores no user locale). A merged push links to `/jobs`, a single one to `/jobs/{id}`. */
export function buildJobFinishedPush(input: JobFinishedNoticeInput): JobFinishedPush {
  const { summaryEn, summaryId } = buildJobFinishedSummary(input);
  return {
    title: "FestDaily",
    body: `${summaryEn} / ${summaryId}`,
    data: { type: "JOB_FINISHED", path: input.mode === "MERGED" ? "/jobs" : `/jobs/${input.jobId}` },
  };
}
