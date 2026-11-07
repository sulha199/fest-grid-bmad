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
 * Actions that are still pinned by tag, not by commit SHA. Empty since the pin change (2026-11-03): the owner
 * decided (2026-11-01) that the write secret is created only once the workflow's actions are pinned. Pin a new
 * action by SHA instead of listing it here; if one is listed on purpose, the workflow header must carry the
 * "DO NOT CREATE THIS SECRET" warning again while it is.
 */
const KNOWN_UNPINNED: string[] = [];

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

  await t.test('rejects are gated three ways: an input visible in the run name, a stricter check before approval, and the owner variable in the apply job only', () => {
    const inputsBlock = topLevelBlock(text, 'on').join('\n');
    assert.match(inputsBlock, /allow_rejects:\n(?:\s+.*\n)*?\s+type: boolean\n\s+default: false/, 'allow_rejects is a boolean that is off by default');
    assert.strictEqual([...inputsBlock.matchAll(/^ {6}[a-z_]+:$/gm)].length, 7, 'seven inputs, under the limit of ten');

    const runName = /^run-name: (.*)$/m.exec(text)?.[1] ?? '';
    const suffix = "${{ inputs.allow_rejects && 'rejects=true ' || '' }}";
    const overrideSuffix = "${{ inputs.allow_floor_override && 'override=true ' || '' }}";
    assert.ok(runName.includes("live=${{ inputs.mode == 'apply' && inputs.live }} " + suffix + overrideSuffix + 'tag='), `rejects=true and override=true sit before the tag so a long tag cannot hide them: ${runName}`);
    assert.strictEqual(
      runName.replace(suffix, '').replace(overrideSuffix, ''),
      "Dedup Review Apply mode=${{ inputs.mode }} live=${{ inputs.mode == 'apply' && inputs.live }} tag=${{ inputs.run_tag }}",
      'with the suffix empty the title is exactly the title the skill matches for an accept-only run'
    );

    assert.ok(jobs.inputs.includes('ALLOW_REJECTS: ${{ inputs.allow_rejects }}'));
    assert.ok(jobs.inputs.includes('select(has("action") and .action != "accept" and .action != "accept-override")'), 'any action but exactly accept or accept-override needs allow_rejects');
    assert.match(squash(jobs.inputs), /if ! other=\$\(printf '%s' "\$DECISIONS" \| jq -r .*\); then echo "::error::The decisions could not be checked for rejects\."/, 'a jq failure stops the run: the check fails closed');
    assert.ok(!jobs.inputs.includes('vars.') && !jobs.inputs.includes('secrets.'), 'the input check still uses no variable or secret');
    assert.ok(jobs.validate.includes('ALLOW_REJECTS: ${{ inputs.allow_rejects }}') && jobs.validate.includes('args+=(--allow-rejects)'));
    assert.ok(!jobs.validate.includes('DEDUP_REVIEW_REJECT_ENABLED'), 'validate runs where the owner variable is not visible');
    assert.ok(jobs.apply.includes('REJECT_ENABLED: ${{ vars.DEDUP_REVIEW_REJECT_ENABLED }}') && jobs.apply.includes('DEDUP_REVIEW_REJECT_ENABLED: ${{ vars.DEDUP_REVIEW_REJECT_ENABLED }}'), 'the switch step and the script both get the variable');
    assert.ok(jobs.apply.includes('args+=(--allow-rejects)'));
    assert.ok(jobs.apply.indexOf('- name: Check the reject switch\n') > 0 && jobs.apply.indexOf('- name: Check the reject switch\n') < jobs.apply.indexOf('- name: Checkout Repository\n'), 'the switch is read before any code is fetched');
    assert.match(squash(jobs.apply), /case "\$REJECT_ENABLED" in true \| 1\) ;; \*\)/, 'only an explicit true or 1 switches rejects on');
    for (const name of ['setup steps 3', 'setup step 5']) {
      assert.ok(raw.includes('DEDUP_REVIEW_REJECT_ENABLED'), name);
    }
    assert.match(raw, /secrets, of DEDUP_REVIEW_APPLY_DISABLED, DEDUP_REVIEW_REJECT_ENABLED or DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED/, 'step 5 forbids an outer variable of the same name');
    assert.ok(!raw.toLowerCase().includes('update event_match_candidates'), 'no SQL in the workflow');
  });

  await t.test('the override is gated like rejects: an input visible in the run name in both jobs, the owner variable in the apply job only, read before any code is fetched', () => {
    const inputsBlock = topLevelBlock(text, 'on').join('\n');
    assert.match(inputsBlock, /allow_floor_override:\n(?:\s+.*\n)*?\s+type: boolean\n\s+default: false/, 'allow_floor_override is a boolean that is off by default');
    assert.ok(jobs.inputs.includes('ALLOW_FLOOR_OVERRIDE: ${{ inputs.allow_floor_override }}'));
    assert.ok(jobs.validate.includes('ALLOW_FLOOR_OVERRIDE: ${{ inputs.allow_floor_override }}') && jobs.validate.includes('args+=(--allow-floor-override)'), 'validate judges overrides, so it gets the flag');
    assert.ok(!jobs.validate.includes('DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED') && !jobs.validate.includes('vars.'), 'validate runs where the owner variable is not visible');
    assert.ok(jobs.apply.includes('FLOOR_OVERRIDE_ENABLED: ${{ vars.DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED }}') && jobs.apply.includes('DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED: ${{ vars.DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED }}'), 'the switch step and the script both get the variable');
    assert.ok(jobs.apply.includes('args+=(--allow-floor-override)'));
    const stepAt = jobs.apply.indexOf('- name: Check the floor override switch\n');
    assert.ok(stepAt > 0 && stepAt < jobs.apply.indexOf('- name: Checkout Repository\n'), 'the switch is read before any code is fetched');
    assert.match(squash(jobs.apply), /case "\$FLOOR_OVERRIDE_ENABLED" in true \| 1\) ;; \*\)/, 'only an explicit true or 1 switches overrides on');
    assert.ok(!raw.toLowerCase().includes('update event_match_candidates'), 'no SQL in the workflow');
  });

  await t.test('each script step captures the status without stopping, and then calls the guard', () => {
    for (const [name, tail] of [['validate', 'validate false "${ALLOW_FLOOR_OVERRIDE:-false}"'], ['apply', 'apply "$LIVE" "${ALLOW_FLOOR_OVERRIDE:-false}"']] as const) {
      const step = extractRunBodies(jobs[name]).find((b) => b.includes('dedup-review-apply.ts')) ?? '';
      assert.ok(step !== '' && /\brc=0\b/.test(step) && step.includes('|| rc=$?'), `${name}: the script's failure is captured with || rc=$?`);
      assert.ok(!/\bset -[a-z]*e/.test(step), `${name}: no set -e in the step`);
      assert.ok(step.trimEnd().endsWith(`bash scripts/dedup-review-apply-guard.sh "$RUNNER_TEMP/dedup-review-apply.out" "$rc" ${tail}`), `${name}: the guard is the last command, so its status is the step's`);
    }
    assert.ok(jobs.apply.includes('args+=(--live)') && jobs.apply.includes('if [ "$LIVE" = true ]'));
    assert.ok(!jobs.validate.includes('--live'));
    assert.ok(!jobs.validate.includes('--mode apply'), 'validate never asks for apply');
  });

  await t.test('a failed or cancelled apply job prints the committed-or-not hint', () => {
    assert.match(jobs.apply, /if: failure\(\) \|\| cancelled\(\)/);
    assert.ok(jobs.apply.includes("performed_via = 'ai_skill'"));
    assert.ok(jobs.apply.includes("status = 'rejected' and resolved_via = 'ai_skill'"), 'a run that only rejected leaves no journal row, so the hint names the suggestions');
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
  caps: { perRun: 10, perDay: 25, perDayRejects: 10 },
  counts: { eligible: 0, merged: 1, rejected: 0, skipped: 2 },
  results: [
    { suggestionId: ID, action: 'accept', outcome: 'merged', mergeId: MERGE_ID },
    { suggestionId: '22222222-2222-4222-8222-222222222222', action: 'accept', outcome: 'skipped', reason: 'no-anchor' },
    { suggestionId: '33333333-3333-4333-8333-333333333333', action: 'accept', outcome: 'skipped', reason: 'no-anchor' },
  ],
  ...overrides,
});
const printed = (r: unknown) => ['DEDUP_REVIEW_APPLY_BEGIN', JSON.stringify(r), 'DEDUP_REVIEW_APPLY_END'].join('\n') + '\n';
const dryRun = reportOf({ mode: 'dry-run', counts: { eligible: 1, merged: 0, rejected: 0, skipped: 0 }, results: [{ suggestionId: ID, action: 'accept', outcome: 'eligible' }] });
const validated = reportOf({ mode: 'validate', counts: { eligible: 1, merged: 0, rejected: 0, skipped: 0 }, results: [{ suggestionId: ID, action: 'accept', outcome: 'eligible' }] });

