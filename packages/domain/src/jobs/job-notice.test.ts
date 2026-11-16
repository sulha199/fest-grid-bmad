import { test } from "node:test";
import assert from "node:assert/strict";
import { JOB_GRAPHQL_TYPES } from "./job-presentation.js";
import { buildJobFinishedPush, buildJobFinishedSummary, decideJobNotice, getJobTypeNoticeLabel, type DecideJobNoticeInput } from "./job-notice.js";

// Story 10.13 -- the pure rules of the job-finished notice.

const now = new Date("2026-11-14T12:00:00.000Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);
const base: Omit<DecideJobNoticeInput, "jobs"> = { pushEnabled: true, hasDevice: true, isModerator: false, lastPushAt: null, now, windowMinutes: 10, graceSeconds: 45, maxAgeMinutes: 60 };
const job = (id: string, secondsAgo: number) => ({ id, finishedAt: ago(secondsAgo) });

test("no pending job gives no group", () => {
  const d = decideJobNotice({ ...base, jobs: [] });
  assert.deepEqual(d, { group: "NONE", push: false, mail: false, notify: [], entityJobId: null, markHandled: [], hold: [] });
});

test("one job past the grace is a SINGLE push", () => {
  const d = decideJobNotice({ ...base, jobs: [job("a", 120)] });
  assert.deepEqual([d.group, d.push, d.mail, d.notify, d.entityJobId], ["SINGLE", true, false, ["a"], "a"]);
});

test("a job younger than the grace is held, one at the grace edge is eligible", () => {
  assert.deepEqual(decideJobNotice({ ...base, jobs: [job("a", 44)] }).hold, ["a"]);
  assert.equal(decideJobNotice({ ...base, jobs: [job("a", 44)] }).group, "NONE");
  assert.equal(decideJobNotice({ ...base, jobs: [job("a", 45)] }).group, "SINGLE");
});

test("a job older than the max age is handled with no notice (also the first run after a deploy), the edge is still announced", () => {
  const d = decideJobNotice({ ...base, jobs: [job("old", 3601), job("edge", 3600)] });
  assert.deepEqual(d.markHandled, ["old"]);
  assert.deepEqual(d.notify, ["edge"]);
});

test("two or more eligible jobs are one MERGED group whose entity is the smallest id", () => {
  const d = decideJobNotice({ ...base, jobs: [job("c", 100), job("a", 200), job("b", 300)] });
  assert.deepEqual([d.group, d.notify, d.entityJobId], ["MERGED", ["a", "b", "c"], "a"]);
});

test("push is off or no device: handled with nothing sent for a non-moderator", () => {
  for (const patch of [{ pushEnabled: false }, { hasDevice: false }]) {
    const d = decideJobNotice({ ...base, ...patch, jobs: [job("a", 100)] });
    assert.deepEqual([d.group, d.push, d.mail, d.markHandled, d.hold], ["NONE", false, false, ["a"], []]);
  }
});

test("a moderator with push off still gets the mail, and with push on gets both", () => {
  const mailOnly = decideJobNotice({ ...base, pushEnabled: false, isModerator: true, jobs: [job("a", 100)] });
  assert.deepEqual([mailOnly.group, mailOnly.push, mailOnly.mail], ["SINGLE", false, true]);
  const both = decideJobNotice({ ...base, isModerator: true, jobs: [job("a", 100)] });
  assert.deepEqual([both.push, both.mail], [true, true]);
});

test("inside the merge window the group is held; once it closes it goes out", () => {
  const inside = decideJobNotice({ ...base, lastPushAt: ago(9 * 60 + 59), jobs: [job("a", 100), job("b", 100)] });
  assert.deepEqual([inside.group, inside.hold], ["NONE", ["a", "b"]]);
  const closed = decideJobNotice({ ...base, lastPushAt: ago(10 * 60), jobs: [job("a", 100), job("b", 100)] });
  assert.equal(closed.group, "MERGED");
});

test("the channel check comes before the window: a no-channel group is handled even inside the window", () => {
  const d = decideJobNotice({ ...base, pushEnabled: false, lastPushAt: ago(60), jobs: [job("a", 100)] });
  assert.deepEqual([d.markHandled, d.hold], [["a"], []]);
});

test("the type label exists in both languages for every GraphQL job type", () => {
  for (const type of JOB_GRAPHQL_TYPES) {
    const label = getJobTypeNoticeLabel(type);
    assert.ok(label.en.length > 0 && label.id.length > 0, type);
  }
});

test("a single summary names the type and the handle with its @, or the number of posts, in both languages", () => {
  const account = buildJobFinishedSummary({ mode: "SINGLE", jobId: "j", graphqlType: "ACCOUNT_REFRESH", subject: { handle: "fest.daily_1", postCount: null } });
  assert.deepEqual(account, { summaryEn: "Account refresh finished: @fest.daily_1", summaryId: "Penyegaran akun selesai: @fest.daily_1" });
  const posts = buildJobFinishedSummary({ mode: "SINGLE", jobId: "j", graphqlType: "EXTRACT_SELECTED_POSTS", subject: { handle: null, postCount: 3 } });
  assert.deepEqual(posts, { summaryEn: "Extract selected posts finished: 3 posts", summaryId: "Ekstraksi postingan terpilih selesai: 3 postingan" });
  assert.equal(buildJobFinishedSummary({ mode: "SINGLE", jobId: "j", graphqlType: "CORRECTION", subject: { handle: null, postCount: 1 } }).summaryEn, "Correction finished: 1 post");
});

test("no usable subject reads as the type alone; an odd handle or count is never printed", () => {
  for (const subject of [{ handle: null, postCount: null }, { handle: "<script>x", postCount: null }, { handle: "a b", postCount: 0 }, { handle: "x".repeat(41), postCount: 1.5 }]) {
    assert.equal(buildJobFinishedSummary({ mode: "SINGLE", jobId: "j", graphqlType: "OTHER", subject }).summaryEn, "Job finished");
  }
});

test("a merged summary and push say N jobs finished and link to /jobs", () => {
  assert.deepEqual(buildJobFinishedSummary({ mode: "MERGED", count: 3 }), { summaryEn: "3 jobs finished", summaryId: "3 tugas selesai" });
  assert.deepEqual(buildJobFinishedPush({ mode: "MERGED", count: 3 }), { title: "FestDaily", body: "3 jobs finished / 3 tugas selesai", data: { type: "JOB_FINISHED", path: "/jobs" } });
});

test("a single push links to the job and carries both languages", () => {
  const push = buildJobFinishedPush({ mode: "SINGLE", jobId: "0b8a", graphqlType: "REEXTRACT_REFRESH", subject: { handle: "acct", postCount: null } });
  assert.equal(push.data.path, "/jobs/0b8a");
  assert.equal(push.body, "Re-extract finished: @acct / Ekstraksi ulang selesai: @acct");
});
