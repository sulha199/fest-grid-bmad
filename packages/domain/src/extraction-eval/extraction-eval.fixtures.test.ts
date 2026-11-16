import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  aggregateRuns,
  buildBaseline,
  buildReport,
  classifyRun,
  compareToBaseline,
  parseBaseline,
  parseLabelledPost,
  parseRecordedOutputs,
  type LabelledPost,
  type ScorablePayload,
} from './index.js';

/**
 * The committed SYNTHETIC set (apps/backend/scripts/fixtures/extraction-eval-synthetic) is what the runner's `--replay` and the
 * non-blocking workflow score. These tests load the same files, so the numbers quoted in the docs and the spec's acceptance
 * criteria ("the numbers equal a hand calculation on the synthetic fixtures", "--replay matches the recorded run") fail here, on
 * every PR, if the scorer, the labels, the recording or the baseline drift apart. No network, no key.
 */
const dir = fileURLToPath(new URL('../../../../apps/backend/scripts/fixtures/extraction-eval-synthetic/', import.meta.url));
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

const posts: LabelledPost[] = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(`${dir}${d.name}/label.json`))
  .map((d) => {
    const post = parseLabelledPost(readJson(`${dir}${d.name}/label.json`), d.name);
    assert.equal(post.postId, d.name, 'the folder name is the post id');
    for (const image of post.images) assert.ok(existsSync(`${dir}${d.name}/${image}`), `${d.name}/${image} exists`);
    return post;
  });
const recorded = parseRecordedOutputs(readJson(`${dir}recorded.json`), 'recorded.json');
const baseline = parseBaseline(readJson(`${dir}baseline.json`), 'baseline.json');

// The runner's own post-answer step also validates the schema; the recorded answers are already valid, so parsing is enough here.
const parse = (text: string): ScorablePayload | undefined => {
  try {
    return JSON.parse(text) as ScorablePayload;
  } catch {
    return undefined;
  }
};
const byId = new Map(posts.map((p) => [p.postId, p]));
const aggregate = aggregateRuns(recorded.runs.map((r) => classifyRun(byId.get(r.postId)!, r, parse)));

test('synthetic set: four posts, invented data only', () => {
  assert.deepEqual(posts.map((p) => p.postId).sort(), ['syn-multi-date', 'syn-not-event', 'syn-single', 'syn-three-branches']);
  for (const post of posts) {
    const text = JSON.stringify(post);
    assert.doesNotMatch(text, /wa\.me|@[a-z0-9-]+\.[a-z]{2,}|instagram\.com|\+?\d{9,}/i, `${post.postId} holds no contact data or real link`);
  }
});

test('synthetic set: the replay gives the documented numbers (hand calculation)', () => {
  const close = (actual: number | null, expected: number | null, name: string): void =>
    assert.ok(expected === null ? actual === null : actual !== null && Math.abs(actual - expected) < 1e-9, `${name}: ${actual} vs ${expected}`);
  const f = aggregate.fields;
  close(f.groupingReason, 5 / 6, 'groupingReason'); // 83 %
  close(f.eventCount, 7 / 8, 'eventCount'); // 88 %
  close(f.eventName, 8 / 9, 'eventName'); // 89 %
  close(f.startDate, 1, 'startDate');
  close(f.endDate, null, 'endDate'); // no label asks for it
  close(f.startTime, 1, 'startTime');
  close(f.endTime, 1, 'endTime');
  close(f.location, 2 / 3, 'location'); // 67 %
  close(f.ticket, 5 / 6, 'ticket'); // 83 %
  close(f.categoriesPrecision, 1, 'categoriesPrecision');
  close(f.categoriesRecall, 1, 'categoriesRecall');
  close(f.performers, 3 / 4, 'performers'); // 75 %
  assert.deepEqual(aggregate.totals, { ok: 10, truncated: 1, unavailable: 1, countMismatch: 1 });
});

test('synthetic set: the split-vs-fold post reports count_mismatch with the missing events listed', () => {
  const post = aggregate.posts['syn-three-branches']!;
  assert.equal(post.countMismatchRuns, 1);
  assert.equal(post.unavailableRuns, 1);
  assert.deepEqual(post.missing.map((m) => m.index), [1, 2]);
  assert.equal(aggregate.posts['syn-single']!.truncatedRuns, 1);
});

test('synthetic set: baseline.json reproduces from the recording, so replaying it flags nothing', () => {
  const rebuilt = buildBaseline(aggregate, { model: recorded.model, promptHash: recorded.promptHash, date: baseline.date, runs: baseline.runs });
  assert.deepEqual(JSON.parse(JSON.stringify(rebuilt)), JSON.parse(JSON.stringify(baseline)));
  const cmp = compareToBaseline(aggregate, baseline);
  assert.deepEqual(cmp.fields.filter((c) => c.status === 'flagged' || c.status === 'single_run'), []);
  assert.equal(cmp.truncatedRate.status, 'ok');
  assert.deepEqual([cmp.newPosts, cmp.removedPosts], [[], []]);
  const md = buildReport(aggregate, { model: recorded.model, promptHash: recorded.promptHash, runs: 3, mode: 'replay' }, baseline, cmp).markdown;
  assert.match(md, /No field dropped beyond its noise band\./);
  assert.match(md, /Scored runs: 10\. Truncated .*: 1\. Unavailable .*: 1\. Runs with count_mismatch: 1\./);
});
