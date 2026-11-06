import tseslint from "typescript-eslint";

/**
 * Architecture Spine invariants that must FAIL the build, not merely warn.
 *
 * Why this exists: `base.js` loads `eslint-plugin-only-warn`, which patches `Linter.prototype.verify`
 * for the whole ESLint process and downgrades every `error` to a `warning`. Any config that extends
 * `base` therefore cannot enforce anything, and a package whose `lint` script lacks
 * `--max-warnings 0` exits 0 on a violation. Raising that flag on a package with a large warning
 * backlog is not an option, so the invariants run as their own pass:
 *
 *   - this config parses TypeScript and registers ONLY the rules passed in;
 *   - it never imports `base.js`, so `only-warn` is never loaded and `severity: "error"` is real.
 *
 * Wire a package in with a second config file (see `apps/backend/eslint.invariants.config.mjs`) and a
 * `lint:invariants` script chained onto its `lint` script.
 */

/**
 * AD-8 rule 2: read active rows through `activeOnly(table)` from `@festgrid/graphql-select`, never a
 * hand-written `isNull(table.deletedAt)`. Shared by the editor-facing warning config and the enforced
 * invariants pass so the selector cannot drift between the two.
 */
export const AD8_NO_HAND_WRITTEN_SOFT_DELETE_FILTER = {
  selector: "CallExpression[callee.name='isNull'] Identifier[name='deletedAt']",
  message:
    "Do not hand-write isNull(table.deletedAt) — import activeOnly(table) from '@festgrid/graphql-select' instead (AD-8 rule 2).",
};

/**
 * Builds a flat config that enforces `rules` as real errors.
 *
 * @param {object} options
 * @param {string[]} options.files Glob patterns the rules apply to, relative to the package root.
 * @param {string[]} [options.ignores] Glob patterns to skip.
 * @param {Record<string, unknown>} options.rules Rule configuration; use severity "error".
 * @returns {import("eslint").Linter.Config[]}
 */
export function invariantsConfig({ files, ignores = [], rules }) {
  return [
    { ignores },
    {
      files,
      languageOptions: { parser: tseslint.parser },
      // An invariant cannot be silenced with a comment: an accepted exception is a change to the
      // config that declares the rule, which shows up in review. This also stops the many
      // `eslint-disable` directives written for the main pass from erroring with "Definition for
      // rule ... was not found", since this pass deliberately loads no plugins. ESLint reports each
      // ignored directive as a warning, so run this pass with `--quiet`.
      linterOptions: { noInlineConfig: true },
      rules,
    },
  ];
}
