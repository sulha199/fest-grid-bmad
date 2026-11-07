import test from 'node:test';
import * as assert from 'node:assert';
import { ESLint } from 'eslint';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

// The AD-8 rule 2 lint rule is enforced by `pnpm run lint:invariants`, a pass of its own. The main
// `eslint.config.mjs` extends the shared base, whose `eslint-plugin-only-warn` downgrades every error
// to a warning for the whole ESLint process, so a violation there prints a warning and exits 0. The
// tests below therefore assert the two things that failure mode hides: the rule reports at severity 2,
// and the real command exits non-zero on a violation.

const backendRoot = process.cwd();
const invariantsConfig = path.resolve(backendRoot, 'eslint.invariants.config.mjs');
const fixturePath = path.resolve(backendRoot, 'src/schema/__lint_fixture__.ts');

const VIOLATION = `import { isNull } from 'drizzle-orm';\nimport { favorites } from '@festgrid/database';\nconst w = isNull(favorites.deletedAt);\n`;
const COMPLIANT = `import { activeOnly } from '@festgrid/graphql-select';\nimport { favorites } from '@festgrid/database';\nconst w = activeOnly(favorites);\n`;
const UNRELATED_COLUMN = `import { isNull } from 'drizzle-orm';\nimport { favorites } from '@festgrid/database';\nconst w = isNull(favorites.eventId);\n`;

test('AD-8 rule 2 lint enforcement (Story 0.22)', async (t) => {
  const eslint = new ESLint({ overrideConfigFile: invariantsConfig });

  await t.test('flags a hand-written isNull(table.deletedAt) call as an error, not a warning', async () => {
    const results = await eslint.lintText(VIOLATION, { filePath: fixturePath });
    const violations = results[0].messages.filter(m => m.ruleId === 'no-restricted-syntax');
    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].severity, 2, 'only-warn must not be in effect for the invariants pass');
    assert.strictEqual(results[0].errorCount, 1);
  });

  await t.test('does not flag activeOnly(table) usage', async () => {
    const results = await eslint.lintText(COMPLIANT, { filePath: fixturePath });
    const violations = results[0].messages.filter(m => m.ruleId === 'no-restricted-syntax');
    assert.strictEqual(violations.length, 0);
  });

  await t.test('does not flag isNull on an unrelated column', async () => {
    const results = await eslint.lintText(UNRELATED_COLUMN, { filePath: fixturePath });
    const violations = results[0].messages.filter(m => m.ruleId === 'no-restricted-syntax');
    assert.strictEqual(violations.length, 0);
  });

  // The same filter spelled another way is still a hand-written soft-delete filter. These two slipped past the
  // first selector (it matched only a bare `isNull(...)` call and only an Identifier named deletedAt).
  const imports = `import { isNull, and, eq } from 'drizzle-orm';\nimport * as d from 'drizzle-orm';\nimport { favorites } from '@festgrid/database';\n`;
  const FLAGGED_SPELLINGS: Record<string, string> = {
    'a member call, d.isNull(table.deletedAt)': `const w = d.isNull(favorites.deletedAt);`,
    "a computed column, isNull(table['deletedAt'])": `const w = isNull(favorites['deletedAt']);`,
    'a computed column with double quotes': `const w = isNull(favorites["deletedAt"]);`,
    "both at once, d.isNull(table['deletedAt'])": `const w = d.isNull(favorites['deletedAt']);`,
    'inside and(...)': `const w = and(eq(favorites.eventId, 'e'), isNull(favorites.deletedAt));`,
  };
  for (const [name, code] of Object.entries(FLAGGED_SPELLINGS)) {
    await t.test(`flags ${name}`, async () => {
      const results = await eslint.lintText(imports + code + '\n', { filePath: fixturePath });
      const violations = results[0].messages.filter(m => m.ruleId === 'no-restricted-syntax');
      assert.strictEqual(violations.length, 1, `expected one AD-8 violation for: ${code}`);
      assert.strictEqual(violations[0].severity, 2);
    });
  }

  const NOT_FLAGGED_SPELLINGS: Record<string, string> = {
    'd.isNull on another column': `const w = d.isNull(favorites.eventId);`,
    "isNull on another computed column": `const w = isNull(favorites['eventId']);`,
    'isNotNull(table.deletedAt), the moderator view of removed rows': `const w = d.isNotNull(favorites.deletedAt);`,
    "a deletedAt string outside isNull": `const label = 'deletedAt'; const w = eq(favorites.eventId, label);`,
  };
  for (const [name, code] of Object.entries(NOT_FLAGGED_SPELLINGS)) {
    await t.test(`does not flag ${name}`, async () => {
      const results = await eslint.lintText(imports + code + '\n', { filePath: fixturePath });
      const violations = results[0].messages.filter(m => m.ruleId === 'no-restricted-syntax');
      assert.strictEqual(violations.length, 0, `unexpected AD-8 violation for: ${code}`);
    });
  }

  await t.test('cannot be silenced with an inline eslint-disable comment', async () => {
    const silenced = `import { isNull } from 'drizzle-orm';\nimport { favorites } from '@festgrid/database';\n// eslint-disable-next-line no-restricted-syntax\nconst w = isNull(favorites.deletedAt);\n`;
    const results = await eslint.lintText(silenced, { filePath: fixturePath });
    const violations = results[0].messages.filter(m => m.ruleId === 'no-restricted-syntax');
    assert.strictEqual(violations.length, 1);
    assert.strictEqual(violations[0].severity, 2);
  });
});

test('AD-8 rule 2: the real `lint:invariants` command fails the build on a violation', async (t) => {
  const eslintBin = path.resolve(backendRoot, 'node_modules/eslint/bin/eslint.js');
  const runInvariantsPass = (source: string) =>
    spawnSync(
      process.execPath,
      [eslintBin, '--quiet', '--config', invariantsConfig, '--stdin', '--stdin-filename', fixturePath],
      { input: source, cwd: backendRoot, encoding: 'utf8' },
    );

  await t.test('exits non-zero for a hand-written isNull(table.deletedAt)', () => {
    const run = runInvariantsPass(VIOLATION);
    assert.notStrictEqual(run.status, 0, `expected a failing exit code, got ${run.status}\n${run.stdout}${run.stderr}`);
    assert.match(run.stdout, /AD-8 rule 2/);
  });

  await t.test('exits zero for activeOnly(table)', () => {
    const run = runInvariantsPass(COMPLIANT);
    assert.strictEqual(run.status, 0, `${run.stdout}${run.stderr}`);
  });

  await t.test('is chained onto the package `lint` script, so CI runs it', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(backendRoot, 'package.json'), 'utf8'));
    assert.match(pkg.scripts.lint, /lint:invariants/);
    assert.match(pkg.scripts['lint:invariants'], /eslint\.invariants\.config\.mjs/);
    assert.match(pkg.scripts['lint:invariants'], /--quiet/, 'ignored directives are reported as warnings; --quiet keeps the output readable');
  });
});
