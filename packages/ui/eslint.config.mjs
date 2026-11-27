import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import { config as reactInternalConfig } from '@festgrid/eslint-config/react-internal';
import noDynamicTailwindArbitraryValue from './eslint-rules/no-dynamic-tailwind-arbitrary-value.mjs';

/**
 * `packages/ui`'s first-ever ESLint config (Story 1.i1k Task 6.2). Deliberately minimal and
 * narrowly `files`-scoped to just the one new anti-regression rule (FIND-025 finding (2)) —
 * NOT the full `@festgrid/eslint-config/base`/`react-internal` ruleset, which every sibling
 * package extends. Retroactively enabling that full ruleset here is a separate, unbounded-size
 * infra gap (unknown volume of pre-existing violations across this package's entire multi-epic
 * source tree) — tracked as its own Story 0.41 (renumbered from 0.40 on merge with master), not
 * this story's scope.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  ...reactInternalConfig,
  // Accessibility lint (project-context.md "Accessibility"): the jsx-a11y recommended rules, enforced on the surfaces
  // the WCAG commitment covers (navbar, event list, event detail and the shared controls they use). Warnings fail the
  // build here (`--max-warnings 0`). Tests are excluded. A new surface joins this list when it joins the commitment.
  {
    files: [
      'src/features/events/**/*.{ts,tsx}',
      'src/core/app-shell/**/*.{ts,tsx}',
      'src/core/*.{ts,tsx}',
      'src/core/ui/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      // The label text sits two levels down (label > div > span), deeper than the rule's default depth of 2.
      'jsx-a11y/label-has-associated-control': ['warn', { depth: 4 }],
    },
  },
  {
    files: ['src/features/events/**/*.{ts,tsx}'],
    // `InstagramEmbed.tsx` carries a pre-existing `eslint-disable-next-line
    // react-hooks/exhaustive-deps` comment from before this package had any ESLint config at
    // all. This minimal config deliberately registers no other plugins (see above), so that
    // comment's rule id is unresolvable and would otherwise fail as "Definition for rule ...
    // was not found" -- a pre-existing-file/full-ruleset-parity concern out of this story's
    // narrow scope (tracked under the same Story 0.41 / FIND-036 gap, not this rule's fault).
    ignores: ['src/features/events/InstagramEmbed.tsx'],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      local: {
        rules: {
          'no-dynamic-tailwind-arbitrary-value': noDynamicTailwindArbitraryValue,
        },
      },
    },
    rules: {
      'local/no-dynamic-tailwind-arbitrary-value': 'error',
    },
  },
];
