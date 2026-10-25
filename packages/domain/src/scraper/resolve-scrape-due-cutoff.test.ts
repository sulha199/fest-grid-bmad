import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEDULED_SCRAPE_DUE_MARGIN_MS, resolveScrapeDueCutoff } from "./resolve-scrape-due-cutoff.js";

const HOUR = 60 * 60 * 1000;
const cron = new Date("2026-10-24T03:13:00.000Z");

test("a scheduled cycle's cutoff is its fire time minus the margin, whatever the skip window says", () => {
  const { cutoff, mode } = resolveScrapeDueCutoff({
    scheduledTime: cron,
    skipRecentHours: 12,
    now: new Date("2026-10-24T03:13:05.000Z"),
  });
  assert.equal(mode, "scheduled");
  assert.equal(cutoff.getTime(), cron.getTime() - SCHEDULED_SCRAPE_DUE_MARGIN_MS);
  assert.equal(SCHEDULED_SCRAPE_DUE_MARGIN_MS, HOUR);
});

test("2026-10-24 incident: profiles stamped by the 15:59-16:25 UTC recovery rerun are due at the 03:13 cron", () => {
  const { cutoff } = resolveScrapeDueCutoff({ scheduledTime: cron, skipRecentHours: 12, now: cron });
  const stampedByRecoveryRerun = new Date("2026-10-23T16:25:00.000Z");
  assert.ok(stampedByRecoveryRerun < cutoff, "the late rerun must not hide the profile from the next cron");
  // Under the old rolling window the same stamp (~10.8h old) was skipped.
  const oldWindow = resolveScrapeDueCutoff({ skipRecentHours: 12, now: cron });
  assert.ok(stampedByRecoveryRerun >= oldWindow.cutoff);
});

test("a duplicate delivery of the same cycle skips what the first delivery already stamped", () => {
  const { cutoff } = resolveScrapeDueCutoff({
    scheduledTime: cron,
    skipRecentHours: 12,
    now: new Date("2026-10-24T03:14:00.000Z"),
  });
  assert.ok(new Date("2026-10-24T03:13:40.000Z") >= cutoff, "stamped by this cycle: skipped");
  assert.ok(new Date("2026-10-24T02:30:00.000Z") >= cutoff, "run within the margin before the cron: skipped");
  assert.ok(new Date("2026-10-24T02:00:00.000Z") < cutoff, "older than the margin: due");
});

test("without a scheduled time the rolling skip window is used", () => {
  const now = new Date("2026-10-24T15:00:00.000Z");
  const { cutoff, mode } = resolveScrapeDueCutoff({ skipRecentHours: 12, now });
  assert.equal(mode, "recent-window");
  assert.equal(cutoff.toISOString(), "2026-10-24T03:00:00.000Z");
});

test("the margin can be overridden", () => {
  const { cutoff } = resolveScrapeDueCutoff({ scheduledTime: cron, skipRecentHours: 12, now: cron, marginMs: 5 * 60 * 1000 });
  assert.equal(cutoff.toISOString(), "2026-10-24T03:08:00.000Z");
});
