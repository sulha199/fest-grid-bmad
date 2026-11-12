import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { DirectoryStorage } from './storage.js';
import { buildFakeBucket, DRAFT_IDS, tempDir } from './review-test-support.js';
import {
  assertOutsideRepo,
  clearEdited,
  defaultWorkDir,
  layoutOf,
  listDraftIds,
  loadDraft,
  loadEntry,
  loadProgress,
  readEdited,
  safeFlags,
  saveProgress,
  stageVerified,
  writeEdited,
} from './work-dir.js';

async function freshLayout(): Promise<ReturnType<typeof layoutOf>> {
  const layout = layoutOf(tempDir('review-work'));
  await new DirectoryStorage(buildFakeBucket()).downloadDrafts(layout.drafts);
  return layout;
}

test('the default working directory is in the home folder, and a directory inside the repository is refused', () => {
  assert.equal(defaultWorkDir(), join(homedir(), '.extraction-eval-review'));
  assert.throws(() => assertOutsideRepo('/repo/apps/work', '/repo'), /inside the repository checkout/);
  assert.throws(() => assertOutsideRepo('/repo', '/repo'), /inside the repository checkout/);
  assert.throws(() => assertOutsideRepo('/repo/../repo/x', '/repo'), /inside the repository checkout/);
  assert.doesNotThrow(() => assertOutsideRepo('/home/me/.extraction-eval-review', '/repo'));
  assert.doesNotThrow(() => assertOutsideRepo('/repository-two/work', '/repo'));
});

test('listDraftIds lists folders that hold a label.json, sorted, and tolerates a missing directory', async () => {
  const layout = await freshLayout();
  mkdirSync(join(layout.drafts, 'p-empty'));
  mkdirSync(join(layout.drafts, 'not a valid id'));
  writeFileSync(join(layout.drafts, 'stray.txt'), 'x');
  assert.deepEqual(listDraftIds(layout.drafts), [DRAFT_IDS.single, DRAFT_IDS.multi, DRAFT_IDS.notEvent]);
  assert.deepEqual(listDraftIds(join(layout.root, 'nowhere')), []);
});

test('loadDraft validates with the runner parser and reads the provenance', async () => {
  const layout = await freshLayout();
  const draft = loadDraft(layout.drafts, DRAFT_IDS.multi);
  assert.equal(draft.label.postId, DRAFT_IDS.multi);
  assert.equal(draft.meta.stratum, 'roundup');
  assert.equal(draft.meta.extractedBeforeCursorPath, true);
  assert.deepEqual(draft.warnings, []);
  assert.throws(() => loadDraft(layout.drafts, '../x'), /not a valid post id/);
  assert.throws(() => loadDraft(layout.drafts, 'p-nothere'), /label.json is not readable as JSON/);
});

test('loadDraft: a postId that does not match the folder, a bad draft.json and missing images are reported without content', async () => {
  const layout = await freshLayout();
  const dir = join(layout.drafts, DRAFT_IDS.single);
  const label = JSON.parse(readFileSync(join(dir, 'label.json'), 'utf8'));
  writeFileSync(join(dir, 'label.json'), JSON.stringify({ ...label, postId: 'p-other' }));
  assert.throws(() => loadDraft(layout.drafts, DRAFT_IDS.single), /postId does not match its folder name/);
  writeFileSync(join(dir, 'label.json'), JSON.stringify(label));

  writeFileSync(join(dir, 'draft.json'), '{ not json SECRET-TEXT');
  let draft = loadDraft(layout.drafts, DRAFT_IDS.single);
  assert.deepEqual(draft.warnings, ['draft.json is not readable as JSON']);
  assert.deepEqual(draft.meta, {});

  rmSync(join(dir, 'draft.json'));
  rmSync(join(dir, label.images[0]));
  draft = loadDraft(layout.drafts, DRAFT_IDS.single);
  assert.deepEqual(draft.warnings, ['draft.json is missing; the provenance is unknown', '1 image file(s) named in label.json are missing from the folder']);
});

