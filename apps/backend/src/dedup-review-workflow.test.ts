import test from 'node:test';
import * as assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { formatDedupReviewApplyReport, type DedupReviewApplyReport } from '@festgrid/domain/events';

// AI dedup review, piece B2b-2: the apply workflow and its guard script. Two kinds of check.
//
// The guard script (`scripts/dedup-review-apply-guard.sh`) is run against fixtures: a string match on "exit"
// would pass with a dead guard, so each guard is exercised.
//
// The workflow is read as TEXT (no YAML parser is a declared dependency of apps/backend, and CI installs with
// a frozen lockfile), after dropping full-line comments. It pins the properties that keep the write
// credential behind its gate. Must run with `apps/backend` as the working directory, like the other
// source-scan tests.

const ROOT = resolve(process.cwd(), '..', '..');
const WORKFLOW = join(ROOT, '.github', 'workflows', 'dedup-review-apply.yml');
const EXPORT_WORKFLOW = join(ROOT, '.github', 'workflows', 'dedup-review-export.yml');
const GUARD = join(ROOT, 'scripts', 'dedup-review-apply-guard.sh');

const WRITE_SECRET = 'secrets.DEDUP_REVIEW_APPLY_DATABASE_URL';
const READ_SECRET = 'secrets.DEDUP_REVIEW_READONLY_DATABASE_URL';

/**
 * Actions that are still pinned by tag, not by commit SHA. The SHAs could not be looked up when the workflow
 * was written, and the owner decided (2026-11-01) that the write secret is created only once these are
 * pinned. When they are, empty this list and delete the warning from the workflow header.
 */
const KNOWN_UNPINNED = ['actions/checkout@v4', 'actions/setup-node@v4', 'pnpm/action-setup@v3'];

function stripComments(text: string): string {
  return text
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/** The body of every `run:` step: a block scalar (`|`, `>`, with chomping marks) or an inline command. */
function extractRunBodies(text: string): string[] {
  const lines = text.split('\n');
  const bodies: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^(\s*)(?:- )?run:\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const keyIndent = indentOf(lines[i]) + (lines[i].trimStart().startsWith('- ') ? 2 : 0);
    const rest = match[2].trim();
    if (/^[|>][+-]?$/.test(rest)) {
      const body: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() !== '' && indentOf(lines[j]) <= keyIndent) break;
        body.push(lines[j]);
      }
      bodies.push(body.join('\n'));
    } else {
      bodies.push(rest);
    }
  }
  return bodies;
}

/** The text of each top-level job, by name. */
function extractJobs(text: string): Record<string, string> {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  const jobs: Record<string, string[]> = {};
  let current: string | null = null;
  for (const line of lines.slice(start + 1)) {
    const header = /^ {2}([A-Za-z][\w-]*):\s*$/.exec(line);
    if (header) {
      current = header[1];
      jobs[current] = [];
    } else if (current) {
      jobs[current].push(line);
    }
  }
  return Object.fromEntries(Object.entries(jobs).map(([name, body]) => [name, body.join('\n')]));
}

/** The keys directly under a top-level block such as `on:` or `permissions:`. */
function topLevelBlock(text: string, key: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => new RegExp(`^${key}:\\s*$`).test(line));
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') continue;
    if (indentOf(line) === 0) break;
    out.push(line);
  }
  return out;
}

const hasExpressionInRunBody = (text: string) => extractRunBodies(stripComments(text)).some((body) => body.includes('${{'));
const unpinnedActions = (text: string) => [...new Set([...stripComments(text).matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]).filter((uses) => !/@[0-9a-f]{40}$/.test(uses)))].sort();

