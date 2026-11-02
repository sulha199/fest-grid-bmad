import test from 'node:test';
import * as assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { formatDedupReviewApplyReport, type DedupReviewApplyReport } from '@festgrid/domain/events';

// AI dedup review, piece B2b-2: the apply workflow and its guard script. Three kinds of check.
//
// 1. The guard script (`scripts/dedup-review-apply-guard.sh`) is run against fixtures: a string match on "exit"
//    would pass with a dead guard, so each guard is exercised.
// 2. The workflow's two script steps are EXECUTED, the way GitHub runs them (`bash -e <file>`), with a stub in
//    place of `pnpm`. A text scan cannot see that GitHub's default shell stops a step on the first failing
//    command, which once made the guard unreachable.
// 3. The workflow is read as TEXT (no YAML parser is a declared dependency of apps/backend, and CI installs with
//    a frozen lockfile), after dropping full-line comments, to pin the properties that keep the write
//    credential behind its gate.
//
// Needs `bash` and `jq` (present on the CI runners and the dev containers). Must run with `apps/backend` as the
// working directory, like the other source-scan tests.

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

/** The body of every `run:` step: a block scalar (`|`, `>`, with chomping marks), or an inline command plus any continuation lines. */
function extractRunBodies(text: string): string[] {
  const lines = text.split('\n');
  const bodies: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^(\s*)(?:- )?run:\s*(.*)$/.exec(lines[i]);
    if (!match) continue;
    const keyIndent = indentOf(lines[i]) + (lines[i].trimStart().startsWith('- ') ? 2 : 0);
    const rest = match[2].trim();
    const body: string[] = /^[|>][+-]?$/.test(rest) ? [] : [rest];
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].trim() !== '' && indentOf(lines[j]) <= keyIndent) break;
      body.push(lines[j]);
    }
    bodies.push(body.join('\n'));
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
/** `${{ }}` may appear only as the value of an environment variable (an UPPER_CASE key), in `if:`, in a concurrency `group:` or in `run-name:`. */
const expressionOutsideAllowedLines = (text: string) =>
  stripComments(text)
    .split('\n')
    .filter((line) => line.includes('${{') && !/^\s*(?:[A-Z][A-Z0-9_]*|if|group|run-name):\s/.test(line));
const unpinnedActions = (text: string) => [...new Set([...stripComments(text).matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]).filter((uses) => !/@[0-9a-f]{40}$/.test(uses)))].sort();
const squash = (text: string) => text.replace(/\s+/g, ' ');