test('dedup-review-apply guard script', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ddap-guard-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.strictEqual(spawnSync('jq', ['--version']).status, 0, 'jq is required to run these tests');

  let n = 0;
  function run(content: string, rc: number | string, mode: string, live: string, allowOverride?: string) {
    const file = join(dir, `out-${++n}.txt`);
    const summary = join(dir, `summary-${n}.md`);
    writeFileSync(file, content);
    writeFileSync(summary, '');
    const result = spawnSync('bash', [GUARD, file, String(rc), mode, live, ...(allowOverride === undefined ? [] : [allowOverride])], {
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
    assert.match(result.summary, /- eligible: 0, merged: 1, rejected: 0, skipped: 2/);
    assert.match(result.summary, /- caps: 10 per run, 25 per day, 10 rejects per day/);
    assert.match(result.summary, /- skipped by reason: no-anchor: 2/);
    assert.match(result.summary, /- AI decisions in the last 24 hours before this run: 3/);
    assert.ok(!result.summary.includes(ID) && !result.summary.includes(MERGE_ID), 'no id in the public summary');
  });

  await t.test('validate and a dry run expect their own mode', () => {
    assert.strictEqual(run(printed(validated), 0, 'validate', 'false').status, 0);
    assert.strictEqual(run(printed(dryRun), 0, 'apply', 'false').status, 0);
    assert.match(run(printed(reportOf({ mode: 'dry-run', results: [], counts: { eligible: 0, merged: 0, rejected: 0, skipped: 0 } })), 0, 'apply', 'false').summary, /skipped by reason: none/);
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
    const disabled = reportOf({ mode: 'disabled', killSwitch: true, usedLast24h: null, runTag: null, counts: { eligible: 0, merged: 0, rejected: 0, skipped: 0 }, results: [] });
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
      'counts not numbers': { ...dryRun, counts: { eligible: '1', merged: 0, rejected: 0, skipped: 0 } },
      'no rejected count': { ...dryRun, counts: { eligible: 1, merged: 0, skipped: 0 } },
      'no reject cap': { ...dryRun, caps: { perRun: 10, perDay: 25 } },
    };
    for (const [label, value] of Object.entries(wrongShape)) {
      const result = run(printed(value), 0, 'apply', 'false');
      assert.strictEqual(result.status, 1, label);
      assert.match(result.out, /::error::The apply script's report is missing fields or has the wrong shape/, label);
      assert.strictEqual(result.summary, '', `${label}: no half-written summary`);
    }
    const inconsistent: Record<string, unknown> = {
      'counts do not match the results': { ...dryRun, counts: { eligible: 5, merged: 0, rejected: 0, skipped: 0 } },
      'a dry run that reports a merge': { ...dryRun, counts: { eligible: 0, merged: 1, rejected: 0, skipped: 0 }, results: [{ suggestionId: ID, action: 'accept', outcome: 'merged', mergeId: MERGE_ID }] },
      'a dry run that reports a reject': { ...dryRun, counts: { eligible: 0, merged: 0, rejected: 1, skipped: 0 }, results: [{ suggestionId: ID, action: 'reject', outcome: 'rejected' }] },
      'a result without its action': { ...dryRun, results: [{ suggestionId: ID, outcome: 'eligible' }] },
      'a result with an action that is neither': { ...dryRun, results: [{ suggestionId: ID, action: 'delete', outcome: 'eligible' }] },
    };
    for (const [label, value] of Object.entries(inconsistent)) {
      const result = run(printed(value), 0, 'apply', 'false');
      assert.strictEqual(result.status, 1, label);
      assert.match(result.out, /::error::The report is inconsistent/, label);
    }
    // Live reports: the outcome must fit the action, and the counts must be the results.
    const inconsistentLive: Record<string, unknown> = {
      'a rejected count that is not the rejected results': { ...reportOf(), counts: { eligible: 0, merged: 1, rejected: 1, skipped: 2 } },
      'a merge of a reject': reportOf({ results: [{ suggestionId: ID, action: 'reject', outcome: 'merged', mergeId: MERGE_ID }, ...reportOf().results.slice(1)] }),
      'a reject of an accept': reportOf({ counts: { eligible: 0, merged: 0, rejected: 1, skipped: 2 }, results: [{ suggestionId: ID, action: 'accept', outcome: 'rejected' }, ...reportOf().results.slice(1)] }),
    };
    for (const [label, value] of Object.entries(inconsistentLive)) {
      const result = run(printed(value), 0, 'apply', 'true');
      assert.strictEqual(result.status, 1, label);
      assert.match(result.out, /::error::The report is inconsistent/, label);
    }
  });

  await t.test('a live run with rejects: the summary counts them and names no id; the disabled report of the script still passes the new shape', () => {
    const rejectedRun = reportOf({
      counts: { eligible: 0, merged: 1, rejected: 2, skipped: 0 },
      results: [
        { suggestionId: ID, action: 'accept', outcome: 'merged', mergeId: MERGE_ID },
        { suggestionId: '22222222-2222-4222-8222-222222222222', action: 'reject', outcome: 'rejected' },
        { suggestionId: '33333333-3333-4333-8333-333333333333', action: 'reject', outcome: 'rejected' },
      ],
    });
    const result = run(printed(rejectedRun), 0, 'apply', 'true');
    assert.strictEqual(result.status, 0);
    assert.match(result.summary, /- eligible: 0, merged: 1, rejected: 2, skipped: 0/);
    assert.ok(!result.summary.includes(ID) && !result.summary.includes('22222222'), 'no id in the public summary');
    assert.strictEqual(run(printed(reportOf({ mode: 'dry-run', counts: { eligible: 1, merged: 0, rejected: 0, skipped: 0 }, results: [{ suggestionId: ID, action: 'reject', outcome: 'eligible' }] })), 0, 'apply', 'false').status, 0, 'a dry run may judge a reject eligible');
    // The script's own kill-switch report, as the CLI prints it now (it must keep passing the shape check, then fail on `disabled`).
    const disabled = run(printed({ ...reportOf(), mode: 'disabled', killSwitch: true, usedLast24h: null, runTag: null, counts: { eligible: 0, merged: 0, rejected: 0, skipped: 0 }, results: [] }), 0, 'apply', 'true');
    assert.match(disabled.out, /::error::The script reports that its kill switch is on/, 'it got past the shape check');
  });

  await t.test('a failed live run points at both places a run leaves a trace: the merge journal and the rejected suggestions', () => {
    const live = run('', 1, 'apply', 'true');
    assert.match(live.out, /event_match_candidates rows with status = 'rejected' and resolved_via = 'ai_skill'/);
    assert.ok(!/UPDATE /i.test(live.out), 'the reopening SQL is in the runbook, not in a log line');
  });

  await t.test('a validate report that says a reject happened is refused, whatever the flag', () => {
    const lie = { ...validated, counts: { eligible: 0, merged: 0, rejected: 1, skipped: 0 }, results: [{ suggestionId: ID, action: 'reject', outcome: 'rejected' }] };
    const result = run(printed(lie), 0, 'validate', 'false');
    assert.strictEqual(result.status, 1);
    assert.match(result.out, /::error::The report is inconsistent/);
  });

  await t.test('an override: merged in a live run it counts as a merge and is shown as "of which overrides", and it is accepted only when the run allowed overrides', () => {
    const ID_B = '22222222-2222-4222-8222-222222222222';
    const overrideRun = reportOf({
      counts: { eligible: 0, merged: 2, rejected: 0, skipped: 1 },
      results: [
        { suggestionId: ID, action: 'accept', outcome: 'merged', mergeId: MERGE_ID },
        { suggestionId: ID_B, action: 'accept-override', outcome: 'merged', mergeId: MERGE_ID },
        { suggestionId: '33333333-3333-4333-8333-333333333333', action: 'accept-override', outcome: 'skipped', reason: 'stale-evidence' },
      ],
    });
    const ok = run(printed(overrideRun), 0, 'apply', 'true', 'true');
    assert.strictEqual(ok.status, 0);
    assert.match(ok.summary, /- eligible: 0, merged: 2, rejected: 0, skipped: 1/);
    assert.match(ok.summary, /- of which overrides: 1/, 'only a merged override counts');
    assert.match(ok.summary, /- override decisions in this report: 2/, 'every override decision is shown, a skipped one too');
    assert.ok(!ok.summary.includes(ID_B) && !ok.summary.includes(MERGE_ID), 'no id in the public summary');
    assert.match(run(printed(reportOf()), 0, 'apply', 'true').summary, /- of which overrides: 0/, 'zero when there is none');
    for (const allow of [undefined, 'false', '', 'yes']) {
      const refused = run(printed(overrideRun), 0, 'apply', 'true', allow);
      assert.strictEqual(refused.status, 1, `allow ${String(allow)}`);
      assert.match(refused.out, /an override appears in a run that did not allow overrides/);
    }
    // A skipped or eligible override result is fine in a run that allowed it (the action is on every result); an outcome that does not fit is not.
    const eligible = { ...dryRun, results: [{ suggestionId: ID, action: 'accept-override', outcome: 'eligible' }] };
    assert.strictEqual(run(printed(eligible), 0, 'apply', 'false', 'true').status, 0);
    assert.match(run(printed(eligible), 0, 'apply', 'false', 'true').summary, /- override decisions in this report: 1/, 'a dry run shows its override decisions to the approver');
    assert.match(run(printed(reportOf()), 0, 'apply', 'true').summary, /- override decisions in this report: 0/);
    assert.strictEqual(run(printed({ ...validated, results: eligible.results }), 0, 'validate', 'false', 'true').status, 0);
    const rejectedOverride = reportOf({ counts: { eligible: 0, merged: 0, rejected: 1, skipped: 0 }, results: [{ suggestionId: ID, action: 'accept-override', outcome: 'rejected' }] });
    assert.strictEqual(run(printed(rejectedOverride), 0, 'apply', 'true', 'true').status, 1, 'an override is never a rejected outcome');
    const overrideInDryRun = { ...dryRun, counts: { eligible: 0, merged: 1, rejected: 0, skipped: 0 }, results: [{ suggestionId: ID, action: 'accept-override', outcome: 'merged', mergeId: MERGE_ID }] };
    assert.strictEqual(run(printed(overrideInDryRun), 0, 'apply', 'false', 'true').status, 1, 'a dry run cannot report a merge');
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
  function runStep(job: 'validate' | 'apply', opts: { rc: number; output?: string; live?: string; allowRejects?: string; allowFloorOverride?: string }) {
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
        ...(opts.allowRejects === undefined ? {} : { ALLOW_REJECTS: opts.allowRejects }),
        ...(opts.allowFloorOverride === undefined ? {} : { ALLOW_FLOOR_OVERRIDE: opts.allowFloorOverride }),
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

  await t.test('allow_rejects reaches the script as --allow-rejects only when it is exactly true, in both jobs', () => {
    for (const job of ['validate', 'apply'] as const) {
      const output = printed(job === 'validate' ? validated : dryRun);
      assert.ok(runStep(job, { rc: 0, output, allowRejects: 'true' }).calls.includes('--allow-rejects'), `${job}: true`);
      for (const off of [undefined, '', 'false', 'True', '1', 'yes']) {
        assert.ok(!runStep(job, { rc: 0, output, allowRejects: off }).calls.includes('--allow-rejects'), `${job}: ${String(off)}`);
      }
    }
  });

  // The two steps below hold the gate that keeps rejects off; they are run for real, with the env GitHub would give them.
  const runBody = (body: string, env: Record<string, string>) => {
    const script = join(dir, `body-${++n}.sh`);
    writeFileSync(script, body);
    const result = spawnSync('bash', ['-e', script], { env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env }, encoding: 'utf8' });
    return { status: result.status, out: result.stdout + result.stderr };
  };

  await t.test('the reject switch step: a run that allows rejects needs the owner variable to be exactly true or 1', () => {
    const body = extractRunBodies(jobs.apply).find((b) => b.includes('REJECT_ENABLED')) as string;
    assert.ok(body, 'the switch step exists');
    for (const on of ['true', '1']) assert.strictEqual(runBody(body, { ALLOW_REJECTS: 'true', REJECT_ENABLED: on }).status, 0, on);
    for (const off of ['', 'false', '0', 'yes', 'on', 'TRUE', 'tru', ' true']) {
      const result = runBody(body, { ALLOW_REJECTS: 'true', REJECT_ENABLED: off });
      assert.strictEqual(result.status, 1, JSON.stringify(off));
      assert.match(result.out, /::error::Rejects are switched off: the variable DEDUP_REVIEW_REJECT_ENABLED/);
    }
    // A run that does not allow rejects never looks at the variable, so an accept-only run is not blocked by a missing one.
    for (const allow of ['false', '', 'banana']) assert.strictEqual(runBody(body, { ALLOW_REJECTS: allow, REJECT_ENABLED: '' }).status, 0, `allow ${allow}`);
    assert.strictEqual(runBody(body, { REJECT_ENABLED: '' }).status, 0, 'allow_rejects unset');
  });

  await t.test('the inputs check: a decision with any action but exactly accept needs allow_rejects, before anyone approves', () => {
    const body = extractRunBodies(jobs.inputs).find((b) => b.includes('decisions must be JSON')) as string;
    assert.ok(body, 'the input check exists');
    const HASH = 'a'.repeat(64);
    const decision = (extra: Record<string, unknown>) => JSON.stringify({ schemaVersion: 1, decisions: [{ suggestionId: ID, evidenceHash: HASH, reasons: [], ...extra }] });
    const check = (decisions: string, allow: string | undefined) =>
      runBody(body, { MODE: 'apply', LIVE: 'true', INVOKER_HASH: HASH, RUN_TAG: 'daily-1', DECISIONS: decisions, ...(allow === undefined ? {} : { ALLOW_REJECTS: allow }) });

    for (const allow of [undefined, 'false', '']) {
      assert.strictEqual(check(decision({}), allow).status, 0, `an entry without action, allow ${String(allow)}`);
      assert.strictEqual(check(decision({ action: 'accept' }), allow).status, 0, `an explicit accept, allow ${String(allow)}`);
      for (const action of ['reject', 'Reject', 'REJECT', 'reject ', 'delete', '', null, 5, 'Accept-Override', 'accept-override ']) {
        const result = check(decision({ action }), allow);
        assert.strictEqual(result.status, 1, `${JSON.stringify(action)}, allow ${String(allow)}`);
        assert.match(result.out, /::error::A decision carries an action other than accept or accept-override, which needs allow_rejects/);
      }
    }
    for (const action of ['reject', 'Reject', 'delete']) assert.strictEqual(check(decision({ action }), 'true').status, 0, `${action} with allow_rejects: the script refuses what it does not know`);
    assert.strictEqual(check(JSON.stringify({ schemaVersion: 1, decisions: ['not an object', 5, null] }), undefined).status, 0, 'entries that are not objects do not abort the check (the parser refuses them later)');
    assert.strictEqual(check(JSON.stringify({ schemaVersion: 1, decisions: [] }), undefined).status, 0);
  });

  // ---- the floor override (FIND-124): the same shape of gate as rejects, with its own input and its own owner variable ----
  await t.test('allow_floor_override reaches the script as --allow-floor-override only when it is exactly true, in both jobs, and reaches the guard', () => {
    for (const job of ['validate', 'apply'] as const) {
      const output = printed(job === 'validate' ? validated : dryRun);
      assert.ok(runStep(job, { rc: 0, output, allowFloorOverride: 'true' }).calls.includes('--allow-floor-override'), `${job}: true`);
      for (const off of [undefined, '', 'false', 'True', '1', 'yes']) {
        const result = runStep(job, { rc: 0, output, allowFloorOverride: off });
        assert.ok(!result.calls.includes('--allow-floor-override'), `${job}: ${String(off)}`);
        assert.ok(!result.calls.includes('--allow-rejects'), `${job}: the override flag is not the reject flag`);
      }
      // The guard's fifth argument carries the input: a report with an override result passes the run that allowed it and fails the one that did not.
      const overrideReport = job === 'validate' ? { ...validated, results: [{ suggestionId: ID, action: 'accept-override', outcome: 'eligible' }] } : { ...dryRun, results: [{ suggestionId: ID, action: 'accept-override', outcome: 'eligible' }] };
      assert.strictEqual(runStep(job, { rc: 0, output: printed(overrideReport), allowFloorOverride: 'true' }).status, 0, `${job}: allowed`);
      const refused = runStep(job, { rc: 0, output: printed(overrideReport) });
      assert.strictEqual(refused.status, 1, `${job}: not allowed`);
      assert.match(refused.out, /an override appears in a run that did not allow overrides/);
    }
  });

  await t.test('the floor override switch step: a run that allows overrides needs its own owner variable to be exactly true or 1; the reject variable does not stand in', () => {
    const body = extractRunBodies(jobs.apply).find((b) => b.includes('FLOOR_OVERRIDE_ENABLED') && b.includes('case')) as string;
    assert.ok(body, 'the switch step exists');
    for (const on of ['true', '1']) assert.strictEqual(runBody(body, { ALLOW_FLOOR_OVERRIDE: 'true', FLOOR_OVERRIDE_ENABLED: on }).status, 0, on);
    for (const off of ['', 'false', '0', 'yes', 'on', 'TRUE', 'tru', ' true']) {
      const result = runBody(body, { ALLOW_FLOOR_OVERRIDE: 'true', FLOOR_OVERRIDE_ENABLED: off, REJECT_ENABLED: 'true' });
      assert.strictEqual(result.status, 1, JSON.stringify(off));
      assert.match(result.out, /::error::The floor override is switched off: the variable DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED/);
    }
    for (const allow of ['false', '', 'banana']) assert.strictEqual(runBody(body, { ALLOW_FLOOR_OVERRIDE: allow, FLOOR_OVERRIDE_ENABLED: '' }).status, 0, `allow ${allow}`);
    assert.strictEqual(runBody(body, { FLOOR_OVERRIDE_ENABLED: '' }).status, 0, 'allow_floor_override unset');
  });

  await t.test('the inputs check: an accept-override needs allow_floor_override whatever allow_rejects says, and override alone or reject alone each pass without the other input', () => {
    const body = extractRunBodies(jobs.inputs).find((b) => b.includes('decisions must be JSON')) as string;
    const HASH = 'a'.repeat(64);
    const decisions = (...actions: unknown[]) => JSON.stringify({ schemaVersion: 1, decisions: actions.map((action) => ({ suggestionId: ID, evidenceHash: HASH, reasons: [], action })) });
    const check = (ds: string, allowRejects: string | undefined, allowOverride: string | undefined) =>
      runBody(body, {
        MODE: 'apply', LIVE: 'true', INVOKER_HASH: HASH, RUN_TAG: 'daily-1', DECISIONS: ds,
        ...(allowRejects === undefined ? {} : { ALLOW_REJECTS: allowRejects }),
        ...(allowOverride === undefined ? {} : { ALLOW_FLOOR_OVERRIDE: allowOverride }),
      });

    // Override alone (rejects off): passes with its input, fails without.
    assert.strictEqual(check(decisions('accept-override'), undefined, 'true').status, 0, 'override alone, rejects off');
    for (const off of [undefined, 'false', '', 'True']) {
      const result = check(decisions('accept-override'), undefined, off);
      assert.strictEqual(result.status, 1, `override without its input: ${String(off)}`);
      assert.match(result.out, /::error::A decision carries the action accept-override, which needs allow_floor_override/);
    }
    // The reject input does not stand in for the override input.
    assert.strictEqual(check(decisions('accept-override'), 'true', undefined).status, 1, 'allow_rejects alone does not allow an override');
    // Reject alone (override off): passes with its input, an override in the same file does not.
    assert.strictEqual(check(decisions('reject'), 'true', undefined).status, 0, 'reject alone, override off');
    assert.strictEqual(check(decisions('reject', 'accept-override'), 'true', undefined).status, 1, 'a file with both needs both inputs');
    assert.strictEqual(check(decisions('reject', 'accept-override'), undefined, 'true').status, 1, 'and the reject still needs its own');
    assert.strictEqual(check(decisions('reject', 'accept-override', 'accept'), 'true', 'true').status, 0, 'both inputs allow a mixed file');
    // An unknown action keeps today's behaviour: allow_rejects lets it through to the script, which refuses it.
    assert.strictEqual(check(decisions('delete'), 'true', undefined).status, 0);
    // Entries that are not objects do not abort either check.
    assert.strictEqual(check(JSON.stringify({ schemaVersion: 1, decisions: ['x', 5, null] }), undefined, undefined).status, 0);
  });
});

// AI dedup review, FIND-115: the export workflow's summary step. It runs under `bash -e` with `set -euo pipefail`,
// so a jq error turns a good export red. It must print counts and raw timestamps from any report shape (a
// millisecond timestamp breaks jq's date functions; a missing key must not abort), and never an id: a suggestion
// id is not private, but the summary is for counts, and names in the report are untrusted text.
test('export workflow: the summary step prints counts and raw timestamps for any report shape and never an id', async (t) => {
  const body = extractRunBodies(stripComments(readFileSync(EXPORT_WORKFLOW, 'utf8'))).find((b) => b.includes('DEDUP_REVIEW_EXPORT_BEGIN') && b.includes('jq -r')) as string;
  assert.ok(body, 'the summary step exists');

  const dir = mkdtempSync(join(tmpdir(), 'dedup-export-summary-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const ID_A = '11111111-1111-4111-8111-111111111111';
  const ID_B = '22222222-2222-4222-8222-222222222222';
  const markers = (report: unknown) => ['DEDUP_REVIEW_EXPORT_BEGIN', JSON.stringify(report), 'DEDUP_REVIEW_EXPORT_END'].join('\n') + '\n';

  const full = {
    schemaVersion: 1,
    generatedAt: '2026-11-05T11:00:00.123Z',
    runTag: 'daily-1',
    limit: 10,
    totalPending: 160,
    staleCount: 1,
    skippedCount: 3,
    skipIdCount: 5,
    skipResolved: [
      { suggestionId: ID_A, status: 'accepted', resolvedAt: '2026-11-04T08:30:00.456Z', resolvedBy: 'human' },
      { suggestionId: ID_B, status: 'missing', resolvedAt: null, resolvedBy: null },
    ],
    scanLimited: false,
    oldestPendingAt: '2026-10-01T08:30:00.456Z',
    oldestUnskippedPendingAt: '2026-10-20T08:30:00.789Z',
    pairs: [],
    recentlyResolved: [{ suggestionId: ID_A, status: 'accepted', resolvedAt: '2026-11-04T08:30:00.456Z', resolvedBy: 'human' }],
    recentlyResolvedTruncated: false,
    recentlyExpiredCount: 300,
  };
  const empty = { ...full, totalPending: 0, skippedCount: 0, skipIdCount: 0, skipResolved: [], oldestPendingAt: null, oldestUnskippedPendingAt: null, recentlyResolved: [], recentlyExpiredCount: 0, runTag: null };
  const oldShape: Record<string, unknown> = { ...full };
  for (const key of ['skipIdCount', 'skipResolved', 'recentlyExpiredCount', 'oldestPendingAt', 'oldestUnskippedPendingAt']) delete oldShape[key];

  let n = 0;
  function runStep(output: string) {
    const runnerTemp = join(dir, `runner-${++n}`);
    mkdirSync(runnerTemp);
    writeFileSync(join(runnerTemp, 'dedup-review-export.out'), output);
    const summary = join(dir, `summary-${n}.md`);
    writeFileSync(summary, '');
    const script = join(dir, `step-${n}.sh`);
    writeFileSync(script, body);
    // GitHub runs a step without `shell:` as `bash -e {0}`.
    const result = spawnSync('bash', ['-e', script], {
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', RUNNER_TEMP: runnerTemp, GITHUB_STEP_SUMMARY: summary },
      encoding: 'utf8',
    });
    return { status: result.status, out: result.stdout + result.stderr, summary: readFileSync(summary, 'utf8') };
  }
  const noId = (text: string) => assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/.test(text), `no suggestion id in the summary:\n${text}`);

  await t.test('a full report: counts, the expiry count and both raw timestamps, millisecond part included', () => {
    const result = runStep(markers(full));
    assert.strictEqual(result.status, 0, result.out);
    for (const line of [
      '- pending suggestions: 160',
      '- skipped by the caller: 3',
      '- sent ids no longer pending: 2 of 5',
      '- decisions in the last 14 days: 1 (more existed: false)',
      '- expired in the last 14 days: 300',
      '- oldest pending: 2026-10-01T08:30:00.456Z',
      '- oldest pending not yet escalated: 2026-10-20T08:30:00.789Z',
    ]) {
      assert.ok(result.summary.includes(line), `missing "${line}" in:\n${result.summary}`);
    }
    noId(result.summary);
  });

  await t.test('an empty queue: nulls print as none, zeros as zeros, and the step still succeeds', () => {
    const result = runStep(markers(empty));
    assert.strictEqual(result.status, 0, result.out);
    assert.ok(result.summary.includes('- oldest pending: none'));
    assert.ok(result.summary.includes('- oldest pending not yet escalated: none'));
    assert.ok(result.summary.includes('- sent ids no longer pending: 0 of 0'));
    assert.ok(result.summary.includes('- run tag: `none`'));
  });

  await t.test('a report from before these fields existed does not turn the run red', () => {
    const result = runStep(markers(oldShape));
    assert.strictEqual(result.status, 0, result.out);
    assert.ok(result.summary.includes('- pending suggestions: 160'));
    noId(result.summary);
  });

  await t.test('no markers in the output still fails the step, loudly', () => {
    const result = runStep('nothing useful\n');
    assert.strictEqual(result.status, 1);
    assert.match(result.out, /::error::The export printed no line between its markers/);
  });
});
