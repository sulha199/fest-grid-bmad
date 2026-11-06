import { test } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Story 0.i3z: the invariant-sweep suite runs in CI, and a red CI run keeps a change from shipping.
//
// What a repository file CAN pin, this test pins:
//   - the two CI jobs keep the names that Vercel's Deployment Checks and a GitHub ruleset match by
//     (SETUP_WALKTHROUGH.md: "so do not rename it"); a rename silently drops the requirement;
//   - the "Continuous Integration" job runs the whole workspace `test` script, which reaches this
//     package's tests (the invariant sweep, the Lambda-timeout check, the IAM-grant walker);
//   - the workspace `test` script does not exclude this package;
//   - a pull request to master triggers the workflow, so the checks exist on a PR to be required;
//   - the database migration and the AWS deploy both wait for `ci` and `e2e`.
//
// What it cannot pin: whether GitHub refuses to MERGE a pull request while those checks are red.
// That is the `protect-master` ruleset's "Require status checks to pass" rule, a repository setting.
// Today the ruleset requires a pull request and a code owner's approval on protected paths, and blocks
// force pushes and deletion; it does not list status checks (CODEOWNERS, AD-45 Rule 7). The repository
// admin role also bypasses a ruleset inside a pull request, so even a required check does not bind the
// owner's own token.

const repoRoot = path.resolve(__dirname, '../../..');
const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
const rootPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
const infraPackage = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')) as {
  name: string;
  scripts: Record<string, string>;
};

/** The text of one job: from its `  <id>:` line to the next job (jobs sit at two-space indent). */
function jobBlock(jobId: string): string {
  const lines = workflow.split('\n');
  const start = lines.findIndex((line) => line === `  ${jobId}:`);
  assert.ok(start >= 0, `ci.yml has no job "${jobId}"`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function needsOf(jobId: string): string[] {
  const match = jobBlock(jobId).match(/^ {4}needs:\s*\[([^\]]*)\]/m);
  assert.ok(match, `job "${jobId}" has no \`needs: [...]\``);
  return match[1].split(',').map((entry) => entry.trim()).filter(Boolean);
}

test('CI wiring (Story 0.i3z): the checks keep the names a ruleset and Vercel match by', () => {
  assert.match(jobBlock('ci'), /^ {4}name: Continuous Integration$/m);
  assert.match(jobBlock('e2e'), /^ {4}name: End-to-End Tests$/m);
});

test('CI wiring (Story 0.i3z): a pull request to master triggers the workflow', () => {
  const triggers = workflow.slice(0, workflow.indexOf('\njobs:'));
  assert.match(triggers, /^ {2}pull_request:\s*\n {4}branches:\s*\n {6}- master$/m);
});

test('CI wiring (Story 0.i3z): the Continuous Integration job runs lint and the whole workspace test script', () => {
  const ci = jobBlock('ci');
  assert.match(ci, /^ {8}run: pnpm run lint$/m, 'the ci job must run `pnpm run lint`');
  assert.match(ci, /^ {8}run: pnpm run test$/m, 'the ci job must run `pnpm run test`');
});

test('CI wiring (Story 0.i3z): the workspace test script reaches the infrastructure tests', () => {
  assert.match(rootPackage.scripts.test, /^turbo run test\b/, 'the root `test` script must run `turbo run test`');
  assert.ok(
    !rootPackage.scripts.test.includes(`!${infraPackage.name}`),
    `the root \`test\` script excludes ${infraPackage.name}, so the invariant sweep would stop running in CI`,
  );
  assert.match(infraPackage.scripts.test, /lib\/\*\*\/\*\.test\.ts/, `${infraPackage.name}'s \`test\` script must glob lib/**/*.test.ts`);
});

test('CI wiring (Story 0.i3z): a red check stops the database migration and the AWS deploy', () => {
  for (const jobId of ['db-migrate', 'deploy-infrastructure']) {
    const needs = needsOf(jobId);
    assert.ok(needs.includes('ci') && needs.includes('e2e'), `job "${jobId}" must need both ci and e2e, found [${needs.join(', ')}]`);
  }
});