test('dedup-review-apply workflow (text checks)', async (t) => {
  const raw = readFileSync(WORKFLOW, 'utf8');
  const text = stripComments(raw);
  const jobs = extractJobs(text);

  await t.test('has exactly the three jobs; the input job fails loudly off master and the others are gated to it', () => {
    assert.deepStrictEqual(Object.keys(jobs), ['inputs', 'validate', 'apply']);
    assert.ok(!/\n\s+if:/.test(jobs.inputs), 'the first job has no if: a dispatch from another ref must fail, not skip everything');
    assert.ok(jobs.inputs.includes('"$GITHUB_REF" != refs/heads/master') && jobs.inputs.includes('exit 1'), 'it checks the ref');
    for (const name of ['validate', 'apply']) {
      assert.match(jobs[name], /\n\s+needs: inputs\n/, `${name} waits for the input check`);
      assert.match(jobs[name], /\n\s+if:\s*github\.ref == 'refs\/heads\/master'/, `${name} runs only from master`);
    }
  });

  await t.test('is dispatched by hand only, with read-only repository permissions and no shell override', () => {
    const triggers = topLevelBlock(text, 'on')
      .filter((line) => indentOf(line) === 2)
      .map((line) => line.trim().replace(/:.*$/, ''));
    assert.deepStrictEqual(triggers, ['workflow_dispatch']);
    assert.deepStrictEqual(
      topLevelBlock(text, 'permissions').map((line) => line.trim()),
      ['contents: read']
    );
    assert.ok(!/\n\s*shell:/.test(text) && !/\ndefaults:/.test(text), 'no shell: or defaults:, so the steps run under GitHub\'s `bash -e` and the tests below describe them');
  });

  await t.test('no input, secret or variable is ever interpolated into shell text or any other sink', () => {
    assert.ok(!hasExpressionInRunBody(raw), 'a ${{ }} expression sits inside a run: body; pass it through env: instead');
    assert.deepStrictEqual(expressionOutsideAllowedLines(raw), [], 'a ${{ }} expression sits outside an env value, if:, group: or run-name:');
    assert.ok(extractRunBodies(text).length >= 12, 'the scan found the run bodies');
  });

  await t.test('environments are static: none for the input check, dedup-review for validate, dedup-review-live for apply', () => {
    assert.ok(!/environment:/.test(jobs.inputs));
    assert.match(jobs.validate, /\n\s+environment: dedup-review\n/);
    assert.match(jobs.apply, /\n\s+environment: dedup-review-live\n/);
  });

  await t.test('each database secret appears only in its own job, only as a DATABASE_URL value, and never behind a fallback', () => {
    assert.ok(!jobs.inputs.includes('secrets.'));
    assert.ok(jobs.validate.includes(READ_SECRET) && !jobs.validate.includes(WRITE_SECRET), 'validate holds only the read-only secret');
    assert.ok(jobs.apply.includes(WRITE_SECRET) && !jobs.apply.includes(READ_SECRET), 'apply holds only the write secret');
    for (const line of text.split('\n').filter((l) => l.includes('secrets.'))) {
      assert.match(line, /^\s*DATABASE_URL:\s*\$\{\{ secrets\.[A-Z_]+ \}\}\s*$/, `a secret may only be a DATABASE_URL value: ${line.trim()}`);
    }
    for (const body of [jobs.validate, jobs.apply]) {
      assert.ok([...body.matchAll(/secrets\./g)].length >= 2, 'the credential check and the script step both get it');
    }
  });

  await t.test('apply runs share one serialized group; validate groups by tag or by run; nothing is ever cancelled in progress', () => {
    assert.match(jobs.apply, /group: dedup-review-apply-write\n/);
    assert.ok(jobs.validate.includes('group: dedup-review-apply-validate-${{ inputs.run_tag || github.run_id }}'), 'an untagged validate run gets its own group');
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

  await t.test('apply checks the secret and the kill switch first, then refuses a moved master', () => {
    const order = ['Check the credential and the kill switch', 'Checkout Repository', 'Check this commit is still the head of master', 'Install dependencies', 'Apply'].map((name) => jobs.apply.indexOf(`- name: ${name}\n`));
    assert.ok(order.every((i) => i >= 0) && [...order].sort((a, b) => a - b).join() === order.join(), 'the cheap refusals come before the checkout, install and build');
    assert.ok(jobs.apply.includes('git fetch --depth=1 origin master') && jobs.apply.includes('"$GITHUB_SHA"'), 'the head check');
    assert.match(squash(jobs.apply), /case "\$DISABLED" in false \| 0\) ;; \*\)/, 'only an explicit false or 0 enables apply');
    assert.ok(jobs.apply.includes('DISABLED: ${{ vars.DEDUP_REVIEW_APPLY_DISABLED }}'));
    assert.ok(jobs.apply.includes('DEDUP_REVIEW_APPLY_DISABLED: ${{ vars.DEDUP_REVIEW_APPLY_DISABLED }}'), 'the script gets the variable too');
    assert.ok(!jobs.validate.includes('vars.'), 'the read-only job reads no variable');
  });

  await t.test('the inputs job rejects a bad ref, mode, live, hash, tag and decisions before anyone is asked to approve', () => {
    const body = jobs.inputs;
    assert.ok(body.includes('[[ "$INVOKER_HASH" =~ ^[0-9a-fA-F]{64}$ ]]') && body.includes('[[ "$RUN_TAG" =~ ^[A-Za-z0-9._-]{1,64}$ ]]'), 'whole-value regexes (grep would match one line of a multi-line value)');
    assert.ok(body.includes('"$MODE" = validate') && body.includes('"$LIVE" = true'));
    assert.ok(body.includes('jq -e') && body.includes('.schemaVersion == 1') && body.includes('<= 50'), 'a no-secret check of the decisions file');
    assert.ok(body.includes('-gt 65535'));
  });

  await t.test('each script step captures the status without stopping, and then calls the guard', () => {
    for (const [name, tail] of [['validate', 'validate false'], ['apply', 'apply "$LIVE"']] as const) {
      const step = extractRunBodies(jobs[name]).find((b) => b.includes('dedup-review-apply.ts')) ?? '';
      assert.ok(step !== '' && /\brc=0\b/.test(step) && step.includes('|| rc=$?'), `${name}: the script's failure is captured with || rc=$?`);
      assert.ok(!/\bset -[a-z]*e/.test(step), `${name}: no set -e in the step`);
      assert.ok(step.trimEnd().endsWith(`bash scripts/dedup-review-apply-guard.sh "$RUNNER_TEMP/dedup-review-apply.out" "$rc" ${tail}`), `${name}: the guard is the last command, so its status is the step's`);
    }
    assert.ok(jobs.apply.includes('args+=(--live)') && jobs.apply.includes('if [ "$LIVE" = true ]'));
    assert.ok(!jobs.validate.includes('--live'));
  });

  await t.test('a failed or cancelled apply job prints the committed-or-not hint', () => {
    assert.match(jobs.apply, /if: failure\(\) \|\| cancelled\(\)/);
    assert.ok(jobs.apply.includes("performed_via = 'ai_skill'"));
  });

  await t.test('actions that are not pinned by SHA are exactly the known list, and the write secret warning stays until it is empty', () => {
    assert.deepStrictEqual(unpinnedActions(raw), [...KNOWN_UNPINNED].sort(), 'pin an action, or add it to KNOWN_UNPINNED on purpose');
    assert.strictEqual(raw.includes('DO NOT CREATE THIS SECRET'), KNOWN_UNPINNED.length > 0, 'the header warns about the write secret exactly while an action is unpinned');
  });

  await t.test('the scans catch what they are meant to catch (negative controls)', () => {
    assert.ok(/\bset -[a-z]*e/.test('set -euo pipefail') && /\bset -[a-z]*e/.test('set -e') && !/\bset -[a-z]*e/.test('set -uo pipefail'), 'the set -e check');
    assert.ok(hasExpressionInRunBody('steps:\n  - run: echo ${{ inputs.mode }}'), 'an inline run');
    assert.ok(hasExpressionInRunBody('steps:\n  - run: echo one\n      ${{ inputs.mode }}'), 'a continuation line of an inline run');
    assert.ok(hasExpressionInRunBody('steps:\n  - name: x\n    run: |\n      echo "hello"\n      echo ${{ inputs.decisions }}\n    env:\n      A: b'), 'a block run');
    assert.ok(hasExpressionInRunBody('steps:\n  - name: x\n    run: >-\n      echo ${{ secrets.X }}\n'), 'a folded run');
    assert.ok(!hasExpressionInRunBody('steps:\n  - name: x\n    env:\n      A: ${{ inputs.mode }}\n    run: |\n      echo "$A"\n'), 'an env expression is fine');
    assert.ok(!hasExpressionInRunBody('steps:\n  - name: x\n    run: |\n      # ${{ inputs.mode }} in a shell comment is stripped\n      echo hi\n'), 'a comment line is ignored');
    assert.deepStrictEqual(expressionOutsideAllowedLines('  - uses: x/script\n    with:\n      script: ${{ inputs.decisions }}\n      GOOD_KEY: ${{ inputs.mode }}\n'), ['      script: ${{ inputs.decisions }}'], 'an expression in a with: input is caught, an UPPER_CASE env value is not');
    assert.deepStrictEqual(expressionOutsideAllowedLines('    shell: ${{ inputs.mode }}\n    working-directory: ${{ inputs.mode }}\n'), ['    shell: ${{ inputs.mode }}', '    working-directory: ${{ inputs.mode }}']);
    assert.deepStrictEqual(unpinnedActions('uses: actions/checkout@v4\nuses: a/b@' + 'a'.repeat(40)), ['actions/checkout@v4']);
    assert.deepStrictEqual(Object.keys(extractJobs('jobs:\n  one:\n    runs-on: x\n  two:\n    runs-on: y\n')), ['one', 'two']);
  });

  await t.test('the export workflow, which this one mirrors, passes the same input-injection check', () => {
    assert.ok(!hasExpressionInRunBody(readFileSync(EXPORT_WORKFLOW, 'utf8')));
  });

  await t.test('the workflow has no stray unexpected top-level keys', () => {
    const keys = text.split('\n').filter((line) => /^[A-Za-z][\w-]*:/.test(line)).map((line) => line.replace(/:.*$/, ''));
    assert.deepStrictEqual(keys, ['name', 'run-name', 'on', 'permissions', 'jobs']);
  });
});

