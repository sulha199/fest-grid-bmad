import test from 'node:test';
import * as assert from 'node:assert';
import { ESLint } from 'eslint';
import * as path from 'node:path';

test('AD-8 rule 2 lint enforcement (Story 0.22)', async (t) => {
  const eslint = new ESLint({
    overrideConfigFile: path.resolve(process.cwd(), 'eslint.config.mjs'),
  });

  await t.test('flags a hand-written isNull(table.deletedAt) call', async () => {
    const results = await eslint.lintText(
      `import { isNull } from 'drizzle-orm';\nimport { favorites } from '@festgrid/database';\nconst w = isNull(favorites.deletedAt);\n`,
      { filePath: path.resolve(process.cwd(), 'src/schema/__lint_fixture__.ts') }
    );
    const violations = results[0].messages.filter(m => m.ruleId === 'no-restricted-syntax');
    assert.strictEqual(violations.length, 1);
  });

  await t.test('does not flag activeOnly(table) usage', async () => {
    const results = await eslint.lintText(
      `import { activeOnly } from '@festgrid/graphql-select';\nimport { favorites } from '@festgrid/database';\nconst w = activeOnly(favorites);\n`,
      { filePath: path.resolve(process.cwd(), 'src/schema/__lint_fixture__.ts') }
    );
    const violations = results[0].messages.filter(m => m.ruleId === 'no-restricted-syntax');
    assert.strictEqual(violations.length, 0);
  });

  await t.test('does not flag isNull on an unrelated column', async () => {
    const results = await eslint.lintText(
      `import { isNull } from 'drizzle-orm';\nimport { favorites } from '@festgrid/database';\nconst w = isNull(favorites.eventId);\n`,
      { filePath: path.resolve(process.cwd(), 'src/schema/__lint_fixture__.ts') }
    );
    const violations = results[0].messages.filter(m => m.ruleId === 'no-restricted-syntax');
    assert.strictEqual(violations.length, 0);
  });
});
