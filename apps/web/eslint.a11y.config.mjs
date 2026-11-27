import tseslint from "typescript-eslint";
import { a11yFiles, a11yIgnores, a11yRules, jsxA11y } from "./eslint-a11y-scope.mjs";

/**
 * The enforced accessibility lint pass for `apps/web` (`pnpm lint:a11y`, run by `pnpm lint`). It never imports the
 * shared base config, so `eslint-plugin-only-warn` is not loaded and `error` is a real error (same pattern as
 * `apps/backend`'s `eslint.invariants.config.mjs`). It checks nothing but the jsx-a11y recommended rules, on the
 * covered files only.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export default [
  {
    files: a11yFiles,
    ignores: a11yIgnores,
    languageOptions: { ...jsxA11y.flatConfigs.recommended.languageOptions, parser: tseslint.parser },
    plugins: {
      "jsx-a11y": jsxA11y,
      // Registers the rule id only (no rule runs), so the existing `eslint-disable-next-line react-hooks/exhaustive-deps`
      // comments in the covered files resolve; `pnpm lint` (next lint) is what runs the real react-hooks rules.
      "react-hooks": { rules: { "exhaustive-deps": { meta: { schema: [] }, create: () => ({}) } } },
    },
    rules: a11yRules,
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
];