const ID = '11111111-1111-4111-8111-111111111111';
const MERGE_ID = '99999999-9999-4999-8999-999999999999';
const reportOf = (overrides: Partial<DedupReviewApplyReport> = {}): DedupReviewApplyReport => ({
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
const printed = (r: unknown) => ['DEDUP_REVIEW_APPLY_BEGIN', JSON.stringify(r), 'DEDUP_REVIEW_APPLY_END'].join('\n') + '\n';
const dryRun = reportOf({ mode: 'dry-run', counts: { eligible: 1, merged: 0, skipped: 0 }, results: [{ suggestionId: ID, outcome: 'eligible' }] });
const validated = reportOf({ mode: 'validate', counts: { eligible: 1, merged: 0, skipped: 0 }, results: [{ suggestionId: ID, outcome: 'eligible' }] });

test('dedup-review-apply guard script', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ddap-guard-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.strictEqual(spawnSync('jq', ['--version']).status, 0, 'jq is required to run these tests');

  let n = 0;
  function run(content: string, rc: number | string, mode: string, live: string) {
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

  await t.test('the script has valid bash syntax', () => {
    assert.strictEqual(spawnSync('bash', ['-n', GUARD]).status, 0);
  });

  await t.test('a live run: prints the output, summarizes counts and reason codes, and never an id or a merge id', () => {
    const content = printed(reportOf());
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
    assert.strictEqual(run(printed(validated), 0, 'validate', 'false').status, 0);
    assert.strictEqual(run(printed(dryRun), 0, 'apply', 'false').status, 0);
    assert.match(run(printed(reportOf({ mode: 'dry-run', results: [], counts: { eligible: 0, merged: 0, skipped: 0 } })), 0, 'apply', 'false').summary, /skipped by reason: none/);
    assert.strictEqual(run(printed(validated), 0, 'validate', 'true').status, 0, 'a validate run is never live, whatever the flag says');
  });

  await t.test('a report whose mode does not match the run is refused', () => {
    for (const [reportMode, mode, live] of [['live', 'apply', 'false'], ['dry-run', 'apply', 'true'], ['live', 'validate', 'false'], ['validate', 'apply', 'true']] as const) {
      const result = run(printed(reportOf({ mode: reportMode })), 0, mode, live);
      assert.strictEqual(result.status, 1, `${reportMode} for ${mode} live=${live}`);
      assert.match(result.out, /::error::The report says mode/);
    }
  });

  await t.test('a disabled report fails the job after writing the summary: the merges the run asked for did not happen', () => {
    const disabled = reportOf({ mode: 'disabled', killSwitch: true, usedLast24h: null, runTag: null, counts: { eligible: 0, merged: 0, skipped: 0 }, results: [] });
    for (const [mode, live] of [['validate', 'false'], ['apply', 'false'], ['apply', 'true']] as const) {
      const result = run(printed(disabled), 0, mode, live);
      assert.strictEqual(result.status, 1, `${mode} live=${live}`);
      assert.match(result.out, /::error::The script reports that its kill switch is on/);
      assert.match(result.summary, /kill switch: true/);
      assert.match(result.summary, /last 24 hours before this run: n\/a/);
      assert.match(result.summary, /run tag: `none`/);
      assert.match(result.summary, /apply was switched off/);
    }
  });

  await t.test('no markers, a duplicate or reversed pair, extra lines, or a report that is not JSON all fail even with status 0', () => {
    const json = JSON.stringify(dryRun);
    const bad: Record<string, string> = {
      'no markers': 'some other output\n',
      'only BEGIN': `DEDUP_REVIEW_APPLY_BEGIN\n${json}\n`,
      'nothing between': 'DEDUP_REVIEW_APPLY_BEGIN\nDEDUP_REVIEW_APPLY_END\n',
      'not json': 'DEDUP_REVIEW_APPLY_BEGIN\nnot json at all\nDEDUP_REVIEW_APPLY_END\n',
      'END before BEGIN': `DEDUP_REVIEW_APPLY_END\n${json}\nDEDUP_REVIEW_APPLY_BEGIN\n`,
      'two blocks': printed(dryRun) + printed(dryRun),
      'two lines between': `DEDUP_REVIEW_APPLY_BEGIN\n${json}\n${json}\nDEDUP_REVIEW_APPLY_END\n`,
      'pretty-printed JSON': `DEDUP_REVIEW_APPLY_BEGIN\n${JSON.stringify(dryRun, null, 2)}\nDEDUP_REVIEW_APPLY_END\n`,
    };
    for (const [label, content] of Object.entries(bad)) {
      assert.strictEqual(run(content, 0, 'apply', 'false').status, 1, label);
    }
  });

  await t.test('a report of the wrong shape or an inconsistent one fails instead of giving a green job with a broken summary', () => {
    const wrongShape: Record<string, unknown> = {
      'only a mode': { mode: 'dry-run' },
      'no counts': { ...dryRun, counts: undefined },
      'results null': { ...dryRun, results: null },
      'caps a string': { ...dryRun, caps: 'x' },
      'kill switch a string': { ...dryRun, killSwitch: 'no' },
      'counts not numbers': { ...dryRun, counts: { eligible: '1', merged: 0, skipped: 0 } },
    };
    for (const [label, value] of Object.entries(wrongShape)) {
      const result = run(printed(value), 0, 'apply', 'false');
      assert.strictEqual(result.status, 1, label);
      assert.match(result.out, /::error::The apply script's report is missing fields or has the wrong shape/, label);
      assert.strictEqual(result.summary, '', `${label}: no half-written summary`);
    }
    const inconsistent: Record<string, unknown> = {
      'counts do not match the results': { ...dryRun, counts: { eligible: 5, merged: 0, skipped: 0 } },
      'a dry run that reports a merge': { ...dryRun, counts: { eligible: 0, merged: 1, skipped: 0 }, results: [{ suggestionId: ID, outcome: 'merged', mergeId: MERGE_ID }] },
    };
    for (const [label, value] of Object.entries(inconsistent)) {
      const result = run(printed(value), 0, 'apply', 'false');
      assert.strictEqual(result.status, 1, label);
      assert.match(result.out, /::error::The report is inconsistent/, label);
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
    assert.match(run('', 1, 'validate', 'true').out, /changed nothing that persists/, 'a validate run is never live');
  });

  await t.test('a non-zero status with a printed report still fails (the run cannot be trusted)', () => {
    assert.strictEqual(run(printed(reportOf()), 1, 'apply', 'true').status, 1);
  });

  await t.test('a missing output file is refused', () => {
    const result = spawnSync('bash', [GUARD, join(dir, 'does-not-exist.txt'), '0', 'apply', 'false'], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '' } });
    assert.strictEqual(result.status, 2);
    assert.strictEqual(spawnSync('bash', [GUARD], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '' } }).status, 2, 'no arguments at all');
  });

  await t.test('a bad mode or a non-numeric status is refused instead of falling through to success', () => {
    for (const [rc, mode] of [[0, 'banana'], [0, 'APPLY'], ['abc', 'apply'], ['', 'apply'], ['1x', 'validate'], ['-1', 'apply']] as const) {
      const result = run(printed(dryRun), rc, mode, 'false');
      assert.strictEqual(result.status, 2, `rc=${JSON.stringify(rc)} mode=${mode}`);
    }
  });
});