test('loadEntry returns the draft, flags and any saved edit, and never throws', async () => {
  const layout = await freshLayout();
  let entry = loadEntry(layout, DRAFT_IDS.multi);
  assert.ok(entry.ok);
  if (!entry.ok) return;
  assert.equal(entry.edited, false);
  assert.deepEqual(entry.flags.map((f) => f.flag).sort(), ['before_cursor_path', 'chain']);

  writeEdited(layout, DRAFT_IDS.multi, { ...entry.draft.label, events: [] });
  entry = loadEntry(layout, DRAFT_IDS.multi);
  assert.ok(entry.ok && entry.edited && entry.current.events.length === 0);

  // a damaged edit file (not an object) is ignored; a half-finished edit without events still opens
  writeFileSync(join(layout.edits, `${DRAFT_IDS.multi}.json`), '[]');
  entry = loadEntry(layout, DRAFT_IDS.multi);
  assert.ok(entry.ok && !entry.edited);
  writeEdited(layout, DRAFT_IDS.multi, { groupingReason: 'single-event' });
  entry = loadEntry(layout, DRAFT_IDS.multi);
  assert.ok(entry.ok && entry.edited);
  writeFileSync(join(layout.edits, `${DRAFT_IDS.multi}.json`), 'not json');
  const broken = loadEntry(layout, DRAFT_IDS.multi);
  assert.deepEqual(broken, { postId: DRAFT_IDS.multi, ok: false, problem: 'the saved edit is not readable as JSON' });
  assert.deepEqual(loadEntry(layout, 'p-nothere'), { postId: 'p-nothere', ok: false, problem: 'label.json is not readable as JSON' });
});

test('safeFlags: a working label that is not shaped like a label has no flags instead of an error', async () => {
  const layout = await freshLayout();
  const draft = loadDraft(layout.drafts, DRAFT_IDS.single);
  assert.deepEqual(safeFlags({ ...draft.label, events: [{ eventName: 'x', schedules: null }] } as never, draft), []);
});

test('edits are written, read and cleared per post, and only for a valid post id', async () => {
  const layout = await freshLayout();
  assert.equal(readEdited(layout, DRAFT_IDS.single), undefined);
  writeEdited(layout, DRAFT_IDS.single, { a: 1 });
  assert.deepEqual(readEdited(layout, DRAFT_IDS.single), { a: 1 });
  assert.ok(!existsSync(join(layout.edits, `${DRAFT_IDS.single}.json.tmp`)));
  clearEdited(layout, DRAFT_IDS.single);
  assert.equal(readEdited(layout, DRAFT_IDS.single), undefined);
  clearEdited(layout, DRAFT_IDS.single);
  for (const fn of [() => readEdited(layout, '../x'), () => writeEdited(layout, '../x', {}), () => clearEdited(layout, '../x')]) assert.throws(fn, /not a valid post id/);
});

test('progress is saved atomically, read back, and a damaged file starts an empty record with a warning', async () => {
  const layout = await freshLayout();
  assert.deepEqual(loadProgress(layout), { record: {}, warnings: [] });
  saveProgress(layout, { [DRAFT_IDS.single]: { status: 'verified', at: '2026-01-01T00:00:00.000Z' } });
  assert.deepEqual(loadProgress(layout).record[DRAFT_IDS.single]?.status, 'verified');
  writeFileSync(layout.progress, '{ broken');
  const damaged = loadProgress(layout);
  assert.deepEqual(damaged.record, {});
  assert.match(damaged.warnings[0]!, /progress.json is not readable as JSON; starting with an empty record/);
});

test('stageVerified writes label.json and the images, replaces an older staging, and never copies draft.json', async () => {
  const layout = await freshLayout();
  const draft = loadDraft(layout.drafts, DRAFT_IDS.single);
  const dir = stageVerified(layout, draft.label);
  assert.equal(dir, join(layout.verified, DRAFT_IDS.single));
  assert.ok(existsSync(join(dir, 'label.json')));
  for (const image of draft.label.images) assert.ok(existsSync(join(dir, image)));
  assert.ok(!existsSync(join(dir, 'draft.json')));
  writeFileSync(join(dir, 'leftover.txt'), 'x');
  stageVerified(layout, draft.label);
  assert.ok(!existsSync(join(dir, 'leftover.txt')));

  rmSync(join(layout.drafts, DRAFT_IDS.single, draft.label.images[0]!));
  assert.throws(() => stageVerified(layout, draft.label), /an image named in the label is missing from the draft folder/);
  assert.throws(() => stageVerified(layout, { ...draft.label, postId: '../x' }), /not a valid post id/);
});