test('dedup-review-apply workflow (text checks)', async (t) => {
  const raw = readFileSync(WORKFLOW, 'utf8');
  const text = stripComments(raw);
  const jobs = extractJobs(text);

  await t.test('has exactly the three jobs, each gated to master', () => {
    assert.deepStrictEqual(Object.keys(jobs), ['inputs', 'validate', 'apply']);
    for (const [name, body] of Object.entries(jobs)) {
      assert.match(body, /\n\s+if:\s*github\.ref == 'refs\/heads\/master'/, `${name} runs only from master`);
    }
  });

  await t.test('is dispatched by hand only, with read-only repository permissions', () => {
    const triggers = topLevelBlock(text, 'on')
      .filter((line) => indentOf(line) === 2)
      .map((line) => line.trim().replace(/:.*$/, ''));
    assert.deepStrictEqual(triggers, ['workflow_dispatch']);
    assert.deepStrictEqual(
      topLevelBlock(text, 'permissions').map((line) => line.trim()),
      ['contents: read']
    );
  });

  await t.test('no input, secret or variable is ever interpolated into shell text', () => {
    assert.ok(!hasExpressionInRunBody(raw), 'a ${{ }} expression sits inside a run: body; pass it through env: instead');
    assert.ok(extractRunBodies(text).length >= 8, 'the scan found the run bodies');
  });

  await t.test('environments are static: none for the input check, dedup-review for validate, dedup-review-live for apply', () => {
    assert.ok(!/environment:/.test(jobs.inputs));
    assert.match(jobs.validate, /\n\s+environment: dedup-review\n/);
    assert.match(jobs.apply, /\n\s+environment: dedup-review-live\n/);
  });

  await t.test('each database secret appears only in its own job, and never behind a fallback', () => {
    assert.ok(!jobs.inputs.includes('secrets.'));
    assert.ok(jobs.validate.includes(READ_SECRET) && !jobs.validate.includes(WRITE_SECRET), 'validate holds only the read-only secret');
    assert.ok(jobs.apply.includes(WRITE_SECRET) && !jobs.apply.includes(READ_SECRET), 'apply holds only the write secret');
    for (const line of text.split('\n').filter((l) => l.includes('secrets.'))) {
      assert.ok(!line.includes('||') && !line.includes('&&'), `a secret must not sit in a fallback expression: ${line.trim()}`);
    }
    // Only the credential check and the script step carry a database URL.
    for (const body of [jobs.validate, jobs.apply]) {
      assert.strictEqual([...body.matchAll(/DATABASE_URL:\s*\$\{\{ secrets\./g)].length, 2);
    }
  });

  await t.test('all apply runs share one serialized group, and nothing is ever cancelled in progress', () => {
    assert.match(jobs.apply, /group: dedup-review-apply-write\n/);
    assert.ok(!/cancel-in-progress:\s*true/.test(text));
    assert.strictEqual([...text.matchAll(/cancel-in-progress:\s*false/g)].length, 2);
  });

  await t.test('the install is hardened in the jobs that hold a credential', () => {
    for (const name of ['validate', 'apply']) {
      assert.match(jobs[name], /pnpm install --frozen-lockfile --ignore-scripts/);
      assert.ok(!/pnpm install(?! --frozen-lockfile --ignore-scripts)/.test(jobs[name]), `${name}: every install ignores scripts`);
      assert.strictEqual(
        [...jobs[name].matchAll(/actions\/checkout@/g)].length,
        [...jobs[name].matchAll(/persist-credentials: false/g)].length,
        `${name}: checkout never persists the token`
      );
      assert.ok(!/\n\s+cache:/.test(jobs[name]), `${name}: no restored cache next to a credential`);
    }
  });

  await t.test('apply refuses a moved master, a missing secret and anything but an explicit false or 0 kill switch', () => {
    assert.ok(jobs.apply.includes('git fetch --depth=1 origin master') && jobs.apply.includes('"$GITHUB_SHA"'), 'the head check');
    assert.match(jobs.apply, /case "\$DISABLED" in\s*\n\s+false \| 0\) ;;\s*\n\s+\*\)/);
    assert.ok(jobs.apply.includes('DISABLED: ${{ vars.DEDUP_REVIEW_APPLY_DISABLED }}'));
    assert.ok(jobs.apply.includes('DEDUP_REVIEW_APPLY_DISABLED: ${{ vars.DEDUP_REVIEW_APPLY_DISABLED }}'), 'the script gets the variable too');
    assert.ok(!jobs.validate.includes('vars.'), 'the read-only job reads no variable');
  });

  await t.test('the script is only ever run through the guard, with the status captured', () => {
    for (const [name, mode] of [['validate', 'validate false'], ['apply', 'apply "$LIVE"']] as const) {
      assert.ok(jobs[name].includes('rc=$?'), `${name} captures the exit status`);
      assert.ok(jobs[name].includes(`bash scripts/dedup-review-apply-guard.sh "$RUNNER_TEMP/dedup-review-apply.out" "$rc" ${mode}`), `${name} calls the guard`);
      const scriptStep = extractRunBodies(jobs[name]).find((body) => body.includes('dedup-review-apply.ts')) ?? '';
      assert.ok(scriptStep !== '' && !/\bset -[a-z]*e/.test(scriptStep), `${name}: the step that runs the script must not stop on its failure (set -e) before the guard sees its status`);
    }
    assert.ok(jobs.apply.includes('args+=(--live)') && jobs.apply.includes('if [ "$LIVE" = true ]'));
    assert.ok(!jobs.validate.includes('--live'));
  });

  await t.test('actions that are not pinned by SHA are exactly the known list, and the write secret warning stays until it is empty', () => {
    assert.deepStrictEqual(unpinnedActions(raw), [...KNOWN_UNPINNED].sort(), 'pin an action, or add it to KNOWN_UNPINNED on purpose');
    assert.strictEqual(raw.includes('DO NOT CREATE THIS SECRET'), KNOWN_UNPINNED.length > 0, 'the header warns about the write secret exactly while an action is unpinned');
  });

  await t.test('the scans catch what they are meant to catch (negative controls)', () => {
    assert.ok(/\bset -[a-z]*e/.test('set -euo pipefail') && /\bset -[a-z]*e/.test('set -e') && !/\bset -[a-z]*e/.test('set -uo pipefail'), 'the set -e check');
    assert.ok(hasExpressionInRunBody('steps:\n  - run: echo ${{ inputs.mode }}'), 'an inline run');
    assert.ok(hasExpressionInRunBody('steps:\n  - name: x\n    run: |\n      echo "hello"\n      echo ${{ inputs.decisions }}\n    env:\n      A: b'), 'a block run');
    assert.ok(hasExpressionInRunBody('steps:\n  - name: x\n    run: >-\n      echo ${{ secrets.X }}\n'), 'a folded run');
    assert.ok(!hasExpressionInRunBody('steps:\n  - name: x\n    env:\n      A: ${{ inputs.mode }}\n    run: |\n      echo "$A"\n'), 'an env expression is fine');
    assert.ok(!hasExpressionInRunBody('steps:\n  - name: x\n    run: |\n      # ${{ inputs.mode }} in a shell comment is stripped\n      echo hi\n'), 'a comment line is ignored');
    assert.deepStrictEqual(unpinnedActions('uses: actions/checkout@v4\nuses: a/b@' + 'a'.repeat(40)), ['actions/checkout@v4']);
    assert.deepStrictEqual(Object.keys(extractJobs('jobs:\n  one:\n    runs-on: x\n  two:\n    runs-on: y\n')), ['one', 'two']);
  });

  await t.test('the export workflow, which this one mirrors, passes the same input-injection check', () => {
    assert.ok(!hasExpressionInRunBody(readFileSync(EXPORT_WORKFLOW, 'utf8')));
  });
});

