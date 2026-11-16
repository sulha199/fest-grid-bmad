import { test } from 'node:test';
import assert from 'node:assert';
import {
  DEDUP_DECISION_CLUES,
  DEDUP_DECISION_CLUE_GROUPS,
  DEDUP_DECISION_NOTE_MAX_LENGTH,
  DedupDecisionClueError,
  parseDedupDecisionClues,
  parseDedupDecisionNote,
} from './dedup-decision-clues.js';

test('the list holds 17 distinct kebab-case codes and `other`', () => {
  assert.strictEqual(DEDUP_DECISION_CLUES.length, 17);
  assert.strictEqual(new Set(DEDUP_DECISION_CLUES).size, 17);
  for (const code of DEDUP_DECISION_CLUES) assert.match(code, /^[a-z]+(-[a-z]+)*$/);
  assert.ok(DEDUP_DECISION_CLUES.includes('other'));
});

test('every exclusive group holds known codes, and no code is in two groups, and `other` is in none', () => {
  const seen: string[] = [];
  for (const group of DEDUP_DECISION_CLUE_GROUPS) {
    assert.ok(group.length >= 2);
    for (const code of group) {
      assert.ok(DEDUP_DECISION_CLUES.includes(code));
      seen.push(code);
    }
  }
  assert.strictEqual(new Set(seen).size, seen.length);
  assert.ok(!seen.includes('other'));
});

test('omitted, null and an empty list mean no clue', () => {
  assert.strictEqual(parseDedupDecisionClues(undefined), null);
  assert.strictEqual(parseDedupDecisionClues(null), null);
  assert.strictEqual(parseDedupDecisionClues([]), null);
});

test('valid clues come back in the list order, whatever order they were sent in', () => {
  assert.deepStrictEqual(parseDedupDecisionClues(['shared-link', 'same-venue']), ['same-venue', 'shared-link']);
  assert.deepStrictEqual(parseDedupDecisionClues(['other']), ['other']);
});

test('every code is accepted alone, and one per group together', () => {
  for (const code of DEDUP_DECISION_CLUES) assert.deepStrictEqual(parseDedupDecisionClues([code]), [code]);
  assert.deepStrictEqual(
    parseDedupDecisionClues(['same-name-words', 'same-date', 'different-organizer', 'different-venue', 'other']),
    ['different-venue', 'different-organizer', 'same-date', 'same-name-words', 'other']
  );
});

test('a value that is not a list, an unknown code, a repeat and too many codes are refused', () => {
  for (const bad of ['same-venue', 7, {}, true]) {
    assert.throws(() => parseDedupDecisionClues(bad), DedupDecisionClueError);
  }
  assert.throws(() => parseDedupDecisionClues(['nope']), DedupDecisionClueError);
  assert.throws(() => parseDedupDecisionClues([1]), DedupDecisionClueError);
  assert.throws(() => parseDedupDecisionClues(['SAME-VENUE']), DedupDecisionClueError);
  assert.throws(() => parseDedupDecisionClues(['same-venue', 'same-venue']), DedupDecisionClueError);
  assert.throws(() => parseDedupDecisionClues([...DEDUP_DECISION_CLUES, 'other']), DedupDecisionClueError);
});

test('two codes of one exclusive group are refused, in either order', () => {
  for (const group of DEDUP_DECISION_CLUE_GROUPS) {
    for (const a of group) {
      for (const b of group) {
        if (a !== b) assert.throws(() => parseDedupDecisionClues([a, b]), DedupDecisionClueError);
      }
    }
  }
});

test('the error never echoes the offending value', () => {
  const secret = 'caption-text-from-a-public-post';
  assert.throws(() => parseDedupDecisionClues([secret]), (err: Error) => !err.message.includes(secret));
  assert.throws(() => parseDedupDecisionNote(secret.repeat(20)), (err: Error) => !err.message.includes(secret));
});

test('omitted, null, empty and blank notes mean no note', () => {
  for (const none of [undefined, null, '', '   ', '\n\t ']) assert.strictEqual(parseDedupDecisionNote(none), null);
});

test('a note is trimmed and kept as typed otherwise', () => {
  assert.strictEqual(parseDedupDecisionNote("  kids' run, not 10K \n"), "kids' run, not 10K");
  assert.strictEqual(parseDedupDecisionNote('line one\nline two'), 'line one\nline two');
});

test('a note of exactly the limit passes and one more character is refused', () => {
  assert.strictEqual(parseDedupDecisionNote('x'.repeat(DEDUP_DECISION_NOTE_MAX_LENGTH))?.length, DEDUP_DECISION_NOTE_MAX_LENGTH);
  assert.strictEqual(parseDedupDecisionNote(` ${'x'.repeat(DEDUP_DECISION_NOTE_MAX_LENGTH)} `)?.length, DEDUP_DECISION_NOTE_MAX_LENGTH);
  assert.throws(() => parseDedupDecisionNote('x'.repeat(DEDUP_DECISION_NOTE_MAX_LENGTH + 1)), DedupDecisionClueError);
});

test('a note that is not text, or holds NUL, is refused', () => {
  for (const bad of [7, {}, ['x'], true]) assert.throws(() => parseDedupDecisionNote(bad), DedupDecisionClueError);
  assert.throws(() => parseDedupDecisionNote('a\u0000b'), DedupDecisionClueError);
});