test('dedup-review-apply workflow steps run the way GitHub runs them (bash -e, a stub for pnpm)', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ddap-step-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const workspace = join(dir, 'workspace');
  const runnerTemp = join(dir, 'runner');
  const bin = join(dir, 'bin');
  for (const d of [join(workspace, 'apps', 'backend'), join(workspace, 'scripts'), runnerTemp, bin]) mkdirSync(d, { recursive: true });
  copyFileSync(GUARD, join(workspace, 'scripts', 'dedup-review-apply-guard.sh'));
  // The stub stands in for `pnpm exec tsx src/dedup-review-apply.ts ...`: it prints what the test hands it and exits as told.
  writeFileSync(join(bin, 'pnpm'), '#!/usr/bin/env bash\nif [ -n "${FAKE_OUTPUT:-}" ]; then printf "%s" "$FAKE_OUTPUT"; fi\necho "$*" >> "$FAKE_CALLS"\nexit "${FAKE_RC:-0}"\n');
  chmodSync(join(bin, 'pnpm'), 0o755);

  const text = stripComments(readFileSync(WORKFLOW, 'utf8'));
  const jobs = extractJobs(text);
  const stepBody = (job: string) => extractRunBodies(jobs[job]).find((b) => b.includes('dedup-review-apply.ts')) as string;

  let n = 0;
  function runStep(job: 'validate' | 'apply', opts: { rc: number; output?: string; live?: string }) {
    const script = join(dir, `step-${++n}.sh`);
    const summary = join(dir, `summary-${n}.md`);
    const calls = join(dir, `calls-${n}.txt`);
    writeFileSync(script, stepBody(job));
    writeFileSync(summary, '');
    writeFileSync(calls, '');
    // GitHub runs a step without `shell:` as `bash -e {0}` and exports the step's env.
    const result = spawnSync('bash', ['-e', script], {
      cwd: workspace,
      env: {
        PATH: `${bin}:${process.env.PATH ?? ''}`,
        HOME: process.env.HOME ?? '',
        RUNNER_TEMP: runnerTemp,
        GITHUB_STEP_SUMMARY: summary,
        DECISIONS: '{"schemaVersion":1,"decisions":[]}',
        RUN_TAG: 'daily-1',
        LIVE: opts.live ?? 'false',
        FAKE_RC: String(opts.rc),
        FAKE_OUTPUT: opts.output ?? '',
        FAKE_CALLS: calls,
      },
      encoding: 'utf8',
    });
    return { status: result.status, out: result.stdout + result.stderr, summary: readFileSync(summary, 'utf8'), calls: readFileSync(calls, 'utf8'), decisions: readFileSync(join(runnerTemp, 'decisions.json'), 'utf8') };
  }

  await t.test('apply: a failing script still reaches the guard, which fails the step with its guidance', () => {
    const live = runStep('apply', { rc: 1, live: 'true' });
    assert.strictEqual(live.status, 1);
    assert.match(live.out, /::error::The live apply exited with status 1\. The run is one transaction/, 'the guard ran under bash -e');
    assert.ok(live.calls.includes('--live') && live.calls.includes('--mode apply') && live.calls.includes('--run-tag daily-1'), `the script got its arguments: ${live.calls}`);
    assert.strictEqual(live.decisions, '{"schemaVersion":1,"decisions":[]}', 'the decisions are written exactly, with no trailing newline');

    const dry = runStep('apply', { rc: 1 });
    assert.strictEqual(dry.status, 1);
    assert.match(dry.out, /changed nothing that persists/);
    assert.ok(!dry.calls.includes('--live'), 'no --live unless live is exactly true');
    assert.strictEqual(runStep('apply', { rc: 3, live: 'true' }).status, 3, 'the script\'s own status is the step\'s');
  });

  await t.test('apply: a good run writes the summary and succeeds; a run with no markers fails', () => {
    const ok = runStep('apply', { rc: 0, live: 'true', output: printed(reportOf()) });
    assert.strictEqual(ok.status, 0);
    assert.match(ok.summary, /### Dedup Review Apply/);
    assert.match(ok.summary, /- mode: `live`/);
    assert.strictEqual(runStep('apply', { rc: 0, output: 'nothing useful' }).status, 1);
  });

  await t.test('validate: a failing script still reaches the guard; a good report passes; it never passes --live', () => {
    const failed = runStep('validate', { rc: 1 });
    assert.strictEqual(failed.status, 1);
    assert.match(failed.out, /changed nothing that persists/);
    const ok = runStep('validate', { rc: 0, output: printed(validated) });
    assert.strictEqual(ok.status, 0);
    assert.match(ok.summary, /- mode: `validate`/);
    assert.ok(ok.calls.includes('--mode validate') && !ok.calls.includes('--live'));
  });
});