test('dedup-review-apply guard script', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ddap-guard-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const ID = '11111111-1111-4111-8111-111111111111';
  const MERGE_ID = '99999999-9999-4999-8999-999999999999';
  const report = (overrides: Partial<DedupReviewApplyReport> = {}): DedupReviewApplyReport => ({
    schemaVersion: 1,
    generatedAt: '2026-11-01T00:00:00.000Z',
    runTag: 'daily-1',
    mode: 'live',
    killSwitch: false,
    usedLast24h: 3,
    caps: { perRun: 10, perDay: 25 },
    counts: { eligible: 0, merged: 1, skipped: 2 },
    results: [
      { suggestionId: ID, outcome: 'merged', mergeId: MERGE_ID },
      { suggestionId: '22222222-2222-4222-8222-222222222222', outcome: 'skipped', reason: 'no-anchor' },
      { suggestionId: '33333333-3333-4333-8333-333333333333', outcome: 'skipped', reason: 'no-anchor' },
    ],
    ...overrides,
  });

  let n = 0;
  function run(content: string, rc: number, mode: string, live: string) {
    const file = join(dir, `out-${++n}.txt`);
    const summary = join(dir, `summary-${n}.md`);
    writeFileSync(file, content);
    writeFileSync(summary, '');
    const result = spawnSync('bash', [GUARD, file, String(rc), mode, live], {
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', GITHUB_STEP_SUMMARY: summary },
      encoding: 'utf8',
    });
    return { status: result.status, out: result.stdout, summary: readFileSync(summary, 'utf8') };
  }
  const printed = (r: DedupReviewApplyReport) => formatDedupReviewApplyReport(r).join('\n') + '\n';

  await t.test('the script has valid bash syntax', () => {
    assert.strictEqual(spawnSync('bash', ['-n', GUARD]).status, 0);
  });

  await t.test('a live run: prints the output, summarizes counts and reason codes, and never an id or a merge id', () => {
    const content = printed(report());
    const result = run(content, 0, 'apply', 'true');
    assert.strictEqual(result.status, 0);
    assert.ok(result.out.includes(content.trim()), 'the output goes into the log');
    assert.match(result.summary, /- mode: `live`/);
    assert.match(result.summary, /- run tag: `daily-1`/);
    assert.match(result.summary, /- eligible: 0, merged: 1, skipped: 2/);
    assert.match(result.summary, /- skipped by reason: no-anchor: 2/);
    assert.match(result.summary, /- AI decisions in the last 24 hours before this run: 3/);
    assert.ok(!result.summary.includes(ID) && !result.summary.includes(MERGE_ID), 'no id in the public summary');
  });

  await t.test('validate and a dry run expect their own mode', () => {
    assert.strictEqual(run(printed(report({ mode: 'validate', counts: { eligible: 1, merged: 0, skipped: 0 }, results: [] })), 0, 'validate', 'false').status, 0);
    assert.strictEqual(run(printed(report({ mode: 'dry-run', counts: { eligible: 1, merged: 0, skipped: 0 }, results: [] })), 0, 'apply', 'false').status, 0);
    assert.match(run(printed(report({ mode: 'dry-run', results: [], counts: { eligible: 0, merged: 0, skipped: 0 } })), 0, 'apply', 'false').summary, /skipped by reason: none/);
  });

  await t.test('a report whose mode does not match the run is refused', () => {
    for (const [reportMode, mode, live] of [['live', 'apply', 'false'], ['dry-run', 'apply', 'true'], ['live', 'validate', 'false'], ['validate', 'apply', 'true']] as const) {
      const result = run(printed(report({ mode: reportMode })), 0, mode, live);
      assert.strictEqual(result.status, 1, `${reportMode} for ${mode} live=${live}`);
      assert.match(result.out, /::error::The report says mode/);
    }
  });

  await t.test('a disabled report is accepted for any mode, with n/a where nothing was counted', () => {
    const disabled = report({ mode: 'disabled', killSwitch: true, usedLast24h: null, runTag: null, counts: { eligible: 0, merged: 0, skipped: 0 }, results: [] });
    for (const [mode, live] of [['validate', 'false'], ['apply', 'false'], ['apply', 'true']] as const) {
      const result = run(printed(disabled), 0, mode, live);
      assert.strictEqual(result.status, 0);
      assert.match(result.summary, /kill switch: true/);
      assert.match(result.summary, /last 24 hours before this run: n\/a/);
      assert.match(result.summary, /run tag: `none`/);
    }
  });

  await t.test('no markers, one marker, no report between them, or a report that is not JSON all fail even with status 0', () => {
    const bad = [
      'some other output\n',
      'DEDUP_REVIEW_APPLY_BEGIN\n{"mode":"live"}\n',
      'DEDUP_REVIEW_APPLY_BEGIN\nDEDUP_REVIEW_APPLY_END\n',
      'DEDUP_REVIEW_APPLY_BEGIN\nnot json at all\nDEDUP_REVIEW_APPLY_END\n',
    ];
    for (const content of bad) {
      assert.strictEqual(run(content, 0, 'apply', 'true').status, 1, content);
    }
  });

  await t.test('a non-zero status is passed on, and a live apply says it is one transaction and where to look', () => {
    const live = run('', 1, 'apply', 'true');
    assert.strictEqual(live.status, 1);
    assert.match(live.out, /::error::The live apply exited with status 1\. The run is one transaction, so this usually means it rolled back/);
    assert.match(live.out, /performed_via = 'ai_skill'/);
    assert.ok(!/may already be committed/.test(live.out), 'it does not claim a commit it cannot know about');

    assert.strictEqual(run('', 3, 'apply', 'true').status, 3);
    const dry = run('', 1, 'apply', 'false');
    assert.strictEqual(dry.status, 1);
    assert.match(dry.out, /changed nothing that persists/);
    assert.match(run('', 1, 'validate', 'false').out, /changed nothing that persists/);
    assert.match(run('', 1, 'apply', 'banana').out, /changed nothing that persists/, 'anything but exactly true is not live');
  });

  await t.test('a non-zero status with a printed report still fails (the run cannot be trusted)', () => {
    assert.strictEqual(run(printed(report()), 1, 'apply', 'true').status, 1);
  });
});
